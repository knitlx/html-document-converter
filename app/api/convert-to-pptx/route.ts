import { NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";
import { renderSlides } from "../_lib/puppeteer-slides";

export async function POST(request: Request) {
  try {
    const { htmlContent } = await request.json();
    if (!htmlContent) {
      return NextResponse.json({ error: "HTML content is required" }, { status: 400 });
    }

    const { buffers, slideWidth, slideHeight } = await renderSlides(htmlContent);

    const pptx = new PptxGenJS();
    const inchW = slideWidth / 96;
    const inchH = slideHeight / 96;
    pptx.defineLayout({ name: 'CUSTOM', width: inchW, height: inchH });
    pptx.layout = 'CUSTOM';

    for (const buffer of buffers) {
      const slide = pptx.addSlide();
      slide.addImage({
        data: `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`,
        x: 0, y: 0, w: '100%', h: '100%',
      });
    }

    const pptxBuffer = await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer;
    return new NextResponse(new Uint8Array(pptxBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": "attachment; filename=\"converted.pptx\"",
      },
    });
  } catch (error: unknown) {
    console.error("Error converting HTML to PPTX:", error);
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
