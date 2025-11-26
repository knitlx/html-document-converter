import { NextRequest, NextResponse } from 'next/server';
import { load } from 'cheerio';

let puppeteer: any;
let chromium: any;

export async function POST(req: NextRequest) {
  try {
    const { htmlContent } = await req.json();
    if (!htmlContent) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    const isVercel =
      process.env.VERCEL_ENV === 'production' ||
      process.env.VERCEL_ENV === 'preview';

    if (isVercel) {
      puppeteer = require('puppeteer-core');
      chromium = require('@sparticuz/chromium-min');
    } else {
      puppeteer = require('puppeteer');
    }

    const browser = await puppeteer.launch({
      args: isVercel ? [...chromium.args] : [],
      defaultViewport: chromium.defaultViewport,
      executablePath: isVercel ? await chromium.executablePath() : undefined,
      headless: true,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 540, deviceScaleFactor: 2 });

    const $ = load(htmlContent);

    const slides: string[] = [];
    $('div.slide').each((_, el) => slides.push($.html(el) || ''));
    if (slides.length === 0) slides.push(htmlContent);

    const cssText: string[] = [];
    $('style').each((_, el) => cssText.push($(el).text() || ''));

    const linkTags: string[] = [];
    $('link[rel="stylesheet"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) linkTags.push(`<link rel="stylesheet" href="${href}">`);
    });

    const images: string[] = [];

    for (const slide of slides) {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            ${linkTags.join('\n')}
            <style>${cssText.join('\n')}</style>
          </head>
          <body>
            <div style="width:960px;height:540px">${slide}</div>
          </body>
        </html>
      `;

      await page.setContent(html, { waitUntil: 'networkidle0' });

      const buf = await page.screenshot({ type: 'png' });
      images.push(`data:image/png;base64,${buf.toString('base64')}`);
    }

    await browser.close();

    return NextResponse.json({
      images,
      slideCount: images.length,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 });
  }
}
