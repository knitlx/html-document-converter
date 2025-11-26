import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { load } from "cheerio";
import PptxGenJS from "pptxgenjs";

export async function POST(request: Request) {
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
    const browser = await puppeteer.launch({ headless: true });                 
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
        data: `data:image/png;base64,${buffer.toString('base64')}`,
        x: 0,
        y: 0,
        w: '100%',
        h: '100%',
      });
    }
                                                                                
    // 4. Send the PPTX file to the client                                      
    const pptxBuffer = await pptx.write('arraybuffer');                         

    return new NextResponse(pptxBuffer, {
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