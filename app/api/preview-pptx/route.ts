import { NextRequest, NextResponse } from 'next/server';
import { load } from 'cheerio';
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
      headless: true,  // Unified: true for stability across envs
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 2 });  // Match PPTX layout

    // Parse slides for preview consistency with PPTX
    const $ = load(htmlContent);
    const slidesHtml: string[] = [];
    $('div.slide').each((_, element) => {
      slidesHtml.push($.html(element) || '');
    });
    if (slidesHtml.length === 0) {
      slidesHtml.push(htmlContent);  // Fallback: single slide
    }

    // Extract full styles (text for inline, links separate)
    const cssText: string[] = [];
    $('style').each((_, element) => {
      cssText.push($(element).text() || '');  // text() for clean CSS, no tags
    });
    const linkTags: string[] = [];
    $('link[rel="stylesheet"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        linkTags.push(`<link rel="stylesheet" href="${href}">`);
      }
    });

    // Generate screenshots for each slide (for visual preview)
    const slideImages: string[] = [];
    for (const slideHtmlContent of slidesHtml) {
      // Fixed multi-line template: Indented, ${join('\n')} intact
      const fullHtml = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${linkTags.join('\n')}  <!-- External stylesheets -->
            <style>
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
              .slide-wrapper { width: 960px; height: 540px; overflow: hidden; box-sizing: border-box; background-color: white; display: block; }
              p, h1, h2, h3, h4, h5, h6, ul, ol, li { color: black !important; margin: 0.5em 0 !important; padding: 0 !important; }
              b, strong { font-weight: bold !important; }
              i, em { font-style: italic !important; }
              u { text-decoration: underline !important; }
              ${cssText.join('\n')}  <!-- Fixed: Full CSS text joined with \n -->
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

      const screenshotBuffer = await page.screenshot({
        type: 'png',
        fullPage: false,
        clip: { x: 0, y: 0, width: 960, height: 540 },  // Match viewport for slide preview
      });
      slideImages.push(`data:image/png;base64,${screenshotBuffer.toString('base64')}`);
    }

    await browser.close();

    // Generate HTML preview with embedded images (for multi-slide carousel in UI)
    let previewHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
            .preview-container { display: flex; flex-direction: column; gap: 10px; }
            .slide-preview { max-width: 960px; height: 540px; border: 1px solid #ccc; }
            b, strong { font-weight: bold !important; }
            i, em { font-style: italic !important; }
            u { text-decoration: underline !important; }
            ${cssText.join('\n')}
          </style>
        </head>
        <body>
          <div class="preview-container">
            ${slideImages.map((img, idx) => `<img src="${img}" alt="Slide ${idx + 1}" class="slide-preview">`).join('')}
          </div>
          <script>
            // Optional: Simple carousel if multi-slide
            if (document.querySelectorAll('.slide-preview').length > 1) {
              console.log('Multi-slide preview ready');
            }
          </script>
        </body>
      </html>
    `;

    // Return JSON for flexible UI (HTML + images array)
    return NextResponse.json(
      { 
        previewHtml, 
        images: slideImages,  // Base64 for direct <img> in frontend
        slideCount: slideImages.length 
      }, 
      { status: 200 }
    );
  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 });
  }
}