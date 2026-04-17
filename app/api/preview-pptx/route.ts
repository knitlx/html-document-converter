import { NextResponse } from 'next/server';
import { renderSlides } from '../_lib/puppeteer-slides';

export async function POST(request: Request) {
  try {
    const { htmlContent } = await request.json();
    if (!htmlContent) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    const { buffers } = await renderSlides(htmlContent);
    const images = buffers.map(
      (buf) => `data:image/jpeg;base64,${Buffer.from(buf).toString('base64')}`
    );

    return NextResponse.json({ images });
  } catch (error: unknown) {
    console.error('Error generating PPTX preview:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to generate preview: ${message}` }, { status: 500 });
  }
}