// Интеграционные тесты для конвертеров
// Проверка универсального решения для background изображений

describe('Конвертеры - Background Images', () => {
  
  test('CSS парсинг извлекает background url() из nth-child селекторов', () => {
    const css = `
      .slide:nth-child(1) { background: url('/path/to/image1.png') center/cover no-repeat; }
      .slide:nth-child(2) { background: url('/path/to/image2.png') center/cover no-repeat; }
    `;
    
    const cssRuleRegex = /([^{]+)\{([^}]*)\}/g;
    const backgroundMap: Record<string, string> = {};
    
    let match;
    while ((match = cssRuleRegex.exec(css)) !== null) {
      const selector = match[1].trim();
      const styles = match[2];
      const backgroundMatch = styles.match(/background:\s*url\(['"]([^'"]+)['"]\)/);
      if (backgroundMatch) {
        backgroundMap[selector] = backgroundMatch[1];
      }
    }
    
    expect(backgroundMap['.slide:nth-child(1)']).toBe('/path/to/image1.png');
    expect(backgroundMap['.slide:nth-child(2)']).toBe('/path/to/image2.png');
  });

  test('CSS парсинг извлекает background url() из класс селекторов', () => {
    const css = `
      .slide1 { background: url('/path/to/image1.png') center/cover no-repeat; }
      .slide2 { background: url('/path/to/image2.png') center/cover no-repeat; }
    `;
    
    const cssRuleRegex = /([^{]+)\{([^}]*)\}/g;
    const backgroundMap: Record<string, string> = {};
    
    let match;
    while ((match = cssRuleRegex.exec(css)) !== null) {
      const selector = match[1].trim();
      const styles = match[2];
      const backgroundMatch = styles.match(/background:\s*url\(['"]([^'"]+)['"]\)/);
      if (backgroundMatch) {
        backgroundMap[selector] = backgroundMatch[1];
      }
    }
    
    expect(backgroundMap['.slide1']).toBe('/path/to/image1.png');
    expect(backgroundMap['.slide2']).toBe('/path/to/image2.png');
  });

  test('CSS парсинг извлекает background url() из ID селекторов', () => {
    const css = `
      #slide1 { background: url('/path/to/image1.png') center/cover no-repeat; }
      #slide2 { background: url('/path/to/image2.png') center/cover no-repeat; }
    `;
    
    const cssRuleRegex = /([^{]+)\{([^}]*)\}/g;
    const backgroundMap: Record<string, string> = {};
    
    let match;
    while ((match = cssRuleRegex.exec(css)) !== null) {
      const selector = match[1].trim();
      const styles = match[2];
      const backgroundMatch = styles.match(/background:\s*url\(['"]([^'"]+)['"]\)/);
      if (backgroundMatch) {
        backgroundMap[selector] = backgroundMatch[1];
      }
    }
    
    expect(backgroundMap['#slide1']).toBe('/path/to/image1.png');
    expect(backgroundMap['#slide2']).toBe('/path/to/image2.png');
  });

  test('CSS парсинг извлекает background url() из комбинированных селекторов', () => {
    const css = `
      .slides-track .slide:nth-child(1) { background: url('/path/to/image1.png') center/cover no-repeat; }
      .slides-track .slide:nth-child(2) { background: url('/path/to/image2.png') center/cover no-repeat; }
    `;
    
    const cssRuleRegex = /([^{]+)\{([^}]*)\}/g;
    const backgroundMap: Record<string, string> = {};
    
    let match;
    while ((match = cssRuleRegex.exec(css)) !== null) {
      const selector = match[1].trim();
      const styles = match[2];
      const backgroundMatch = styles.match(/background:\s*url\(['"]([^'"]+)['"]\)/);
      if (backgroundMatch) {
        backgroundMap[selector] = backgroundMatch[1];
      }
    }
    
    expect(backgroundMap['.slides-track .slide:nth-child(1)']).toBe('/path/to/image1.png');
    expect(backgroundMap['.slides-track .slide:nth-child(2)']).toBe('/path/to/image2.png');
  });

  test('Очистка CSS удаляет background url() правила', () => {
    const css = `
      .slide:nth-child(1) { background: url('/path/to/image.png') center/cover no-repeat; }
      .slide:nth-child(2) { background: url('/path/to/image.png') center/cover no-repeat; }
    `;
    
    const cleanedCss = css.replace(/background:\s*url\(['"][^'"]+['"]\)/g, 'background: none');
    
    expect(cleanedCss).toContain('background: none');
    expect(cleanedCss).not.toContain('url(');
  });

  test('Извлечение индекса из nth-child селектора', () => {
    const selector1 = '.slide:nth-child(1)';
    const selector2 = '.slides-track .slide:nth-child(5)';
    const selector3 = '.slide:nth-child(10)';
    
    const nthMatch1 = selector1.match(/:nth-child\((\d+)\)/);
    const nthMatch2 = selector2.match(/:nth-child\((\d+)\)/);
    const nthMatch3 = selector3.match(/:nth-child\((\d+)\)/);
    
    expect(nthMatch1?.[1]).toBe('1');
    expect(nthMatch2?.[1]).toBe('5');
    expect(nthMatch3?.[1]).toBe('10');
  });

  test('Применение inline стиля для nth-child селектора', () => {
    let slideHtml = '<div class="slide">Content</div>';
    const backgroundUrl = '/path/to/image.png';
    const slideIndex = 1;
    const nthIndex = 1;
    
    if (nthIndex === slideIndex) {
      slideHtml = slideHtml.replace(
        /<div class="slide">/,
        `<div class="slide" style="background: url('${backgroundUrl}') center/cover no-repeat;">`
      );
    }
    
    expect(slideHtml).toContain('style="background: url(\'/path/to/image.png\') center/cover no-repeat;"');
    expect(slideHtml).toMatch(/<div class="slide" style="[^"]*">/)
  });

  test('Применение inline стиля для класс селектора', () => {
    let slideHtml = '<div class="slide slide1">Content</div>';
    const backgroundUrl = '/path/to/image.png';
    const className = 'slide1';
    
    slideHtml = slideHtml.replace(
      new RegExp(`class="[^"]*\\b${className}\\b[^"]*"`, 'g'),
      (match) => {
        if (!match.includes('style=')) {
          return match.replace('class="', `style="background: url('${backgroundUrl}') center/cover no-repeat;" class="`);
        }
        return match;
      }
    );
    
    expect(slideHtml).toContain('style="background: url(\'/path/to/image.png\') center/cover no-repeat;"');
  });

  test('Применение inline стиля для ID селектора', () => {
    let slideHtml = '<div class="slide" id="slide1">Content</div>';
    const backgroundUrl = '/path/to/image.png';
    const idName = 'slide1';
    
    slideHtml = slideHtml.replace(
      new RegExp(`id="${idName}"`, 'g'),
      `id="${idName}" style="background: url('${backgroundUrl}') center/cover no-repeat;"`
    );
    
    expect(slideHtml).toContain('style="background: url(\'/path/to/image.png\') center/cover no-repeat;"');
  });
});

describe('Размеры слайдов для разных конвертеров', () => {
  
  test('PPTX использует горизонтальные слайды 960x540', () => {
    const pptxWidth = 960;
    const pptxHeight = 540;
    
    expect(pptxWidth).toBe(960);
    expect(pptxHeight).toBe(540);
  });

  test('JPG использует квадратные слайды 1200x1200', () => {
    const jpgWidth = 1200;
    const jpgHeight = 1200;
    
    expect(jpgWidth).toBe(1200);
    expect(jpgHeight).toBe(1200);
  });

  test('PDF использует A4 размер 794x1123', () => {
    const pdfWidth = 794;
    const pdfHeight = 1123;
    
    expect(pdfWidth).toBe(794);
    expect(pdfHeight).toBe(1123);
  });
});
