import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'buffer';
import { load } from 'cheerio';
import PptxGenJS from 'pptxgenjs';

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
    if (!slides.length) slides.push(htmlContent);

    const css: string[] = [];
    $('style').each((_, el) => css.push($(el).html() || ''));

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16_9';

    for (const slide of slides) {
      const html = `
        <html>
        <head><style>${css.join('\n')}</style></head>
        <body><div style="width:960px;height:540px">${slide}</div></body>
        </html>
      `;

      await page.setContent(html, { waitUntil: 'networkidle0' });

      const buf = await page.screenshot({ type: 'png' });

      const s = pptx.addSlide();
      s.addImage({
        data: buf.toString('base64'),
        x: 0,
        y: 0,
        w: '100%',
        h: '100%',
      });
    }

    await browser.close();

    const arrBuf = (await pptx.write({
      outputType: 'arraybuffer',
    })) as ArrayBuffer;

    return new NextResponse(Buffer.from(arrBuf), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': 'attachment; filename=converted.pptx',
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'PPTX conversion failed' }, { status: 500 });
  }
}
