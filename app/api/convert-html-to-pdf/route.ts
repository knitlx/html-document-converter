import { NextRequest, NextResponse } from 'next/server';

// Declare global ProcessEnv for TypeScript to recognize VERCEL_ENV
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      VERCEL_ENV: string | undefined;
    }
  }
}

interface ConversionOptions {
  margin?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
}

export async function POST(req: NextRequest) {
  let puppeteerModule: any;
  let chromiumModule: any;

  const isRender = process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview' || process.env.RENDER === 'true'; // VERCEL_ENV is a general serverless flag, RENDER is specific

  if (isRender) {
    puppeteerModule = require('puppeteer-core');
    chromiumModule = require('@sparticuz/chromium-min');
  } else {
    // Local development
    puppeteerModule = require('puppeteer');
    chromiumModule = {}; // Dummy object for local dev, properties won't be accessed
  }

  try {
    const { htmlContent, options }: { htmlContent: string; options?: ConversionOptions } =
      await req.json();

    if (!htmlContent) {
      return NextResponse.json(
        { error: 'HTML content is required' },
        { status: 400 }
      );
    }

    const launchOptions: any = { // Use 'any' for launchOptions to handle dynamic properties
      headless: true, // Consistent: true works everywhere
      ignoreHTTPSErrors: true,
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

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf', // This should be application/pdf as we're sending Uint8Array
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