import { NextResponse } from "next/server";
import puppeteer from "puppeteer"; // Use full puppeteer package
import { load } from "cheerio";
import PptxGenJS from "pptxgenjs";

export async function POST(request: Request) {
  try {
    const { htmlContent } = await request.json();

    if (!htmlContent) {
      return NextResponse.json({ error: "HTML content is required" }, { status: 400 });
    }

    console.log('Received HTML content for PPTX conversion');
    console.log('HTML length:', htmlContent.length);
    console.log('First 500 chars:', htmlContent.substring(0, 500));
    
    // Check for data URIs in the HTML
    const dataUriCount = (htmlContent.match(/data:image/g) || []).length;
    console.log('Number of data:image URIs found:', dataUriCount);

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
    await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 2 });

    // 1. Load HTML and extract slides and styles
    const $ = load(htmlContent);
    const slideElements = $('div.slide').toArray();
    const slidesHtml: string[] = slideElements.map(slide => $.html(slide));

    const styleTags = $('head').html(); // Extract original style tags from the head
    
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
                                                                                
    const screenshotBuffers: Uint8Array[] = [];                                     
                                                                                
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
              }
              .slide {
                opacity: 1 !important;
                display: flex !important;
                position: relative !important;
                /* The slide should be flexible, the wrapper will constrain it */
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
      await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 2 });
                                                                                
      // Screenshot the entire viewport, which is staged by the #wrapper        
      const screenshot = await page.screenshot();                               
      screenshotBuffers.push(screenshot);                                       
    }
    await browser.close();                                                      
                                                                                
    // 3. Generate PPTX                                                         
    const pptx = new PptxGenJS();                                               
    pptx.layout = 'LAYOUT_WIDE';                                                
                                                                                
    for (const buffer of screenshotBuffers) {
      const slide = pptx.addSlide();
      slide.addImage({
        data: `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`,
        x: 0,
        y: 0,
        w: '100%',
        h: '100%',
      });
    }
                                                                                
    // 4. Send the PPTX file to the client                                      
    const pptxBuffer = await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer;                         

    return new NextResponse(new Uint8Array(pptxBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": "attachment; filename=\"converted.pptx\"",
      },
    });
                                                                                
  } catch (error: unknown) {
    console.error("Error converting HTML to PPTX:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
