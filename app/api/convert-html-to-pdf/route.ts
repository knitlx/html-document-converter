import { NextRequest, NextResponse } from 'next/server';
import { Buffer } from 'buffer';

const IS_VERCEL = process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview';

let puppeteer;
let chromium;

if (IS_VERCEL) {
  puppeteer = require('puppeteer-core');
  chromium = require('@sparticuz/chromium');
} else {
  // Use the full puppeteer package installed as a devDependency for local development
  puppeteer = require('puppeteer');
}

export async function POST(req: NextRequest) {
  try {
    const { htmlContent, options } = await req.json();

    if (!htmlContent) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    console.log('Using direct binary buffer method. Received options:', options);

    const browser = await puppeteer.launch(
      IS_VERCEL
        ? {
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
          }
        : {
            // Local development: puppeteer will find a local Chromium install
            headless: true, // Use true for local headless, or false for visible browser
          }
    );
    const page = await browser.newPage();

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfOptions = {
      format: 'A4' as const,
      printBackground: true,
      margin: options?.margin,
    };

    const pdfBuffer = await page.pdf(pdfOptions);

    await browser.close();

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
  }
}