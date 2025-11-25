// app/api/convert-html-to-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'buffer';

// Explicitly import all types and the value 'puppeteerCore' from puppeteer-core
import puppeteerCore, { Browser, LaunchOptions, PDFOptions } from 'puppeteer-core';
// Import chromium for its types and executablePath function
import * as chromium from '@sparticuz/chromium';

// Type definitions for process.env
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      VERCEL_ENV: string | undefined;
      // NODE_ENV is already globally defined by @types/node
    }
  }
}

export async function POST(req: NextRequest) {
  let browser: Browser | undefined;
  // Declare puppeteer with a union type to accommodate conditional loading
  let puppeteer: typeof puppeteerCore;

  const isVercel = process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview';

  if (isVercel) {
    // In Vercel, use puppeteer-core (which is already imported as puppeteerCore)
    puppeteer = puppeteerCore;
  } else {
    // In local development, try to use the full 'puppeteer' package
    try {
      // eslint-disable-next-line global-require
      puppeteer = require('puppeteer');
    } catch (error) {
      console.warn('Full puppeteer not found locally. Falling back to puppeteer-core.', error);
      puppeteer = puppeteerCore; // Fallback to puppeteerCore if full puppeteer is not available
    }
  }

  try {
    const { htmlContent, options } = await req.json();

    if (!htmlContent) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    console.log('Using direct binary buffer method. Received options:', options);

    browser = await puppeteer.launch({
      args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
      defaultViewport: chromium.defaultViewport,
      executablePath: isVercel ? await chromium.executablePath() : undefined, // Let chromium resolve path on Vercel, puppeteer finds it locally
      headless: isVercel ? chromium.headless : true, // Use chromium.headless for Vercel, true for local
    } as LaunchOptions); // Cast to LaunchOptions for type safety

    const page = await browser.newPage();

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfOptions: PDFOptions = {
      format: 'A4' as const,
      printBackground: true,
      margin: options?.margin,
    };

    const pdfBuffer = await page.pdf(pdfOptions);

    if (!pdfBuffer) {
      throw new Error('PDF generation resulted in an empty buffer.');
    }
    
    console.log(`Successfully generated PDF buffer. Length: ${pdfBuffer.length}`);

    // Return the raw PDF buffer directly, ensuring it's a Buffer type for NextResponse
    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdfBuffer.length),
      },
    });

  } catch (error) {
    console.error('Error using direct buffer method:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: `Failed to convert HTML to PDF: ${errorMessage}` }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}