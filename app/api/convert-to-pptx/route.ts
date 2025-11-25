// app/api/convert-to-pptx/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { load } from 'cheerio'; // Make sure cheerio is imported
import PptxGenJS from 'pptxgenjs';

// Use direct imports for puppeteer-core and @sparticuz/chromium
// These are production dependencies for Vercel
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Type definitions for process.env (optional but good practice)
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      VERCEL_ENV: string | undefined;
    }
  }
}

// Conditional require for local development using the full puppeteer package
let localPuppeteer: typeof puppeteerCore | undefined; // Use puppeteerCore type for consistency
if (process.env.NODE_ENV === 'development' && !process.env.VERCEL_ENV) {
  try {
    // eslint-disable-next-line global-require
    localPuppeteer = require('puppeteer');
  } catch (error) {
    console.warn('Full puppeteer not found locally, falling back to puppeteer-core.', error);
  }
}

export async function POST(req: NextRequest) {
  let browser: puppeteerCore.Browser | undefined; // Explicitly type browser
  try {
    const { htmlContent } = await req.json();

    if (!htmlContent) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    const isVercel = process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview';

    if (isVercel) {
      // For Vercel, use puppeteer-core with @sparticuz/chromium
      browser = await puppeteerCore.launch({
        args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(
          `https://github.com/Sparticuz/chromium/releases/download/v${chromium.revision}/chromium-v${chromium.revision}-pack.tar`
        ),
        headless: chromium.headless,
      } as puppeteerCore.LaunchOptions);
    } else if (localPuppeteer) {
      // For local development, use the full puppeteer package (if found)
      browser = await localPuppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    } else {
      // Fallback for local development if full puppeteer isn't available
      console.warn('Neither Vercel environment nor full puppeteer found. Attempting to launch puppeteer-core locally.');
      browser = await puppeteerCore.launch({
        args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(), // puppeteer-core tries to find local Chrome
        headless: true,
      } as puppeteerCore.LaunchOptions);
    }

    const page = await browser.newPage();
    const $ = load(htmlContent);
    const slidesHtml: string[] = [];

    // Extract original styles from the head of the HTML content
    const originalStyles: string[] = [];
    $('style').each((_, element) => {
      originalStyles.push($(element).html() || '');
    });
    $('link[rel="stylesheet"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        originalStyles.push(`@import url("${href}");`);
      }
    });

    $('div.slide').each((_, element) => {
      slidesHtml.push($(element).html() || '');
    });

    if (slidesHtml.length === 0) {
      slidesHtml.push(htmlContent); // Fallback: use entire content as one slide
    }

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16_9';

    for (const [index, slideHtmlContent] of slidesHtml.entries()) {
      const fullHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Slide ${index + 1}</title>
            <style>
                body { margin: 0; padding: 0; }
                .slide-wrapper {
                    width: 960px;
                    height: 540px;
                    overflow: hidden;
                    box-sizing: border-box;
                    background-color: white;
                }
                p, h1, h2, h3, h4, h5, h6, ul, ol, li {
                    color: black !important;
                    font-family: sans-serif !important;
                    margin: 0.5em 0 !important;
                    padding: 0 !important;
                }
                b, strong { font-weight: bold !important; }
                i, em { font-style: italic !important; }
                u { text-decoration: underline !important; }
                ${originalStyles.join('\n')}
            </style>
        </head>
        <body>
            <div class="slide-wrapper">
                ${slideHtmlContent}
            </div>
        </body>
        </html>
      `;

      await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 2 });
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

      const imageBuffer = await page.screenshot({
        type: 'png',
        fullPage: false,
        clip: { x: 0, y: 0, width: 960, height: 540 },
      });
      slide.addImage({ data: imageBuffer.toString('base64'), x: 0, y: 0, w: '100%', h: '100%' });
    }

    const pptxBuffer = await pptx.write({ outputType: 'arraybuffer' });

    // Explicitly convert ArrayBuffer to Buffer for NextResponse compatibility
    const responseBuffer = Buffer.from(pptxBuffer as ArrayBuffer);

    return new NextResponse(responseBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': 'attachment; filename="presentation.pptx"',
      },
      status: 200,
    });
  } catch (error) {
    console.error('Error converting HTML to PPTX:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}