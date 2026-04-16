import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer'; // Use full puppeteer package
import { load } from 'cheerio'; // Import cheerio

export async function POST(request: Request) {
  try {
    const { htmlContent } = await request.json();

    if (!htmlContent) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    const browser = await puppeteer.launch({
      headless: true, // Always headless for server-side operations
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process'
      ],
      ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}),
    });

    const page = await browser.newPage();

    // 1. Load HTML and extract slides and styles using cheerio
    const $ = load(htmlContent);
    const slideElements = $('div.slide').toArray();
    const slidesHtml: string[] = slideElements.map(slide => $.html(slide));

    // Extract original style tags from the head
    const styleTags = $('head').html();
    
    // Parse CSS to extract all background url() from all selectors
    const cssRules = styleTags || '';
    
    // Extract all CSS rules with background url()
    const cssRuleRegex = /([^{]+)\{([^}]*)\}/g;
    const backgroundMap: Record<string, string> = {};
    
    let match;
    while ((match = cssRuleRegex.exec(cssRules)) !== null) {
      const selector = match[1].trim();
      const styles = match[2];
      const backgroundMatch = styles.match(/background:\s*url\(['"]([^'"]+)['"]\)/);
      if (backgroundMatch) {
        backgroundMap[selector] = backgroundMatch[1];
      }
    }
    
    // Remove all background url() rules from CSS to avoid conflicts
    const cleanedCss = cssRules.replace(/background:\s*url\(['"][^'"]+['"]\)/g, 'background: none');

    if (slidesHtml.length === 0) {
        return NextResponse.json({ error: 'No slides found. Make sure to wrap your slides in <div class="slide">.' }, { status: 400 });
    }

    await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 2 });

    const images: string[] = [];

    for (let i = 0; i < slidesHtml.length; i++) {
      const slideIndex = i + 1;
      
      let modifiedSlideHtml = slidesHtml[i];
      
      // Apply backgrounds inline based on selectors
      for (const [selector, backgroundUrl] of Object.entries(backgroundMap)) {
        // Handle nth-child selectors (including combined selectors like .slides-track .slide:nth-child(1))
        if (selector.includes(':nth-child')) {
          const nthMatch = selector.match(/:nth-child\((\d+)\)/);
          if (nthMatch) {
            const nthIndex = parseInt(nthMatch[1]);
            if (nthIndex === slideIndex) {
              modifiedSlideHtml = modifiedSlideHtml.replace(
                /<div class="slide">/,
                `<div class="slide" style="background: url('${backgroundUrl}') center/cover no-repeat;"`
              );
            }
          }
        }
        // Handle class selectors
        else if (selector.startsWith('.')) {
          const className = selector.substring(1);
          modifiedSlideHtml = modifiedSlideHtml.replace(
            new RegExp(`class="[^"]*\\b${className}\\b[^"]*"`, 'g'),
            (match) => {
              if (!match.includes('style=')) {
                return match.replace('class="', `style="background: url('${backgroundUrl}') center/cover no-repeat;" class="`);
              }
              return match;
            }
          );
        }
        // Handle ID selectors
        else if (selector.startsWith('#')) {
          const idName = selector.substring(1);
          modifiedSlideHtml = modifiedSlideHtml.replace(
            new RegExp(`id="${idName}"`, 'g'),
            `id="${idName}" style="background: url('${backgroundUrl}') center/cover no-repeat;"`
          );
        }
      }
      
      // Construct temporary HTML for each slide, including original styles and a wrapper
      const tempHtml = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <style>${cleanedCss}</style>
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
              ${modifiedSlideHtml}
            </div>
          </body>
        </html>
      `;

      await page.setContent(tempHtml, { waitUntil: 'load' });
      await new Promise(r => setTimeout(r, 100)); // Give client-side scripts/styles time to apply

      const screenshotBuffer = await page.screenshot({ type: 'png' });
      images.push(`data:image/png;base64,${Buffer.from(screenshotBuffer).toString('base64')}`);
    }

    await browser.close();

    return NextResponse.json({ images });

  } catch (error: unknown) {
    console.error('Error generating PPTX preview:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to generate preview: ${message}` }, { status: 500 });
  }
}