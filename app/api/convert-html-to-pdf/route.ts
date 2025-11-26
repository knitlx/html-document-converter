import { NextRequest, NextResponse } from 'next/server';

let puppeteer: any;
let chromium: any;

interface ConversionOptions {
  margin?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const { htmlContent, options }: { htmlContent: string; options?: ConversionOptions } =
      await req.json();

    if (!htmlContent) {
      return NextResponse.json(
        { error: 'HTML content is required' },
        { status: 400 }
      );
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
      ignoreHTTPSErrors: true
    });

    const page = await browser.newPage();

    // A4 (794x1123) — корректный CSS пиксельный размер под PDF
    await page.setViewport({
      width: 794,
      height: 1123,
      deviceScaleFactor: 1,
    });

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
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

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=converted.pdf',
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (e) {
    console.error('PDF conversion error:', e);
    return NextResponse.json(
      { error: 'PDF conversion failed' },
      { status: 500 }
    );
  }
}
