import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { load } from "cheerio";

export async function POST(request: Request) {
  try {
    const { htmlContent } = await request.json();

    if (!htmlContent) {
      return NextResponse.json({ error: "HTML content is required" }, { status: 400 });
    }

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
    const slidesHtml = $("div.slide").toArray().map((slide) => $.html(slide));

    const styleTags = $("head").html();

    if (slidesHtml.length === 0) {
      await browser.close();
      return NextResponse.json(
        { error: 'No slides found. Make sure to wrap your slides in <div class="slide">.' },
        { status: 400 }
      );
    }

    await page.setViewport({ width: 1200, height: 1200, deviceScaleFactor: 2 });

    const images: string[] = [];

    for (const slideHtml of slidesHtml) {
      const tempHtml = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            ${styleTags}
            <style>
              body { margin: 0; padding: 0; }
              .slide {
                opacity: 1 !important;
                position: relative !important;
              }
            </style>
          </head>
          <body>
            ${slideHtml}
          </body>
        </html>
      `;

      await page.setContent(tempHtml, { waitUntil: "load" });
      await new Promise((r) => setTimeout(r, 100));

      const slideElement = await page.$(".slide");
      if (!slideElement) {
        continue;
      }

      const box = await slideElement.boundingBox();
      if (!box) {
        continue;
      }

      const requiredViewportWidth = Math.max(1, Math.ceil(box.x + box.width));
      const requiredViewportHeight = Math.max(1, Math.ceil(box.y + box.height));
      const currentViewport = page.viewport();

      if (
        !currentViewport ||
        currentViewport.width < requiredViewportWidth ||
        currentViewport.height < requiredViewportHeight
      ) {
        await page.setViewport({
          width: requiredViewportWidth,
          height: requiredViewportHeight,
          deviceScaleFactor: 2,
        });
        await new Promise((r) => setTimeout(r, 50));
      }

      const actualBox = await slideElement.boundingBox();
      if (!actualBox) {
        continue;
      }

      const clippedX = Math.max(0, actualBox.x);
      const clippedY = Math.max(0, actualBox.y);
      const clippedWidth = Math.max(1, Math.ceil(actualBox.width));
      const clippedHeight = Math.max(1, Math.ceil(actualBox.height));

      const screenshotBuffer = await page.screenshot({
        type: "jpeg",
        quality: 92,
        clip: {
          x: clippedX,
          y: clippedY,
          width: clippedWidth,
          height: clippedHeight,
        },
      });
      images.push(`data:image/jpeg;base64,${Buffer.from(screenshotBuffer).toString("base64")}`);

      await slideElement.dispose();
    }

    await browser.close();

    return NextResponse.json({ images });
  } catch (error: unknown) {
    console.error("Error converting HTML to JPG:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to convert to JPG: ${message}` }, { status: 500 });
  }
}
