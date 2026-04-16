import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { load } from "cheerio";

export async function POST(request: Request) {
  try {
    const { htmlContent } = await request.json();

    if (!htmlContent) {
      return NextResponse.json({ error: "HTML content is required" }, { status: 400 });
    }

    console.log('Received HTML content for JPG conversion');
    console.log('HTML length:', htmlContent.length);
    console.log('First 500 chars:', htmlContent.substring(0, 500));
    
    // Check for data URIs in the HTML
    const dataUriCount = (htmlContent.match(/data:image/g) || []).length;
    console.log('Number of data:image URIs found:', dataUriCount);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process",
      ],
      ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}),
    });

    const page = await browser.newPage();

    const $ = load(htmlContent);
    const slideElements = $("div.slide").toArray();
    const slidesHtml = slideElements.map((slide) => $.html(slide));
    
    console.log('Number of slides found:', slidesHtml.length);
    console.log('First slide HTML (first 200 chars):', slidesHtml[0]?.substring(0, 200));

    const styleTags = $("head").html();
    
    // Parse CSS to extract all background url() from all selectors
    const cssRules = styleTags || '';
    console.log('CSS LENGTH:', cssRules.length);
    
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
        console.log(`FOUND BG for selector '${selector}':`, backgroundMatch[1].substring(0, 50) + '...');
      }
    }
    
    console.log('TOTAL BACKGROUND RULES:', Object.keys(backgroundMap).length);
    
    // Remove all background url() rules from CSS to avoid conflicts
    const cleanedCss = cssRules.replace(/background:\s*url\(['"][^'"]+['"]\)/g, 'background: none');
    console.log('CSS cleaned, removed background url() rules');

    if (slidesHtml.length === 0) {
      await browser.close();
      return NextResponse.json(
        { error: 'No slides found. Make sure to wrap your slides in <div class="slide">.' },
        { status: 400 }
      );
    }

    await page.setViewport({ width: 1200, height: 1200, deviceScaleFactor: 2 });

    const images: string[] = [];

    // Render each slide separately with inline backgrounds
    for (let i = 0; i < slideElements.length; i++) {
      const slideIndex = i + 1;
      console.log(`Processing slide ${slideIndex}/${slidesHtml.length}`);
      
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
                `<div class="slide" style="background: url('${backgroundUrl}') center/cover no-repeat;">`
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
      
      const tempHtml = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <style>${cleanedCss}</style>
            <style>
              body { margin: 0; padding: 0; }
              .slide {
                opacity: 1 !important;
                position: relative !important;
              }
            </style>
          </head>
          <body>
            ${modifiedSlideHtml}
          </body>
        </html>
      `;

      await page.setContent(tempHtml, { waitUntil: "load" });
      await new Promise((r) => setTimeout(r, 100));

      const slideElement = await page.$(".slide");
      if (!slideElement) {
        console.log(`Slide ${slideIndex} not found`);
        continue;
      }

      const box = await slideElement.boundingBox();
      if (!box) {
        console.log(`Could not get bounding box for slide ${slideIndex}`);
        continue;
      }

      console.log(`Slide ${slideIndex} bounding box:`, box);
      
      const screenshot = await page.screenshot({
        clip: box,
        encoding: "binary",
      });

      const base64 = Buffer.from(screenshot).toString("base64");
      images.push(`data:image/jpeg;base64,${base64}`);
      console.log(`Screenshot captured for slide ${slideIndex}`);
    }

    await browser.close();

    return NextResponse.json({ images });
  } catch (error: unknown) {
    console.error("Error converting HTML to JPG:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to convert to JPG: ${message}` }, { status: 500 });
  }
}
