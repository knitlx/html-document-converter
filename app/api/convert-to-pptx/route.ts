import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'buffer';  // Explicit for Vercel
import { load } from 'cheerio';
import PptxGenJS from 'pptxgenjs';
import puppeteer from 'puppeteer-core';
import * as chromium from '@sparticuz/chromium-min';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      VERCEL_ENV: string | undefined;
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { htmlContent } = await req.json();
    if (!htmlContent) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    const isVercel = process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview';

    const browser = await puppeteer.launch({
      args: isVercel ? [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'] : [],
      defaultViewport: chromium.defaultViewport,
      executablePath: isVercel ? await chromium.executablePath() : undefined,
      headless: true,  // Unified: true for both local/Vercel (avoids 'new' deprecation)
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 2 });  // For consistent PPTX layout

    // Parse slides from HTML
    const $ = load(htmlContent);
    const slidesHtml: string[] = [];
    $('div.slide').each((_, element) => {
      slidesHtml.push($.html(element) || '');
    });
    if (slidesHtml.length === 0) {
      slidesHtml.push(htmlContent);  // Fallback: single slide with full content
    }

    // Extract styles: full blocks for <style>, links as <link>
    const cssBlocks: string[] = [];
    $('style').each((_, element) => {
      cssBlocks.push($(element).html() || '');  // html() for full block (incl. <style>...</style>)
    });
    const linkTags: string[] = [];
    $('link[rel="stylesheet"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        linkTags.push(`<link rel="stylesheet" href="${href}">`);
      }
    });

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16_9';  // 16:9 aspect for slides

    for (const [index, slideHtmlContent] of slidesHtml.entries()) {
      // Fixed multi-line template: Indented, ${join('\n')} in single expr (no breaks)
      const fullHtml = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Slide ${index + 1}</title>
            ${linkTags.join('\n')}  <!-- External links -->
            <style>
              body { margin: 0; padding: 0; }
              .slide-wrapper { width: 960px; height: 540px; overflow: hidden; box-sizing: border-box; background-color: white; display: block; }
              p, h1, h2, h3, h4, h5, h6, ul, ol, li { color: black !important; font-family: sans-serif !important; margin: 0.5em 0 !important; padding: 0 !important; }
              b, strong { font-weight: bold !important; }
              i, em { font-style: italic !important; }
              u { text-decoration: underline !important; }
              ${cssBlocks.join('\n')}  <!-- Fixed: join full blocks with \n; no nesting issues -->
            </style>
          </head>
          <body>
            <div class="slide-wrapper">
              ${slideHtmlContent}
            </div>
          </body>
        </html>
      `;

      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

      const imageBuffer = await page.screenshot({
        type: 'png',
        fullPage: false,
        clip: { x: 0, y: 0, width: 960, height: 540 },
      });

      const currentSlide = pptx.addSlide();
      currentSlide.addImage({
        data: imageBuffer.toString('base64'),  // 'data' for Buffer
        x: 0,
        y: 0,
        w: '100%',
        h: '100%',
      });
    }

    await browser.close();

    const pptxBuffer = await pptx.write({ outputType: 'arraybuffer' });
    const responseBuffer = Buffer.from(pptxBuffer as ArrayBuffer);

    return new NextResponse(responseBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': 'attachment; filename=converted.pptx',
      },
    });
  } catch (error) {
    console.error('PPTX conversion error:', error);
    return NextResponse.json({ error: 'PPTX conversion failed' }, { status: 500 });
  }
}