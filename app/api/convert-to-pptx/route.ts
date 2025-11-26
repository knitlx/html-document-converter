import { NextResponse } from "next/server";
import { load } from "cheerio";
import PptxGenJS from "pptxgenjs";

// Declare global ProcessEnv for TypeScript to recognize VERCEL_ENV
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      VERCEL_ENV: string | undefined;
    }
  }
}

export async function POST(request: Request) {
  let puppeteerModule: any;
  let chromiumModule: any;

  const isRender = process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview' || process.env.RENDER === 'true';

  if (isRender) {
    puppeteerModule = require('puppeteer-core');
    chromiumModule = require('@sparticuz/chromium-min');
  } else {
    // Local development
    puppeteerModule = require('puppeteer');
    chromiumModule = {}; // Dummy object for local dev, properties won't be accessed
  }

  try {
    const { htmlContent } = await request.json();

    if (!htmlContent) {
      return NextResponse.json({ error: "HTML content is required" }, { status: 400 });
    }

    // 1. Load HTML and extract slides and styles
    const $ = load(htmlContent);
    const slidesHtml: string[] = [];
    $('div.slide').each((i, slide) => {
      slidesHtml.push($.html(slide));
    });

    const styleTags = $('head').html();
                                                                                
    // 2. Take screenshots of each slide                                        
    const launchOptions: any = { // Use 'any' for launchOptions to handle dynamic properties
      headless: true, // Consistent: true works everywhere
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // Recommended args for robustness
    };

    if (isRender) {
      launchOptions.args = [...chromiumModule.args, '--hide-scrollbars', '--disable-web-security'];
      launchOptions.defaultViewport = chromiumModule.defaultViewport;
      launchOptions.executablePath = await chromiumModule.executablePath();
    } else {
      // For local development, puppeteer finds its own executablePath.
      // Use puppeteer's default viewport.
      // No specific executablePath is set, puppeteer will auto-detect.
    }

    const browser = await puppeteerModule.launch(launchOptions);                 
    const page = await browser.newPage();                                       
    const screenshotBuffers: Uint8Array[] = [];                                     
                                                                                
    for (const slideHtml of slidesHtml) {
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
              ${slideHtml}
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
                                                                                
  } catch (error: any) {
    console.error("Error converting HTML to PPTX:", error);
    return NextResponse.json({ error: error.message || "An unknown error occurred" }, { status: 500 });
  }
}
