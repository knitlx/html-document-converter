"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

// --- Helper: Icon Components ---
const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);


// --- Background Wave Component ---
const WavyBackground = () => (
  <div className="absolute bottom-0 left-0 w-full h-96 overflow-hidden pointer-events-none">
    <svg className="absolute bottom-0 left-0 w-full h-auto" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320">
      <path 
        fill="rgba(191, 219, 254, 0.5)" // Tailwind blue-200 @ 50% opacity
        d="M0,192L48,176C96,160,192,128,288,133.3C384,139,480,181,576,186.7C672,192,768,160,864,133.3C960,107,1056,85,1152,96C1248,107,1344,149,1392,170.7L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z">
      </path>
    </svg>
  </div>
);


const PptxInstruction = () => (
  <div className="prose prose-sm max-w-none text-gray-600 bg-white/50 p-4 rounded-xl border-2 border-gray-300/60 shadow-sm">
    <h4 className="text-gray-800">Ожидаемый формат HTML для PPTX</h4>
    <p>
      Конвертер ищет в коде блоки <code>&lt;div class=&quot;slide&quot;&gt;</code>. Каждый такой блок будет преобразован в отдельный слайд-картинку в презентации.
    </p>
    <p>Все стили, необходимые для отображения слайдов, должны быть определены внутри тега <code>&lt;head&gt;</code> вашего HTML.</p>
    <pre><code className="text-xs">
{`<!DOCTYPE html>
<html>
<head>
  <style>
    .slide { background-color: #fff; }
    h1 { color: #333; }
  </style>
</head>
<body>
  <div class="slide">
    <h1>Слайд 1</h1>
  </div>
  <div class="slide">
    <h1>Слайд 2</h1>
  </div>
</body>
</html>`}
    </code></pre>
  </div>
);

const JpgInstruction = () => (
  <div className="prose prose-sm max-w-none text-gray-600 bg-white/50 p-4 rounded-xl border-2 border-gray-300/60 shadow-sm">
    <h4 className="text-gray-800">Ожидаемый формат HTML для JPG</h4>
    <p>
      Конвертер ищет в коде блоки <code>&lt;div class=&quot;slide&quot;&gt;</code>. Каждый такой блок будет сохранен как отдельный JPG-файл.
    </p>
    <p>Все стили, необходимые для отображения слайдов, должны быть определены внутри тега <code>&lt;head&gt;</code> вашего HTML.</p>
  </div>
);


export default function Home() {
  const [activeTab, setActiveTab] = useState<'pdf' | 'pptx' | 'jpg'>('pdf');
  const [htmlInput, setHtmlInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<Map<string, { base64: string; originalName: string }>>(new Map()); // filename -> {base64, originalName}
  const [imageMappings, setImageMappings] = useState<Map<string, string>>(new Map()); // htmlPath -> uploadedFilename
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // PDF specific state
  const [margins, setMargins] = useState({ top: "0", right: "0", bottom: "0", left: "0" });
  const [marginUnit, setMarginUnit] = useState("mm");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  // PPTX specific state
  const [pptxPreviewImages, setPptxPreviewImages] = useState<string[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  // JPG specific state
  const [jpgPreviewImages, setJpgPreviewImages] = useState<string[]>([]);
  const [currentJpgSlide, setCurrentJpgSlide] = useState(0);


  const handleHtmlInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => setHtmlInput(e.target.value);
  const handleMarginChange = (e: React.ChangeEvent<HTMLInputElement>) => setMargins(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => setMarginUnit(e.target.value);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setUploadedImages(prev => new Map(prev).set(file.name, { base64, originalName: file.name }));
      };
      reader.readAsDataURL(file);
    });
  };

  const setMapping = (htmlPath: string, uploadedFilename: string) => {
    setImageMappings(prev => new Map(prev).set(htmlPath, uploadedFilename));
  };

  const removeMapping = (htmlPath: string) => {
    setImageMappings(prev => {
      const newMap = new Map(prev);
      newMap.delete(htmlPath);
      return newMap;
    });
  };

  // Auto-map images based on filename matching
  useEffect(() => {
    if (htmlInput && uploadedImages.size > 0) {
      const paths = extractImagePaths(htmlInput);
      const newMappings = new Map<string, string>();
      
      paths.forEach(path => {
        const filename = path.split('/').pop() || path;
        const uploadedFile = Array.from(uploadedImages.keys()).find(key => {
          const uploadedFilename = key.split('/').pop() || key;
          return uploadedFilename === filename || uploadedFilename.includes(filename) || filename.includes(uploadedFilename);
        });
        
        if (uploadedFile) {
          newMappings.set(path, uploadedFile);
        }
      });
      
      setImageMappings(newMappings);
    }
  }, [htmlInput, uploadedImages]);

  const removeImage = (filename: string) => {
    setUploadedImages(prev => {
      const newMap = new Map(prev);
      newMap.delete(filename);
      return newMap;
    });
    // Also remove any mappings that used this file
    setImageMappings(prev => {
      const newMap = new Map(prev);
      for (const [htmlPath, uploadedFilename] of newMap) {
        if (uploadedFilename === filename) {
          newMap.delete(htmlPath);
        }
      }
      return newMap;
    });
  };

  const extractImagePaths = (html: string): string[] => {
    const paths: string[] = [];
    
    // Match src with double quotes: src="path"
    const doubleQuoteRegex = /src="([^"]+)"/g;
    let match;
    while ((match = doubleQuoteRegex.exec(html)) !== null) {
      if (match[1] && !match[1].startsWith('data:') && !match[1].startsWith('http')) {
        paths.push(match[1]);
      }
    }
    
    // Match src with single quotes: src='path'
    const singleQuoteRegex = /src='([^']+)'/g;
    while ((match = singleQuoteRegex.exec(html)) !== null) {
      if (match[1] && !match[1].startsWith('data:') && !match[1].startsWith('http')) {
        paths.push(match[1]);
      }
    }
    
    // Match src without quotes: src=path
    const noQuoteRegex = /src=([^\s>]+)/g;
    while ((match = noQuoteRegex.exec(html)) !== null) {
      if (match[1] && !match[1].startsWith('data:') && !match[1].startsWith('http')) {
        paths.push(match[1]);
      }
    }
    
    // Match CSS url() with double quotes: url("path")
    const cssUrlDoubleQuoteRegex = /url\("([^"]+)"\)/g;
    while ((match = cssUrlDoubleQuoteRegex.exec(html)) !== null) {
      if (match[1] && !match[1].startsWith('data:') && !match[1].startsWith('http')) {
        paths.push(match[1]);
      }
    }
    
    // Match CSS url() with single quotes: url('path')
    const cssUrlSingleQuoteRegex = /url\('([^']+)'\)/g;
    while ((match = cssUrlSingleQuoteRegex.exec(html)) !== null) {
      if (match[1] && !match[1].startsWith('data:') && !match[1].startsWith('http')) {
        paths.push(match[1]);
      }
    }
    
    // Match CSS url() without quotes: url(path)
    const cssUrlNoQuoteRegex = /url\(([^\s)]+)\)/g;
    while ((match = cssUrlNoQuoteRegex.exec(html)) !== null) {
      if (match[1] && !match[1].startsWith('data:') && !match[1].startsWith('http')) {
        paths.push(match[1]);
      }
    }
    
    return [...new Set(paths)]; // Remove duplicates
  };

  const replaceImagePaths = (html: string): string => {
    let modifiedHtml = html;
    
    imageMappings.forEach((uploadedFilename, htmlPath) => {
      const imageData = uploadedImages.get(uploadedFilename);
      if (imageData) {
        const escapedPath = htmlPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Replace in src attributes with double quotes
        modifiedHtml = modifiedHtml.replace(
          new RegExp(`src="${escapedPath}"`, 'g'),
          `src="${imageData.base64}"`
        );
        
        // Replace in src attributes with single quotes
        modifiedHtml = modifiedHtml.replace(
          new RegExp(`src='${escapedPath}'`, 'g'),
          `src='${imageData.base64}'`
        );
        
        // Replace in CSS url() with double quotes
        modifiedHtml = modifiedHtml.replace(
          new RegExp(`url\\("${escapedPath}"\\)`, 'g'),
          `url("${imageData.base64}")`
        );
        
        // Replace in CSS url() with single quotes
        modifiedHtml = modifiedHtml.replace(
          new RegExp(`url\\('${escapedPath}'\\)`, 'g'),
          `url('${imageData.base64}')`
        );
        
        // Replace in CSS url() without quotes
        modifiedHtml = modifiedHtml.replace(
          new RegExp(`url\\(${escapedPath}\\)`, 'g'),
          `url("${imageData.base64}")`
        );
      }
    });
    
    return modifiedHtml;
  };

  const getProcessedHtml = (): string => {
    return replaceImagePaths(htmlInput);
  };

  const handlePdfPreview = async () => {
    if (!htmlInput.trim()) return setError("Пожалуйста, введите HTML-код для конвертации.");
    setLoading(true);
    setError(null);
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
    try {
      const res = await fetch("/api/convert-html-to-pdf", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ htmlContent: getProcessedHtml(), options: { margin: {
          top: `${margins.top}${marginUnit}`, right: `${margins.right}${marginUnit}`,
          bottom: `${margins.bottom}${marginUnit}`, left: `${margins.left}${marginUnit}`,
        }}}),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Ошибка сервера");
      const blob = await res.blob();
      if (blob.size === 0) throw new Error("Сервер вернул пустой PDF.");
      setPdfPreviewUrl(URL.createObjectURL(blob) + '#navpanes=1&view=FitH');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Ошибка сервера"); } 
    finally { setLoading(false); }
  };

  const handlePdfDownloadDirectly = async () => {
    if (!htmlInput.trim()) return setError("Пожалуйста, введите HTML-код для конвертации.");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/convert-html-to-pdf", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ htmlContent: getProcessedHtml(), options: { margin: {
          top: `${margins.top}${marginUnit}`, right: `${margins.right}${marginUnit}`,
          bottom: `${margins.bottom}${marginUnit}`, left: `${margins.left}${marginUnit}`,
        }}}),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Ошибка сервера");
      const blob = await res.blob();
      if (blob.size === 0) throw new Error("Сервер вернул пустой PDF.");
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "converted.pdf";
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Ошибка сервера"); } 
    finally { setLoading(false); }
  };

  const handleHtmlToPptxConvert = async () => {
    if (!htmlInput.trim()) return setError("Пожалуйста, введите HTML-код для конвертации.");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/convert-to-pptx", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ htmlContent: getProcessedHtml() }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Ошибка конвертации в PPTX.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "converted.pptx";
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Ошибка конвертации в PPTX."); } 
    finally { setLoading(false); }
  };

  const handlePptxPreview = async () => {
    if (!htmlInput.trim()) return setError("Пожалуйста, введите HTML-код для конвертации.");
    setLoading(true);
    setError(null);
    setPptxPreviewImages([]);
    try {
      const res = await fetch("/api/preview-pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ htmlContent: getProcessedHtml() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка генерации предпросмотра PPTX.");
      if (!data.images || data.images.length === 0) throw new Error("Не найдено слайдов для предпросмотра.");
      setPptxPreviewImages(data.images);
      setCurrentSlide(0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка генерации предпросмотра PPTX.");
    } finally {
      setLoading(false);
    }
  };

  const handleCurrentJpgDownload = async () => {
    const downloadImage = (image: string, index: number) => {
      const a = document.createElement("a");
      a.href = image;
      a.download = `slide-${index + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };

    if (jpgPreviewImages.length > 0) {
      downloadImage(jpgPreviewImages[currentJpgSlide], currentJpgSlide);
      return;
    }

    if (!htmlInput.trim()) {
      setError("Пожалуйста, введите HTML-код для конвертации.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/convert-to-jpg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ htmlContent: getProcessedHtml() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка конвертации в JPG.");
      if (!data.images || data.images.length === 0) throw new Error("Не найдено слайдов для скачивания.");

      setJpgPreviewImages(data.images);
      setCurrentJpgSlide(0);
      downloadImage(data.images[0], 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка конвертации в JPG.");
    } finally {
      setLoading(false);
    }
  };

  const handleJpgPreview = async () => {
    if (!htmlInput.trim()) return setError("Пожалуйста, введите HTML-код для конвертации.");
    setLoading(true);
    setError(null);
    setJpgPreviewImages([]);
    try {
      const res = await fetch("/api/convert-to-jpg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ htmlContent: getProcessedHtml() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка генерации предпросмотра JPG.");
      if (!data.images || data.images.length === 0) throw new Error("Не найдено слайдов для предпросмотра.");
      setJpgPreviewImages(data.images);
      setCurrentJpgSlide(0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка генерации предпросмотра JPG.");
    } finally {
      setLoading(false);
    }
  };

  const handleHtmlToJpgConvert = async () => {
    if (!htmlInput.trim()) return setError("Пожалуйста, введите HTML-код для конвертации.");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/convert-to-jpg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ htmlContent: getProcessedHtml() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка конвертации в JPG.");
      if (!data.images || data.images.length === 0) throw new Error("Не найдено слайдов для скачивания.");

      data.images.forEach((image: string, index: number) => {
        const a = document.createElement("a");
        a.href = image;
        a.download = `slide-${index + 1}.jpg`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });

      setJpgPreviewImages(data.images);
      setCurrentJpgSlide(0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка конвертации в JPG.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => { if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl); };
  }, [pdfPreviewUrl]);

  const TabButton = ({ tab, label }: { tab: 'pdf' | 'pptx' | 'jpg', label: string }) => (
    <button onClick={() => {
      setActiveTab(tab); 
      setError(null); 
      setPptxPreviewImages([]);
      setJpgPreviewImages([]);
      if(pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }} className={`relative px-4 py-2 text-sm font-medium leading-5 rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white/60 focus:ring-cyan-500 ${
        activeTab === tab ? 'bg-white text-cyan-600 shadow-md' : 'text-gray-600 hover:text-gray-900 hover:bg-white/80'
      }`} >{label}
      {activeTab === tab && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500"></span>}
    </button>
  );

  const ActionButton = ({ onClick, children, className = '' }: { onClick: () => void, children: React.ReactNode, className?: string }) => (
    <button onClick={onClick} disabled={loading} className={`inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-gray-800 bg-gradient-to-b from-cyan-200 to-cyan-400 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-px transform transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white/60 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}>
      {loading ? "Обработка..." : children}
    </button>
  );

  const Input = (props: React.ComponentProps<'input'>) => (
    <input {...props} className="w-full p-2.5 border-2 border-gray-300/60 rounded-lg bg-white/50 text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all duration-200" />
  );
  
  const Select = (props: React.ComponentProps<'select'>) => (
    <select {...props} className="w-full p-2.5 border-2 border-gray-300/60 rounded-lg bg-white/50 text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all duration-200 h-[46px]" />
  );

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-br from-cyan-50 via-blue-100 to-purple-100 font-sans text-gray-800 p-4 sm:p-8 overflow-hidden">
      <WavyBackground />
      <main className="relative w-full max-w-7xl mx-auto bg-white/70 backdrop-blur-xl rounded-2xl shadow-lg ring-1 ring-black/5 py-10 px-6 sm:px-10 z-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-8">Конвертер Документов</h1>
        <div className="flex space-x-2 border-b-2 border-gray-300/60 mb-8">
          <TabButton tab="pdf" label="PDF" />
          <TabButton tab="pptx" label="PPTX" />
          <TabButton tab="jpg" label="JPG" />
        </div>

        {activeTab === 'pdf' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-12 w-full animate-fade-in">
            <div className="flex flex-col gap-8 col-span-1">
              <section><h2 className="text-xl font-semibold text-gray-800 mb-3">Вставьте HTML</h2><textarea className="w-full p-3 border-2 border-gray-300/60 rounded-lg bg-white/50 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all duration-200 shadow-sm" rows={14} placeholder="Вставьте ваш HTML-код здесь..." value={htmlInput} onChange={handleHtmlInputChange} disabled={loading}></textarea></section>
              <section><h2 className="text-xl font-semibold text-gray-800 mb-3">Загрузить изображения</h2><input type="file" multiple accept="image/*" onChange={handleImageUpload} className="w-full p-2.5 border-2 border-gray-300/60 rounded-lg bg-white/50 text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all duration-200" disabled={loading} />
                {uploadedImages.size > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Array.from(uploadedImages.entries()).map(([filename, imageData]) => (
                      <div key={filename} className="relative group">
                        <Image src={imageData.base64} alt={filename} width={64} height={64} className="h-16 w-16 object-cover rounded border-2 border-gray-300/60" />
                        <button onClick={() => removeImage(filename)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                        <div className="text-xs text-gray-600 mt-1 truncate max-w-16" title={filename}>{filename}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section><h2 className="text-xl font-semibold text-gray-800 mb-3">Отступы</h2><div className="grid grid-cols-5 gap-3 p-4 border-2 border-gray-300/60 rounded-xl bg-white/50 shadow-sm"><div className="flex flex-col gap-1"><label htmlFor="top" className="text-xs font-medium text-gray-600">Верх</label><Input type="number" name="top" value={margins.top} onChange={handleMarginChange} /></div><div className="flex flex-col gap-1"><label htmlFor="right" className="text-xs font-medium text-gray-600">Право</label><Input type="number" name="right" value={margins.right} onChange={handleMarginChange} /></div><div className="flex flex-col gap-1"><label htmlFor="bottom" className="text-xs font-medium text-gray-600">Низ</label><Input type="number" name="bottom" value={margins.bottom} onChange={handleMarginChange} /></div><div className="flex flex-col gap-1"><label htmlFor="left" className="text-xs font-medium text-gray-600">Лево</label><Input type="number" name="left" value={margins.left} onChange={handleMarginChange} /></div><div className="flex flex-col gap-1"><label htmlFor="unit" className="text-xs font-medium text-gray-600">Ед.</label><Select name="unit" value={marginUnit} onChange={handleUnitChange}><option value="mm">mm</option><option value="cm">cm</option><option value="in">in</option><option value="px">px</option></Select></div></div></section>
              <section><h2 className="text-xl font-semibold text-gray-800 mb-3">Действия</h2>
                <div className="flex items-center gap-4">
                  <ActionButton onClick={handlePdfPreview}><EyeIcon />Предпросмотр</ActionButton>
                  <ActionButton onClick={handlePdfDownloadDirectly} className="bg-gradient-to-b from-cyan-200 to-cyan-400">
                      <DownloadIcon/>Скачать
                  </ActionButton>

                </div>
              </section>
            </div>
            <div className="flex flex-col gap-4 w-full col-span-1 lg:col-span-2">
                <h2 className="text-xl font-semibold text-gray-800">Предпросмотр</h2>
                <div className="w-full h-[800px] border-2 border-gray-300/60 rounded-xl flex items-center justify-center bg-gray-100/50 shadow-md overflow-hidden">
                  {loading && <div className="text-gray-500">Загрузка предпросмотра...</div>}
                  {error && !pdfPreviewUrl && <div className="text-red-500 text-sm px-4">{error}</div>}
                  {pdfPreviewUrl && !error && (<iframe src={pdfPreviewUrl} className="w-full h-full" title="PDF Preview"></iframe>)}
                  {!loading && !error && !pdfPreviewUrl && <div className="text-gray-400">Здесь появится предпросмотр PDF</div>}
                </div>
                {isMounted && (
                  <section className="mt-4"><h2 className="text-lg font-semibold text-gray-800 mb-2">Сопоставить изображения</h2>
                    {htmlInput && extractImagePaths(htmlInput).length > 0 && (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {extractImagePaths(htmlInput).map((path) => {
                          const mappedFile = imageMappings.get(path);
                          const mappedImageData = mappedFile ? uploadedImages.get(mappedFile) : null;
                          const fileName = path.split('/').pop() || path;
                          
                          return (
                            <div key={path} className="flex items-center gap-3 border-2 border-gray-300/60 rounded-lg bg-white/50 p-2">
                              <div className="w-12 h-12 border-2 border-gray-300/60 rounded bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {mappedImageData ? (
                                  <img src={mappedImageData.base64} alt={path} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="text-xs text-gray-400">-</div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-mono text-gray-700 truncate" title={path}>{fileName}</div>
                                <div className="text-xs text-gray-500 truncate" title={path}>{path}</div>
                              </div>
                              <select 
                                value={mappedFile || ''}
                                onChange={(e) => e.target.value ? setMapping(path, e.target.value) : removeMapping(path)}
                                className="flex-shrink-0 w-32 p-1.5 text-xs border-2 border-gray-300/60 rounded bg-white/50 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                              >
                                <option value="">...</option>
                                {Array.from(uploadedImages.entries()).map(([filename, imageData]) => (
                                  <option key={filename} value={filename}>{filename}</option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {htmlInput && extractImagePaths(htmlInput).length === 0 && (
                      <div className="text-xs text-gray-500">Изображения в HTML не найдены</div>
                    )}
                  </section>
                )}
            </div>
          </div>
        )}

        {activeTab === 'pptx' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 w-full animate-fade-in">
            <div className="flex flex-col gap-8">
              <section><h2 className="text-xl font-semibold text-gray-800 mb-3">Вставьте HTML</h2><textarea className="w-full p-3 border-2 border-gray-300/60 rounded-lg bg-white/50 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all duration-200 shadow-sm" rows={8} placeholder="Вставьте ваш HTML-код здесь..." value={htmlInput} onChange={handleHtmlInputChange} disabled={loading}></textarea></section>
              <section><h2 className="text-xl font-semibold text-gray-800 mb-3">Загрузить изображения</h2><input type="file" multiple accept="image/*" onChange={handleImageUpload} className="w-full p-2.5 border-2 border-gray-300/60 rounded-lg bg-white/50 text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all duration-200" disabled={loading} />
                {uploadedImages.size > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Array.from(uploadedImages.entries()).map(([filename, imageData]) => (
                      <div key={filename} className="relative group">
                        <Image src={imageData.base64} alt={filename} width={64} height={64} className="h-16 w-16 object-cover rounded border-2 border-gray-300/60" />
                        <button onClick={() => removeImage(filename)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                        <div className="text-xs text-gray-600 mt-1 truncate max-w-16" title={filename}>{filename}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section><h2 className="text-xl font-semibold text-gray-800 mb-3">Действия</h2>
                <div className="flex items-center gap-4">
                    <ActionButton onClick={handlePptxPreview}><EyeIcon />Предпросмотр</ActionButton>
                    <ActionButton onClick={handleHtmlToPptxConvert} className="bg-gradient-to-b from-cyan-200 to-cyan-400">
                        <DownloadIcon/>Скачать
                    </ActionButton>

                </div>
              </section>
              <section><h2 className="text-xl font-semibold text-gray-800 mb-3">Инструкция</h2><PptxInstruction /></section>
            </div>
            <div className="flex flex-col gap-4 w-full">
              <h2 className="text-xl font-semibold text-gray-800">Предпросмотр PPTX</h2>
              <div className="w-full min-h-[400px] lg:min-h-[540px] border-2 border-gray-300/60 rounded-xl flex items-center justify-center bg-gray-100/50 shadow-md overflow-hidden relative">
                {loading && <div className="text-gray-500">Загрузка предпросмотра...</div>}
                {error && pptxPreviewImages.length === 0 && <div className="text-red-500 text-sm px-4">{error}</div>}
                {pptxPreviewImages.length > 0 && !error && (
                  <div className="w-full h-full flex flex-col items-center justify-center relative">
                    <img src={pptxPreviewImages[currentSlide]} alt={`Slide ${currentSlide + 1}`} className="max-w-full max-h-full object-contain"/>
                    <div className="absolute top-2 right-2 flex items-center gap-2">
                       <span className="text-sm font-semibold text-gray-700 bg-white/70 backdrop-blur-sm rounded-md px-2 py-1">{currentSlide + 1} / {pptxPreviewImages.length}</span>
                       <button onClick={() => setPptxPreviewImages([])} className="p-1.5 rounded-md bg-gray-600/50 hover:bg-gray-800/70 text-white transition-colors">
                          <CloseIcon/>
                       </button>
                    </div>
                     {currentSlide > 0 && (
                      <button onClick={() => setCurrentSlide(s => s - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                    )}
                    {currentSlide < pptxPreviewImages.length - 1 && (
                      <button onClick={() => setCurrentSlide(s => s + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    )}
                  </div>
                )}
                {!loading && !error && pptxPreviewImages.length === 0 && <div className="text-gray-400">Здесь появится предпросмотр PPTX</div>}
              </div>
              {isMounted && (
                <section className="mt-4"><h2 className="text-lg font-semibold text-gray-800 mb-2">Сопоставить изображения</h2>
                  {htmlInput && extractImagePaths(htmlInput).length > 0 && (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {extractImagePaths(htmlInput).map((path) => {
                        const mappedFile = imageMappings.get(path);
                        const mappedImageData = mappedFile ? uploadedImages.get(mappedFile) : null;
                        const fileName = path.split('/').pop() || path;
                        
                        return (
                          <div key={path} className="flex items-center gap-3 border-2 border-gray-300/60 rounded-lg bg-white/50 p-2">
                            <div className="w-12 h-12 border-2 border-gray-300/60 rounded bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {mappedImageData ? (
                                <img src={mappedImageData.base64} alt={path} className="w-full h-full object-cover" />
                              ) : (
                                <div className="text-xs text-gray-400">-</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-mono text-gray-700 truncate" title={path}>{fileName}</div>
                              <div className="text-xs text-gray-500 truncate" title={path}>{path}</div>
                            </div>
                            <select 
                              value={mappedFile || ''}
                              onChange={(e) => e.target.value ? setMapping(path, e.target.value) : removeMapping(path)}
                              className="flex-shrink-0 w-32 p-1.5 text-xs border-2 border-gray-300/60 rounded bg-white/50 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                            >
                              <option value="">...</option>
                              {Array.from(uploadedImages.entries()).map(([filename]) => (
                                <option key={filename} value={filename}>{filename}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {htmlInput && extractImagePaths(htmlInput).length === 0 && (
                    <div className="text-xs text-gray-500">Изображения в HTML не найдены</div>
                  )}
                </section>
              )}
            </div>
          </div>
        )}

        {activeTab === 'jpg' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 w-full animate-fade-in">
            <div className="flex flex-col gap-8">
              <section><h2 className="text-xl font-semibold text-gray-800 mb-3">Вставьте HTML</h2><textarea className="w-full p-3 border-2 border-gray-300/60 rounded-lg bg-white/50 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all duration-200 shadow-sm" rows={8} placeholder="Вставьте ваш HTML-код здесь..." value={htmlInput} onChange={handleHtmlInputChange} disabled={loading}></textarea></section>
              <section><h2 className="text-xl font-semibold text-gray-800 mb-3">Загрузить изображения</h2><input type="file" multiple accept="image/*" onChange={handleImageUpload} className="w-full p-2.5 border-2 border-gray-300/60 rounded-lg bg-white/50 text-gray-900 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all duration-200" disabled={loading} />
                {uploadedImages.size > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Array.from(uploadedImages.entries()).map(([filename, imageData]) => (
                      <div key={filename} className="relative group">
                        <Image src={imageData.base64} alt={filename} width={64} height={64} className="h-16 w-16 object-cover rounded border-2 border-gray-300/60" />
                        <button onClick={() => removeImage(filename)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                        <div className="text-xs text-gray-600 mt-1 truncate max-w-16" title={filename}>{filename}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section><h2 className="text-xl font-semibold text-gray-800 mb-3">Действия</h2>
                <div className="flex flex-wrap items-center gap-3">
                    <ActionButton onClick={handleJpgPreview}><EyeIcon />Предпросмотр</ActionButton>
                    <ActionButton onClick={handleCurrentJpgDownload} className="bg-gradient-to-b from-cyan-200 to-cyan-400">
                        <DownloadIcon/>Скачать текущий
                    </ActionButton>
                    <ActionButton onClick={handleHtmlToJpgConvert} className="bg-gradient-to-b from-cyan-200 to-cyan-400">
                        <DownloadIcon/>Скачать все
                    </ActionButton>

                </div>
              </section>
              <section><h2 className="text-xl font-semibold text-gray-800 mb-3">Инструкция</h2><JpgInstruction /></section>
            </div>
            <div className="flex flex-col gap-4 w-full">
              <h2 className="text-xl font-semibold text-gray-800">Предпросмотр JPG</h2>
              <div className="w-full min-h-[400px] lg:min-h-[540px] border-2 border-gray-300/60 rounded-xl flex items-center justify-center bg-gray-100/50 shadow-md overflow-hidden relative">
                {loading && <div className="text-gray-500">Загрузка предпросмотра...</div>}
                {error && jpgPreviewImages.length === 0 && <div className="text-red-500 text-sm px-4">{error}</div>}
                {jpgPreviewImages.length > 0 && !error && (
                  <div className="w-full h-full flex flex-col items-center justify-center relative">
                    <img src={jpgPreviewImages[currentJpgSlide]} alt={`Slide ${currentJpgSlide + 1}`} className="max-w-full max-h-full object-contain"/>
                    <div className="absolute top-2 right-2 flex items-center gap-2">
                       <span className="text-sm font-semibold text-gray-700 bg-white/70 backdrop-blur-sm rounded-md px-2 py-1">{currentJpgSlide + 1} / {jpgPreviewImages.length}</span>
                       <button onClick={() => setJpgPreviewImages([])} className="p-1.5 rounded-md bg-gray-600/50 hover:bg-gray-800/70 text-white transition-colors">
                          <CloseIcon/>
                       </button>
                    </div>
                     {currentJpgSlide > 0 && (
                      <button onClick={() => setCurrentJpgSlide(s => s - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                    )}
                    {currentJpgSlide < jpgPreviewImages.length - 1 && (
                      <button onClick={() => setCurrentJpgSlide(s => s + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    )}
                  </div>
                )}
                {!loading && !error && jpgPreviewImages.length === 0 && <div className="text-gray-400">Здесь появится предпросмотр JPG</div>}
              </div>
              {isMounted && (
                <section className="mt-4"><h2 className="text-lg font-semibold text-gray-800 mb-2">Сопоставить изображения</h2>
                  {htmlInput && extractImagePaths(htmlInput).length > 0 && (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {extractImagePaths(htmlInput).map((path) => {
                        const mappedFile = imageMappings.get(path);
                        const mappedImageData = mappedFile ? uploadedImages.get(mappedFile) : null;
                        const fileName = path.split('/').pop() || path;
                        
                        return (
                          <div key={path} className="flex items-center gap-3 border-2 border-gray-300/60 rounded-lg bg-white/50 p-2">
                            <div className="w-12 h-12 border-2 border-gray-300/60 rounded bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {mappedImageData ? (
                                <img src={mappedImageData.base64} alt={path} className="w-full h-full object-cover" />
                              ) : (
                                <div className="text-xs text-gray-400">-</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-mono text-gray-700 truncate" title={path}>{fileName}</div>
                              <div className="text-xs text-gray-500 truncate" title={path}>{path}</div>
                            </div>
                            <select 
                              value={mappedFile || ''}
                              onChange={(e) => e.target.value ? setMapping(path, e.target.value) : removeMapping(path)}
                              className="flex-shrink-0 w-32 p-1.5 text-xs border-2 border-gray-300/60 rounded bg-white/50 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                            >
                              <option value="">...</option>
                              {Array.from(uploadedImages.entries()).map(([filename]) => (
                                <option key={filename} value={filename}>{filename}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {htmlInput && extractImagePaths(htmlInput).length === 0 && (
                    <div className="text-xs text-gray-500">Изображения в HTML не найдены</div>
                  )}
                </section>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}