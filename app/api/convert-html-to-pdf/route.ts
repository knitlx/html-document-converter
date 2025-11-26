import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import * as chromium from '@sparticuz/chromium-min';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      VERCEL_ENV: string | undefined;
    }
  }
}

interface ConversionOptions {
  margin?: puppeteer.MarginOptions;
}

export async function POST(req: NextRequest) {
  try {
    const { htmlContent, options }: { htmlContent: string; options?: ConversionOptions } = await req.json();
    if (!htmlContent) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    const isVercel = process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview';

    const browser = await puppeteer.launch({
      args: isVercel ? [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'] : [],
      defaultViewport: chromium.defaultViewport,
      executablePath: isVercel ? await chromium.executablePath() : undefined,
      headless: true,  // Unified: true for both (avoids deprecation/mismatch)
      ignoreHTTPSErrors: true,  // For HTTPS resources in HTML
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });  // A4 at 96dpi (CSS pixels)
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    const pdfOptions: puppeteer.PDFOptions = {
      format: 'A4' as const,
      printBackground: true,
      margin: options?.margin || { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },  // Default margins
    };

    const pdfBuffer = await page.pdf(pdfOptions);
    await browser.close();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=converted.pdf',
        'Content-Length': pdfBuffer.length.toString(),  // For progress bars
      },
    });
  } catch (error) {
    console.error('PDF conversion error:', error);
    return NextResponse.json({ error: 'PDF conversion failed' }, { status: 500 });
  }
}