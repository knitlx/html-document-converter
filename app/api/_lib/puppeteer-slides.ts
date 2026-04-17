import puppeteer, { Browser, Page } from "puppeteer";
import { load } from "cheerio";

export interface SlideRenderOptions {
  deviceScaleFactor?: number;
}

export interface SlideRenderResult {
  buffers: Uint8Array[];
  slideWidth: number;
  slideHeight: number;
}

function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--single-process",
    ],
    ...(process.env.CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
      : {}),
  });
}

function detectSlideDimensions(
  cssRules: string,
  defaultWidth: number,
  defaultHeight: number
): { slideWidth: number; slideHeight: number } {
  let slideWidth = defaultWidth;
  let slideHeight = defaultHeight;
  const allBlocks = cssRules.match(/[^{}]+\{[\s\S]*?\}/g) || [];
  const slideBlock = allBlocks.find((b) =>
    /^\s*\.slide\s*$/.test(
      b
        .split("{")[0]
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim()
    )
  );
  if (slideBlock) {
    const wMatch = slideBlock.match(/width:\s*(\d+)px/);
    const hMatch = slideBlock.match(/height:\s*(\d+)px/);
    if (wMatch && hMatch) {
      slideWidth = parseInt(wMatch[1]);
      slideHeight = parseInt(hMatch[1]);
    }
  }
  return { slideWidth, slideHeight };
}

async function makeAllSlidesVisible(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Collect strict ancestors of div.slide (carousel containers only, not the slides themselves)
    const slideAncestors = new Set<Element>();
    document.querySelectorAll("div.slide").forEach((slide) => {
      let el = slide.parentElement;
      while (el && el !== document.body) {
        slideAncestors.add(el);
        el = el.parentElement;
      }
    });
    // Also collect the slides themselves so we can EXCLUDE them from overflow removal
    const slides = new Set<Element>(document.querySelectorAll("div.slide"));

    document.querySelectorAll("*").forEach((el) => {
      const e = el as HTMLElement;
      if (!e.style) return;
      const computed = window.getComputedStyle(e);
      // Only touch carousel ancestors — never modify anything inside slides
      if (slideAncestors.has(el) && !slides.has(el)) {
        if (computed.transform !== "none") {
          e.style.transform = "none";
          e.style.marginBottom = "0";
        }
        e.style.maxWidth = "none";
        e.style.maxHeight = "none";
        if (computed.overflow === "hidden") {
          e.style.overflow = "visible";
        }
      }
    });
    const firstSlide = document.querySelector("div.slide") as HTMLElement;
    if (firstSlide && firstSlide.parentElement) {
      const parent = firstSlide.parentElement as HTMLElement;
      parent.style.display = "flex";
      parent.style.flexDirection = "column";
      parent.style.flexWrap = "nowrap";
      parent.style.width = "max-content";
      parent.style.height = "auto";
      parent.style.alignItems = "flex-start";
      parent.style.transform = "none";
      parent.style.transition = "none";
    }
    const body = document.querySelector("body") as HTMLElement;
    if (body) {
      body.style.setProperty("padding", "0", "important");
      body.style.setProperty("margin", "0", "important");
      body.style.setProperty("display", "block", "important");
      body.style.setProperty("min-height", "unset", "important");
      body.style.setProperty("align-items", "unset", "important");
      body.style.setProperty("justify-content", "unset", "important");
    }
  });
}

export async function renderSlides(
  htmlContent: string,
  options: SlideRenderOptions = {}
): Promise<SlideRenderResult> {
  const { deviceScaleFactor = 2 } = options;

  const $ = load(htmlContent);
  const slideCount = $("div.slide").length;
  if (slideCount === 0) {
    throw new Error('No slides found. Make sure to wrap your slides in <div class="slide">.');
  }

  const cssRules = $("head").html() || "";
  const { slideWidth, slideHeight } = detectSlideDimensions(cssRules, 1080, 1080);
  console.log(`Slides: ${slideCount}, size: ${slideWidth}x${slideHeight}`);

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: slideWidth + 100,
      height: (slideHeight + 100) * slideCount,
      deviceScaleFactor,
    });
    await page.setContent(htmlContent, { waitUntil: "load", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 500));
    await makeAllSlidesVisible(page);
    await new Promise((r) => setTimeout(r, 200));

    const slideElements = await page.$$("div.slide");
    const buffers: Uint8Array[] = [];

    for (let i = 0; i < slideElements.length; i++) {
      const box = await slideElements[i].boundingBox();
      if (!box) {
        console.log(`Could not get bounding box for slide ${i + 1}`);
        continue;
      }
      const screenshot = await page.screenshot({
        clip: { x: box.x, y: box.y, width: slideWidth, height: slideHeight },
        type: 'jpeg',
        quality: 85,
      });
      buffers.push(screenshot);
      console.log(`Slide ${i + 1} captured, box:`, box);
    }

    return { buffers, slideWidth, slideHeight };
  } finally {
    await browser.close();
  }
}
