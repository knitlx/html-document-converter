// app/api/convert-html-to-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'buffer';

// Use direct imports for puppeteer-core and @sparticuz/chromium
// These are production dependencies for Vercel
import puppeteerCore, { Browser, LaunchOptions, PDFOptions } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Type definitions for process.env (optional but good practice)
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      VERCEL_ENV: string | undefined;
    }
  }
}

// Conditional require for local development using the full puppeteer package
let localPuppeteer: typeof puppeteerCore | undefined; // Use puppeteerCore type for consistency
if (process.env.NODE_ENV === 'development' && !process.env.VERCEL_ENV) {
  try {
    // eslint-disable-next-line global-require
    localPuppeteer = require('puppeteer');
  } catch (error) {
    console.warn('Full puppeteer not found locally, falling back to puppeteer-core.', error);
  }
}

export async function POST(req: NextRequest) {
  let browser: Browser | undefined; // Explicitly type browser
  try {
    const { htmlContent, options } = await req.json();

    if (!htmlContent) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    console.log('Using direct binary buffer method. Received options:', options);

    const isVercel = process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview';

    if (isVercel) {
      // For Vercel, use puppeteer-core with @sparticuz/chromium
      browser = await puppeteerCore.launch({
        args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      } as LaunchOptions); // Cast to LaunchOptions for type safety
    } else if (localPuppeteer) {
      // For local development, use the full puppeteer package (if found)
      browser = await localPuppeteer.launch({
        headless: true, // Use headless for local testing unless you need visual debugging
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    } else {
      // Fallback for local development if full puppeteer isn't available
      // This case means puppeteer-core will try to find a local Chrome
      console.warn('Neither Vercel environment nor full puppeteer found. Attempting to launch puppeteer-core locally.');
      browser = await puppeteerCore.launch({
        args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(), // puppeteer-core tries to find local Chrome
        headless: true,
      } as LaunchOptions);
    }

    const page = await browser.newPage();

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfOptions: PDFOptions = { // Explicitly type pdfOptions
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
