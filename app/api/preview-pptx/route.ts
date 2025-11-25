import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { load } from 'cheerio'; // Import cheerio

export async function POST(request: Request) {
  try {
    const { htmlContent } = await request.json();

    if (!htmlContent) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    // 1. Load HTML and extract slides and styles using cheerio
    const $ = load(htmlContent);
    const slidesHtml: string[] = [];
    $('div.slide').each((i, slide) => {
      slidesHtml.push($.html(slide));
    });

    // Extract original style tags from the head
    const styleTags = $('head').html();

    if (slidesHtml.length === 0) {
        return NextResponse.json({ error: 'No slides found. Make sure to wrap your slides in <div class="slide">.' }, { status: 400 });
    }

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    
    // Set a viewport that matches standard presentation dimensions (16:9)
    await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 2 });
    
    const images: string[] = [];

    for (let i = 0; i < slidesHtml.length; i++) {
      const slideHtml = slidesHtml[i];

      // Construct temporary HTML for each slide, including original styles and a wrapper
      const tempHtml = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            ${styleTags}
            <style>
              body { margin: 0; padding: 0; }
              #wrapper {
                width: 960px;
                height: 540px;
                display: flex;
                justify-content: center;
                align-items: center;
                /* padding: 25px; <<< REMOVED */
                box-sizing: border-box; 
                overflow: hidden;
              }
              .slide {
                opacity: 1 !important;
                display: flex !important;
                position: relative !important;
                max-width: 100%;
                max-height: 100%;
              }
            </style>
          </head>
          <body>
            <div id="wrapper">
              ${slideHtml}
            </div>
          </body>
        </html>
      `;
      
      await page.setContent(tempHtml, { waitUntil: 'load' });
      await new Promise(r => setTimeout(r, 100)); // Give client-side scripts/styles time to apply
      
      const screenshotBuffer = await page.screenshot({ type: 'png' });
      images.push(`data:image/png;base64,${screenshotBuffer.toString('base64')}`);
    }

    await browser.close();

    return NextResponse.json({ images });

  } catch (error: any) {
    console.error('Error generating PPTX preview:', error);
    return NextResponse.json({ error: `Failed to generate preview: ${error.message}` }, { status: 500 });
  }
}

