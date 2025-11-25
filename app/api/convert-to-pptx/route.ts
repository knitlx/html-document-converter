// app/api/convert-to-pptx/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { load } from 'cheerio';
import PptxGenJS from 'pptxgenjs';

// Import types for puppeteer (used for local development)
import type * as pp from 'puppeteer';
// Import types for puppeteer-core and its associated types
import type * as ppc from 'puppeteer-core';

// Type definitions for process.env
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      VERCEL_ENV: string | undefined;
    }
  }
}

export async function POST(req: NextRequest) {
  let browser: pp.Browser | ppc.Browser | undefined; // Use union type for browser
  let puppeteer: typeof pp | typeof ppc;
  let chromium: typeof import('@sparticuz/chromium');

  const isVercel = process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview';

  if (isVercel) {
    // Dynamically import for Vercel
    puppeteer = require('puppeteer-core');
    chromium = require('@sparticuz/chromium');
  } else {
    // Dynamically import for local development
    try {
      puppeteer = require('puppeteer');
      // For local development, we don't strictly need @sparticuz/chromium
      chromium = require('@sparticuz/chromium'); // Still load for its args/defaultViewport
    } catch (error) {
      console.warn('Full puppeteer not found locally. Falling back to puppeteer-core.', error);
      puppeteer = require('puppeteer-core');
      chromium = require('@sparticuz/chromium');
    }
  }

  try {
    const { htmlContent } = await req.json();

    if (!htmlContent) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    browser = await puppeteer.launch({
      args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
      defaultViewport: chromium.defaultViewport,
      executablePath: isVercel ? await chromium.executablePath() : undefined, // Let chromium resolve path on Vercel, puppeteer finds it locally
      headless: isVercel ? chromium.headless : true, // Use chromium.headless for Vercel, true for local
    });

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
                ${originalStyles.join('
')}
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
      const currentSlide = pptx.addSlide();
      currentSlide.addImage({ data: imageBuffer.toString('base64'), x: 0, y: 0, w: '100%', h: '100%' });
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
