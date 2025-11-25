// app/api/convert-html-to-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'buffer';

// Import types for puppeteer (used for local development)
import type * as pp from 'puppeteer';
// Import types for puppeteer-core and its associated types
import type * as ppc from 'puppeteer-core';

// Type definitions for process.env
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      VERCEL_ENV: string | undefined;
    }
  }
}

export async function POST(req: NextRequest) {
  let browser: pp.Browser | ppc.Browser | undefined; // Use union type for browser
  let puppeteer: typeof pp | typeof ppc;
  let chromium: typeof import('@sparticuz/chromium');

  const isVercel = process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview';

  if (isVercel) {
    // Dynamically import for Vercel
    puppeteer = require('puppeteer-core');
    chromium = require('@sparticuz/chromium');
  } else {
    // Dynamically import for local development
    try {
      puppeteer = require('puppeteer');
      // For local development, we don't strictly need @sparticuz/chromium
      // But we keep the import to satisfy the 'chromium' variable type
      chromium = require('@sparticuz/chromium'); // Still load for its args/defaultViewport
    } catch (error) {
      console.warn('Full puppeteer not found locally. Falling back to puppeteer-core.', error);
      puppeteer = require('puppeteer-core');
      chromium = require('@sparticuz/chromium');
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
    });

    const page = await browser.newPage();

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfOptions: pp.PDFOptions | ppc.PDFOptions = { // Use union type for PDFOptions
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
