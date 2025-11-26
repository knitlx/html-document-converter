import { NextRequest, NextResponse } from 'next/server';

let puppeteer: any;
let chromium: any;

export async function POST(req: NextRequest) {
  try {
    const { htmlContent, options } = await req.json();

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
    await page.setViewport({ width: 794, height: 1123 });

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: options?.margin ?? {
        top: '1cm',
        bottom: '1cm',
        left: '1cm',
        right: '1cm',
      },
    });

    await browser.close();

    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=converted.pdf',
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'PDF conversion failed' }, { status: 500 });
  }
}
