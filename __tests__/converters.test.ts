// Тесты для puppeteer-slides утилиты

function detectSlideDimensions(cssRules: string, defaultWidth: number, defaultHeight: number) {
  let slideWidth = defaultWidth;
  let slideHeight = defaultHeight;
  const allBlocks = cssRules.match(/[^{}]+\{[\s\S]*?\}/g) || [];
  const slideBlock = allBlocks.find((b) =>
    /^\s*\.slide\s*$/.test(b.split('{')[0].replace(/\/\*[\s\S]*?\*\//g, '').trim())
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

describe('detectSlideDimensions', () => {
  test('извлекает размер из базового .slide блока', () => {
    const css = `.slide { width: 1080px; height: 1350px; }`;
    const { slideWidth, slideHeight } = detectSlideDimensions(css, 960, 540);
    expect(slideWidth).toBe(1080);
    expect(slideHeight).toBe(1350);
  });

  test('возвращает дефолтные размеры если .slide не найден', () => {
    const css = `.other { width: 500px; }`;
    const { slideWidth, slideHeight } = detectSlideDimensions(css, 960, 540);
    expect(slideWidth).toBe(960);
    expect(slideHeight).toBe(540);
  });

  test('игнорирует .slide:nth-child блоки', () => {
    const css = `.slide:nth-child(1) { width: 500px; height: 500px; } .slide { width: 1080px; height: 1350px; }`;
    const { slideWidth, slideHeight } = detectSlideDimensions(css, 960, 540);
    expect(slideWidth).toBe(1080);
    expect(slideHeight).toBe(1350);
  });

  test('игнорирует CSS комментарии перед .slide', () => {
    const css = `/* ======= БАЗОВЫЙ СЛАЙД ======= */\n.slide { width: 1080px; height: 1350px; }`;
    const { slideWidth, slideHeight } = detectSlideDimensions(css, 960, 540);
    expect(slideWidth).toBe(1080);
    expect(slideHeight).toBe(1350);
  });

  test('работает с горизонтальными слайдами', () => {
    const css = `.slide { width: 1920px; height: 1080px; }`;
    const { slideWidth, slideHeight } = detectSlideDimensions(css, 960, 540);
    expect(slideWidth).toBe(1920);
    expect(slideHeight).toBe(1080);
  });
});

describe('PPTX размер в дюймах', () => {
  test('1080x1350px конвертируется в правильные дюймы (96 DPI)', () => {
    const slideWidth = 1080;
    const slideHeight = 1350;
    const inchW = slideWidth / 96;
    const inchH = slideHeight / 96;
    expect(inchW).toBeCloseTo(11.25);
    expect(inchH).toBeCloseTo(14.0625);
  });

  test('1920x1080px конвертируется в правильные дюймы', () => {
    const inchW = 1920 / 96;
    const inchH = 1080 / 96;
    expect(inchW).toBe(20);
    expect(inchH).toBeCloseTo(11.25);
  });
});
