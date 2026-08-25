'use client';
import { useState, useEffect, useRef } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Tab = 'to-markdown' | 'merge' | 'split' | 'to-image' | 'img-to-pdf';

interface MarkdownConversionResult {
  fileName: string;
  fileSize: number;
  totalPages: number;
  markdown: string;
  wordCount: number;
  charCount: number;
  estMarkdownTokens: number;
  estOriginalPdfTokens: number;
  tokenSavingsPercent: number;
}

interface TextItem {
  str: string;
  dir?: string;
  transform: number[]; // [scaleX, skewY, skewX, scaleY, tx, ty]
  width?: number;
  height?: number;
  fontName?: string;
  hasEOL?: boolean;
}

// Convert PDF ArrayBuffer to structured, token-efficient Markdown
async function convertPdfToMarkdown(
  bytes: ArrayBuffer,
  fileName: string,
  options: {
    includePageDividers: boolean;
    detectHeadings: boolean;
    detectLists: boolean;
    detectTables: boolean;
    stripHeadersFooters: boolean;
    cleanHyphenation: boolean;
    wrapForAi: boolean;
  },
  onProgress?: (current: number, total: number) => void
): Promise<MarkdownConversionResult> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const numPages = pdf.numPages;

  // First pass: Calculate average font size across document to detect headings accurately
  const fontSizes: number[] = [];

  for (let p = 1; p <= Math.min(numPages, 5); p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const item of content.items as TextItem[]) {
      if (item.str && item.str.trim()) {
        const size = Math.abs(item.transform[0] || item.transform[3] || item.height || 12);
        fontSizes.push(size);
      }
    }
  }

  // Median font size for body text
  fontSizes.sort((a, b) => a - b);
  const bodyFontSize = fontSizes.length > 0 ? fontSizes[Math.floor(fontSizes.length / 2)] : 12;

  const pageMarkdownList: string[] = [];

  for (let p = 1; p <= numPages; p++) {
    if (onProgress) onProgress(p, numPages);

    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items as TextItem[];

    if (!items || items.length === 0) {
      if (options.includePageDividers) {
        pageMarkdownList.push(`<!-- Page ${p}: Empty / Image Only -->`);
      }
      continue;
    }

    // Group text items by vertical line (Y position) with 3px tolerance
    interface LineGroup {
      y: number;
      fontSize: number;
      isBold: boolean;
      items: { x: number; text: string; width: number }[];
    }

    const linesMap = new Map<number, LineGroup>();

    items.forEach((item) => {
      if (!item.str) return;
      const text = item.str;
      if (!text.trim() && text !== ' ') return;

      const x = item.transform[4] || 0;
      const y = Math.round((item.transform[5] || 0) / 3) * 3; // quantize Y coordinate
      const fontSize = Math.abs(item.transform[0] || item.transform[3] || item.height || bodyFontSize);
      const fontName = (item.fontName || '').toLowerCase();
      const isBold = fontName.includes('bold') || fontName.includes('black') || fontName.includes('heavy') || fontName.includes('semibold');
      const width = item.width || text.length * (fontSize * 0.5);

      if (!linesMap.has(y)) {
        linesMap.set(y, {
          y,
          fontSize,
          isBold,
          items: [{ x, text, width }],
        });
      } else {
        const line = linesMap.get(y)!;
        line.items.push({ x, text, width });
        if (fontSize > line.fontSize) line.fontSize = fontSize;
        if (isBold) line.isBold = true;
      }
    });

    // Sort lines from top to bottom (Y descending in PDF coordinate system)
    const sortedLines = Array.from(linesMap.values()).sort((a, b) => b.y - a.y);

    // Filter headers/footers if enabled
    let contentLines = sortedLines;
    if (options.stripHeadersFooters && sortedLines.length > 3) {
      const firstLineText = sortedLines[0].items.map((i) => i.text).join('').trim();
      const isPageNumber = (s: string) =>
        /^(page\s*\d+(\s*of\s*\d+)?|\d+|\-\s*\d+\s*\-)$/i.test(s);

      if (isPageNumber(firstLineText) || (firstLineText.length < 25 && numPages > 2)) {
        contentLines = contentLines.slice(1);
      }
      if (contentLines.length > 0) {
        const lastIdx = contentLines.length - 1;
        const currentLast = contentLines[lastIdx].items.map((i) => i.text).join('').trim();
        if (isPageNumber(currentLast)) {
          contentLines = contentLines.slice(0, lastIdx);
        }
      }
    }

    const formattedPageLines: string[] = [];
    let inTable = false;
    let tableRows: string[][] = [];

    const flushTable = () => {
      if (tableRows.length > 0) {
        // Build markdown table
        const colCount = Math.max(...tableRows.map((r) => r.length));
        if (colCount >= 2) {
          const headerRow = tableRows[0];
          while (headerRow.length < colCount) headerRow.push('');
          const headerStr = `| ${headerRow.map((c) => c.replace(/\|/g, '\\|') || ' ').join(' | ')} |`;
          const sepStr = `| ${Array(colCount).fill('---').join(' | ')} |`;
          const bodyStrs = tableRows.slice(1).map((row) => {
            while (row.length < colCount) row.push('');
            return `| ${row.map((c) => c.replace(/\|/g, '\\|') || ' ').join(' | ')} |`;
          });
          formattedPageLines.push(`\n${headerStr}\n${sepStr}\n${bodyStrs.join('\n')}\n`);
        } else {
          // Fallback to regular text
          tableRows.forEach((r) => formattedPageLines.push(r.join(' ')));
        }
        tableRows = [];
        inTable = false;
      }
    };

    for (let i = 0; i < contentLines.length; i++) {
      const line = contentLines[i];
      // Sort items horizontally (left to right)
      line.items.sort((a, b) => a.x - b.x);

      // Check if line looks like a tabular row (multiple spaced columns)
      const isTableRow =
        options.detectTables &&
        line.items.length >= 2 &&
        line.items.some((item, idx) => {
          if (idx === 0) return false;
          const prev = line.items[idx - 1];
          const gap = item.x - (prev.x + prev.width);
          return gap > 20; // significant gap between columns
        });

      if (isTableRow) {
        // Group items into columns
        const cols: string[] = [];
        let currentCell = '';
        for (let c = 0; c < line.items.length; c++) {
          const item = line.items[c];
          if (c > 0) {
            const prev = line.items[c - 1];
            const gap = item.x - (prev.x + prev.width);
            if (gap > 20) {
              cols.push(currentCell.trim());
              currentCell = '';
            }
          }
          currentCell += (currentCell ? ' ' : '') + item.text.trim();
        }
        if (currentCell.trim()) cols.push(currentCell.trim());

        if (cols.length >= 2) {
          inTable = true;
          tableRows.push(cols);
          continue;
        }
      }

      if (inTable) {
        flushTable();
      }

      // Combine text items into line with smart spacing
      let lineText = '';
      for (let k = 0; k < line.items.length; k++) {
        const it = line.items[k];
        if (k > 0) {
          const prev = line.items[k - 1];
          const gap = it.x - (prev.x + prev.width);
          if (gap > 3 && !lineText.endsWith(' ') && !it.text.startsWith(' ')) {
            lineText += ' ';
          }
        }
        lineText += it.text;
      }
      lineText = lineText.trim();
      if (!lineText) continue;

      // Heading detection
      if (options.detectHeadings) {
        const fontRatio = line.fontSize / bodyFontSize;
        if (fontRatio >= 1.6 && lineText.length < 120) {
          formattedPageLines.push(`\n# ${lineText.replace(/^[#\s]+/, '')}\n`);
          continue;
        } else if (fontRatio >= 1.3 && lineText.length < 150) {
          formattedPageLines.push(`\n## ${lineText.replace(/^[#\s]+/, '')}\n`);
          continue;
        } else if ((fontRatio >= 1.15 || (line.isBold && lineText.length < 80)) && !lineText.endsWith('.')) {
          formattedPageLines.push(`\n### ${lineText.replace(/^[#\s]+/, '')}\n`);
          continue;
        }
      }

      // List item detection
      if (options.detectLists) {
        const bulletMatch = lineText.match(/^([•\-\*▪–—]|\d+[\.\)])\s+(.*)/);
        if (bulletMatch) {
          const marker = bulletMatch[1];
          const rest = bulletMatch[2];
          if (/^\d+[\.\)]/.test(marker)) {
            formattedPageLines.push(`${marker} ${rest}`);
          } else {
            formattedPageLines.push(`- ${rest}`);
          }
          continue;
        }
      }

      // Standard paragraph line
      formattedPageLines.push(lineText);
    }

    if (inTable) flushTable();

    // Reconstruct paragraph flows and clean hyphenation
    let pageContent = '';
    for (let j = 0; j < formattedPageLines.length; j++) {
      const cur = formattedPageLines[j];
      const next = formattedPageLines[j + 1];

      if (cur.startsWith('#') || cur.startsWith('|') || cur.startsWith('- ') || /^\d+\.\s/.test(cur)) {
        pageContent += cur + '\n';
      } else {
        if (options.cleanHyphenation && cur.endsWith('-') && next && !next.startsWith('#') && !next.startsWith('-')) {
          pageContent += cur.slice(0, -1);
        } else if (next && !next.startsWith('#') && !next.startsWith('|') && !next.startsWith('- ') && !/^\d+\.\s/.test(next)) {
          pageContent += cur + ' ';
        } else {
          pageContent += cur + '\n\n';
        }
      }
    }

    let cleanPage = pageContent.replace(/\n{3,}/g, '\n\n').trim();

    if (options.includePageDividers) {
      cleanPage = `\n\n---\n\n<!-- Page ${p} -->\n\n` + cleanPage;
    }

    pageMarkdownList.push(cleanPage);
  }

  let finalMarkdown = pageMarkdownList.join('\n\n').trim();

  // AI Prompt Template Wrapper
  if (options.wrapForAi) {
    finalMarkdown = `<document filename="${fileName}" total_pages="${numPages}" format="markdown_compact">\n${finalMarkdown}\n</document>`;
  }

  const charCount = finalMarkdown.length;
  const wordCount = finalMarkdown.trim().split(/\s+/).filter(Boolean).length;
  // Estimated tokens (approx 3.8 chars per token for markdown/code)
  const estMarkdownTokens = Math.ceil(charCount / 3.8);
  // Estimated tokens for raw binary PDF file (typically ~1,800-2,500 tokens per page in multimodal/raw embedding)
  const estOriginalPdfTokens = Math.max(Math.ceil(bytes.byteLength / 2), numPages * 1850);
  const tokenSavingsPercent = Math.max(0, Math.min(95, Math.round((1 - estMarkdownTokens / estOriginalPdfTokens) * 100)));

  return {
    fileName,
    fileSize: bytes.byteLength,
    totalPages: numPages,
    markdown: finalMarkdown,
    wordCount,
    charCount,
    estMarkdownTokens,
    estOriginalPdfTokens,
    tokenSavingsPercent,
  };
}

export default function PdfToolsPage() {
  const [tab, setTab] = useState<Tab>('to-markdown');

  // PDF to Markdown State
  const [mdFiles, setMdFiles] = useState<File[]>([]);
  const [mdResults, setMdResults] = useState<MarkdownConversionResult[]>([]);
  const [activeResultIndex, setActiveResultIndex] = useState<number>(0);
  const [isConvertingMd, setIsConvertingMd] = useState(false);
  const [mdProgress, setMdProgress] = useState({ current: 0, total: 0 });
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [previewMode, setPreviewMode] = useState<'raw' | 'preview'>('raw');

  // Markdown Extraction Options
  const [includePageDividers, setIncludePageDividers] = useState(true);
  const [detectHeadings, setDetectHeadings] = useState(true);
  const [detectLists, setDetectLists] = useState(true);
  const [detectTables, setDetectTables] = useState(true);
  const [stripHeadersFooters, setStripHeadersFooters] = useState(true);
  const [cleanHyphenation, setCleanHyphenation] = useState(true);
  const [wrapForAi, setWrapForAi] = useState(false);

  // Merge State
  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [mergeResult, setMergeResult] = useState('');
  const [merging, setMerging] = useState(false);

  // Split State
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [splitFrom, setSplitFrom] = useState(1);
  const [splitTo, setSplitTo] = useState(1);
  const [splitTotal, setSplitTotal] = useState(0);
  const [splitResult, setSplitResult] = useState('');
  const [splitting, setSplitting] = useState(false);

  // PDF to Image State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfImages, setPdfImages] = useState<string[]>([]);
  const [rendering, setRendering] = useState(false);
  const [renderPage, setRenderPage] = useState(1);
  const [renderTotal, setRenderTotal] = useState(0);

  // Image to PDF State
  const [imgFiles, setImgFiles] = useState<File[]>([]);
  const [imgPdfResult, setImgPdfResult] = useState('');
  const [buildingPdf, setBuildingPdf] = useState(false);

  const mdFileInputRef = useRef<HTMLInputElement>(null);

  // Handle PDF to Markdown conversion
  const handlePdfToMarkdownUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
    if (fileArray.length === 0) return;

    setMdFiles(fileArray);
    setIsConvertingMd(true);
    setMdResults([]);
    setActiveResultIndex(0);

    const results: MarkdownConversionResult[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      try {
        const bytes = await file.arrayBuffer();
        const res = await convertPdfToMarkdown(
          bytes,
          file.name,
          {
            includePageDividers,
            detectHeadings,
            detectLists,
            detectTables,
            stripHeadersFooters,
            cleanHyphenation,
            wrapForAi,
          },
          (current, total) => {
            setMdProgress({ current, total });
          }
        );
        results.push(res);
      } catch (err) {
        console.error('PDF to Markdown conversion error:', err);
      }
    }

    setMdResults(results);
    setIsConvertingMd(false);
  };

  // Re-run conversion if options change
  const reConvertWithCurrentOptions = async () => {
    if (mdFiles.length === 0) return;
    setIsConvertingMd(true);
    const results: MarkdownConversionResult[] = [];

    for (let i = 0; i < mdFiles.length; i++) {
      const file = mdFiles[i];
      try {
        const bytes = await file.arrayBuffer();
        const res = await convertPdfToMarkdown(
          bytes,
          file.name,
          {
            includePageDividers,
            detectHeadings,
            detectLists,
            detectTables,
            stripHeadersFooters,
            cleanHyphenation,
            wrapForAi,
          },
          (current, total) => {
            setMdProgress({ current, total });
          }
        );
        results.push(res);
      } catch (err) {
        console.error('PDF to Markdown conversion error:', err);
      }
    }

    setMdResults(results);
    setIsConvertingMd(false);
  };

  // Download Markdown file (.md)
  const downloadMarkdownFile = (result: MarkdownConversionResult) => {
    const blob = new Blob([result.markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const nameWithoutExt = result.fileName.replace(/\.pdf$/i, '');
    a.href = url;
    a.download = `${nameWithoutExt}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download All as separate files
  const downloadAllMarkdownFiles = () => {
    mdResults.forEach((r) => downloadMarkdownFile(r));
  };

  // Copy Markdown to Clipboard
  const copyToClipboard = async (text: string, isPrompt: boolean = false) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isPrompt) {
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 2000);
      } else {
        setCopiedMd(true);
        setTimeout(() => setCopiedMd(false), 2000);
      }
    } catch {
      console.error('Clipboard copy failed');
    }
  };

  // Copy with AI instructions prompt template
  const copyWithAiPrompt = (result: MarkdownConversionResult) => {
    const prompt = `Here is the content of the document "${result.fileName}" (${result.totalPages} pages) converted to clean Markdown format:\n\n${result.markdown}\n\n---\n\nPlease review and analyze the document content above.`;
    copyToClipboard(prompt, true);
  };

  // Merge PDFs
  const mergePdfs = async () => {
    if (mergeFiles.length < 2) return;
    setMerging(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const merged = await PDFDocument.create();
      for (const file of mergeFiles) {
        const bytes = await file.arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      }
      const out = await merged.save();
      const blob = new Blob([out as unknown as BlobPart], { type: 'application/pdf' });
      setMergeResult(URL.createObjectURL(blob));
    } catch (e) {
      console.error(e);
    }
    setMerging(false);
  };

  // Load split file to get page count
  const loadSplitFile = async (file: File) => {
    setSplitFile(file);
    setSplitResult('');
    try {
      const { PDFDocument } = await import('pdf-lib');
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      setSplitTotal(doc.getPageCount());
      setSplitFrom(1);
      setSplitTo(doc.getPageCount());
    } catch (e) {
      console.error(e);
    }
  };

  // Split PDF
  const splitPdf = async () => {
    if (!splitFile) return;
    setSplitting(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const bytes = await splitFile.arrayBuffer();
      const src = await PDFDocument.load(bytes);
      const out = await PDFDocument.create();
      const indices = Array.from({ length: splitTo - splitFrom + 1 }, (_, i) => i + splitFrom - 1);
      const pages = await out.copyPages(src, indices);
      pages.forEach((p) => out.addPage(p));
      const saved = await out.save();
      const blob = new Blob([saved as unknown as BlobPart], { type: 'application/pdf' });
      setSplitResult(URL.createObjectURL(blob));
    } catch (e) {
      console.error(e);
    }
    setSplitting(false);
  };

  // PDF → Image (using pdf.js)
  const renderPdfPage = async () => {
    if (!pdfFile) return;
    setRendering(true);
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      const bytes = await pdfFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      setRenderTotal(pdf.numPages);
      const page = await pdf.getPage(renderPage);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport, canvas }).promise;
      setPdfImages((prev) => {
        const arr = [...prev];
        arr[renderPage - 1] = canvas.toDataURL('image/png');
        return arr;
      });
    } catch (e) {
      console.error(e);
    }
    setRendering(false);
  };

  // Images → PDF
  const buildPdfFromImages = async () => {
    if (imgFiles.length === 0) return;
    setBuildingPdf(true);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const pdf = await PDFDocument.create();
      for (const file of imgFiles) {
        const bytes = await file.arrayBuffer();
        let img;
        if (file.type === 'image/jpeg') img = await pdf.embedJpg(bytes);
        else img = await pdf.embedPng(bytes);
        const page = pdf.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      const out = await pdf.save();
      const blob = new Blob([out as unknown as BlobPart], { type: 'application/pdf' });
      setImgPdfResult(URL.createObjectURL(blob));
    } catch (e) {
      console.error(e);
    }
    setBuildingPdf(false);
  };

  // Clipboard Paste (Ctrl+V) handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.clipboardData && e.clipboardData.items) {
        const files: File[] = [];
        for (const item of Array.from(e.clipboardData.items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) files.push(file);
          } else if (item.type === 'application/pdf') {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              setTab('to-markdown');
              handlePdfToMarkdownUpload([file] as unknown as FileList);
              return;
            }
          }
        }

        if (files.length > 0) {
          e.preventDefault();
          setImgFiles((prev) => [...prev, ...files]);
          setTab('img-to-pdf');
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const TABS: { key: Tab; label: string; badge?: string }[] = [
    { key: 'to-markdown', label: '📑 PDF ➔ Markdown (.md)', badge: 'Reduce AI Tokens ⚡' },
    { key: 'merge', label: '⊕ Merge PDFs' },
    { key: 'split', label: '✂ Split PDF' },
    { key: 'to-image', label: '🖼 PDF ➔ Image' },
    { key: 'img-to-pdf', label: '📄 Images ➔ PDF' },
  ];

  const currentMdResult = mdResults[activeResultIndex] || null;

  return (
    <ToolPageWrapper
      title="PDF Tools & Markdown Converter"
      description="Convert PDF to token-optimized Markdown (.md) for AI prompts, merge, split, and convert in your browser"
      emoji="📄"
    >
      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-[var(--card-border)] pb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-all flex items-center gap-2 cursor-pointer ${
              tab === t.key ? 'btn-primary shadow-sm' : 'btn-secondary'
            }`}
          >
            <span>{t.label}</span>
            {t.badge && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 font-bold border border-green-500/30">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: PDF ➔ MARKDOWN (.MD) FOR AI TOKEN REDUCTION */}
      {tab === 'to-markdown' && (
        <div className="space-y-6">
          {/* Hero Banner: Why Convert PDF to Markdown for AI */}
          <div className="tool-card p-5 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-[var(--card)] border border-indigo-500/20 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <h2 className="text-sm font-bold text-[var(--foreground)]">
                Save 70% – 90% AI Tokens when attaching PDF documents
              </h2>
            </div>
            <p className="text-xs text-[var(--muted-text)] leading-relaxed">
              Standard PDF attachments consume massive token budgets due to binary encoding, embedded font streams, and layout overhead.
              Converting to clean <strong>Markdown (.md)</strong> extracts structured headings, tables, bullet points, and text into a lightweight format that fits easily within context windows of <strong>ChatGPT, Claude, Gemini, and DeepSeek</strong>.
            </p>
          </div>

          {/* Upload Drop Zone */}
          <div
            className="drop-zone py-12 group cursor-pointer"
            onClick={() => mdFileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handlePdfToMarkdownUpload(e.dataTransfer.files);
            }}
          >
            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📑</div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              Drop PDF files here, <span className="underline underline-offset-4">browse files</span>, or press{' '}
              <kbd className="px-2 py-0.5 rounded bg-[var(--muted)] border border-[var(--card-border)] text-xs font-mono">
                Ctrl + V
              </kbd>
            </p>
            <p className="text-xs text-[var(--muted-text)] mt-1.5">
              Supports single & multi-page PDF documents • 100% Client-side local processing
            </p>
            <input
              ref={mdFileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handlePdfToMarkdownUpload(e.target.files)}
            />
          </div>

          {/* Conversion Options */}
          <div className="tool-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-text)] flex items-center gap-1.5">
                <span>⚙️</span> <span>Markdown AI Optimization Settings</span>
              </span>
              {mdFiles.length > 0 && (
                <button
                  type="button"
                  onClick={reConvertWithCurrentOptions}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline"
                >
                  Apply & Re-convert
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={detectHeadings}
                  onChange={(e) => setDetectHeadings(e.target.checked)}
                  className="rounded accent-indigo-500"
                />
                <span>Auto-detect Headings (#, ##, ###)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={detectTables}
                  onChange={(e) => setDetectTables(e.target.checked)}
                  className="rounded accent-indigo-500"
                />
                <span>Auto-detect Tables (| col | col |)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={detectLists}
                  onChange={(e) => setDetectLists(e.target.checked)}
                  className="rounded accent-indigo-500"
                />
                <span>Auto-detect Bullet & Number Lists</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={includePageDividers}
                  onChange={(e) => setIncludePageDividers(e.target.checked)}
                  className="rounded accent-indigo-500"
                />
                <span>Include Page Dividers (--- Page N)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={stripHeadersFooters}
                  onChange={(e) => setStripHeadersFooters(e.target.checked)}
                  className="rounded accent-indigo-500"
                />
                <span>Strip Header & Footer Page Numbers</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={cleanHyphenation}
                  onChange={(e) => setCleanHyphenation(e.target.checked)}
                  className="rounded accent-indigo-500"
                />
                <span>Clean Hyphenated Word Breaks</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={wrapForAi}
                  onChange={(e) => setWrapForAi(e.target.checked)}
                  className="rounded accent-indigo-500"
                />
                <span>Wrap in &lt;document&gt; AI Tags</span>
              </label>
            </div>
          </div>

          {/* Loading Progress */}
          {isConvertingMd && (
            <div className="tool-card p-8 text-center space-y-4">
              <div className="w-10 h-10 border-3 border-[var(--card-border)] border-t-[var(--foreground)] rounded-full animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Converting PDF to Markdown...
                </p>
                <p className="text-xs text-[var(--muted-text)]">
                  Extracting text, reconstructing headings, tables, and lists (Page {mdProgress.current} / {mdProgress.total || '...'})
                </p>
              </div>
            </div>
          )}

          {/* Results Workspace */}
          {currentMdResult && !isConvertingMd && (
            <div className="space-y-4">
              {/* File Selector if multiple PDFs converted */}
              {mdResults.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {mdResults.map((r, idx) => (
                    <button
                      key={r.fileName}
                      onClick={() => setActiveResultIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                        activeResultIndex === idx
                          ? 'bg-[var(--foreground)] text-[var(--background)] font-bold shadow-sm'
                          : 'bg-[var(--muted)] border border-[var(--card-border)] text-[var(--muted-text)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      📄 {r.fileName} ({r.totalPages}p)
                    </button>
                  ))}
                  <button
                    onClick={downloadAllMarkdownFiles}
                    className="btn-secondary text-xs py-1.5 px-3 whitespace-nowrap ml-auto"
                  >
                    ⬇ Download All (.md)
                  </button>
                </div>
              )}

              {/* Token Savings & Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="tool-card p-3.5 text-center space-y-1">
                  <span className="text-[11px] text-[var(--muted-text)] block">Document Pages</span>
                  <span className="text-lg font-bold text-[var(--foreground)] font-mono">
                    {currentMdResult.totalPages} pages
                  </span>
                </div>

                <div className="tool-card p-3.5 text-center space-y-1">
                  <span className="text-[11px] text-[var(--muted-text)] block">Total Words / Characters</span>
                  <span className="text-lg font-bold text-[var(--foreground)] font-mono">
                    {currentMdResult.wordCount.toLocaleString()} w • {currentMdResult.charCount.toLocaleString()} c
                  </span>
                </div>

                <div className="tool-card p-3.5 text-center space-y-1">
                  <span className="text-[11px] text-[var(--muted-text)] block">Est. Markdown Tokens</span>
                  <span className="text-lg font-bold text-indigo-400 font-mono">
                    ~{currentMdResult.estMarkdownTokens.toLocaleString()} tokens
                  </span>
                </div>

                <div className="tool-card p-3.5 text-center space-y-1 bg-green-500/10 border-green-500/30">
                  <span className="text-[11px] text-green-300 font-medium block">⚡ AI Token Reduction</span>
                  <span className="text-lg font-extrabold text-green-400 font-mono">
                    ~{currentMdResult.tokenSavingsPercent}% Saved
                  </span>
                </div>
              </div>

              {/* Actions & View Mode Toolbar */}
              <div className="tool-card p-4 flex flex-wrap items-center justify-between gap-4">
                {/* Left: View Mode (Raw vs Rendered Preview) */}
                <div className="flex items-center gap-1.5 bg-[var(--muted)] p-1 rounded-md border border-[var(--card-border)] text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('raw')}
                    className={`px-3 py-1 rounded font-medium transition-all ${
                      previewMode === 'raw'
                        ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                        : 'text-[var(--muted-text)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    📝 Raw Markdown (.md)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('preview')}
                    className={`px-3 py-1 rounded font-medium transition-all ${
                      previewMode === 'preview'
                        ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                        : 'text-[var(--muted-text)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    👁️ Rendered Preview
                  </button>
                </div>

                {/* Right: Quick Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(currentMdResult.markdown)}
                    className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{copiedMd ? '✅ Copied Markdown!' : '📋 Copy Markdown'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => copyWithAiPrompt(currentMdResult)}
                    className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 text-indigo-400 border-indigo-500/40 hover:bg-indigo-950/40 cursor-pointer"
                    title="Copies markdown wrapped with prompt instructions ready to paste to ChatGPT, Claude, Gemini, DeepSeek"
                  >
                    <span>{copiedPrompt ? '✅ Copied with AI Prompt!' : '🤖 Copy for AI Prompt'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadMarkdownFile(currentMdResult)}
                    className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span>⬇ Download .md</span>
                  </button>
                </div>
              </div>

              {/* Editor / Preview Body */}
              <div className="tool-card p-4">
                {previewMode === 'raw' ? (
                  <textarea
                    value={currentMdResult.markdown}
                    onChange={(e) => {
                      const updated = [...mdResults];
                      updated[activeResultIndex] = {
                        ...currentMdResult,
                        markdown: e.target.value,
                        charCount: e.target.value.length,
                        wordCount: e.target.value.trim().split(/\s+/).filter(Boolean).length,
                        estMarkdownTokens: Math.ceil(e.target.value.length / 3.8),
                      };
                      setMdResults(updated);
                    }}
                    className="textarea-field w-full font-mono text-xs text-[var(--foreground)] bg-[var(--background)] p-4 rounded-lg border border-[var(--card-border)] leading-relaxed focus:border-indigo-500"
                    style={{ minHeight: '520px' }}
                    placeholder="Markdown content will appear here..."
                  />
                ) : (
                  <div
                    className="prose prose-invert max-w-none p-6 rounded-lg bg-[var(--background)] border border-[var(--card-border)] overflow-y-auto"
                    style={{ minHeight: '520px', maxHeight: '720px' }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentMdResult.markdown}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MERGE PDFS */}
      {tab === 'merge' && (
        <div className="space-y-5">
          <div
            className="border-2 border-dashed border-[var(--card-border)] rounded-xl p-8 text-center cursor-pointer hover:border-[var(--muted-text)]"
            onClick={() => document.getElementById('merge-input')?.click()}
          >
            <div className="text-4xl mb-2">📎</div>
            <p className="text-[var(--muted-text)]">
              {mergeFiles.length > 0 ? `${mergeFiles.length} file(s) selected` : 'Click to select PDF files'}
            </p>
            <input
              id="merge-input"
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={(e) => setMergeFiles(Array.from(e.target.files || []))}
            />
          </div>
          {mergeFiles.length > 1 && (
            <div className="space-y-2">
              {mergeFiles.map((f, i) => (
                <div key={i} className="tool-card p-3 flex justify-between items-center text-sm">
                  <span className="text-[var(--foreground)]">📄 {f.name}</span>
                  <button
                    className="text-red-400 hover:text-red-300 text-xs"
                    onClick={() => setMergeFiles((prev) => prev.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <button className="btn-primary" onClick={mergePdfs} disabled={mergeFiles.length < 2 || merging}>
            {merging ? 'Merging...' : 'Merge PDFs'}
          </button>
          {mergeResult && (
            <a href={mergeResult} download="merged.pdf" className="btn-secondary inline-block">
              ⬇ Download Merged PDF
            </a>
          )}
        </div>
      )}

      {/* TAB 3: SPLIT PDF */}
      {tab === 'split' && (
        <div className="space-y-5">
          <div
            className="border-2 border-dashed border-[var(--card-border)] rounded-xl p-8 text-center cursor-pointer hover:border-[var(--muted-text)]"
            onClick={() => document.getElementById('split-input')?.click()}
          >
            <div className="text-4xl mb-2">✂️</div>
            <p className="text-[var(--muted-text)]">{splitFile ? splitFile.name : 'Click to select a PDF'}</p>
            {splitTotal > 0 && <p className="text-[var(--foreground)] text-sm mt-1">{splitTotal} pages</p>}
            <input
              id="split-input"
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadSplitFile(f);
              }}
            />
          </div>
          {splitTotal > 0 && (
            <div className="flex gap-4 items-end">
              <div>
                <label className="text-sm text-[var(--muted-text)] block mb-2">From page</label>
                <input
                  type="number"
                  min={1}
                  max={splitTotal}
                  className="input-field w-24"
                  value={splitFrom}
                  onChange={(e) => setSplitFrom(Math.max(1, Math.min(+e.target.value, splitTo)))}
                />
              </div>
              <div>
                <label className="text-sm text-[var(--muted-text)] block mb-2">To page</label>
                <input
                  type="number"
                  min={splitFrom}
                  max={splitTotal}
                  className="input-field w-24"
                  value={splitTo}
                  onChange={(e) => setSplitTo(Math.max(splitFrom, Math.min(+e.target.value, splitTotal)))}
                />
              </div>
              <button className="btn-primary" onClick={splitPdf} disabled={splitting}>
                {splitting ? 'Splitting...' : 'Extract Pages'}
              </button>
            </div>
          )}
          {splitResult && (
            <a href={splitResult} download="split.pdf" className="btn-secondary inline-block">
              ⬇ Download Split PDF
            </a>
          )}
        </div>
      )}

      {/* TAB 4: PDF ➔ IMAGE */}
      {tab === 'to-image' && (
        <div className="space-y-5">
          <div
            className="border-2 border-dashed border-[var(--card-border)] rounded-xl p-8 text-center cursor-pointer hover:border-[var(--muted-text)]"
            onClick={() => document.getElementById('pdf-img-input')?.click()}
          >
            <div className="text-4xl mb-2">🖼️</div>
            <p className="text-[var(--muted-text)]">{pdfFile ? pdfFile.name : 'Click to select a PDF'}</p>
            {renderTotal > 0 && <p className="text-[var(--foreground)] text-sm mt-1">{renderTotal} pages total</p>}
            <input
              id="pdf-img-input"
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setPdfFile(f);
                setPdfImages([]);
                setRenderPage(1);
                const pdfjs = await import('pdfjs-dist');
                pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
                const bytes = await f.arrayBuffer();
                const pdf = await pdfjs.getDocument({ data: bytes }).promise;
                setRenderTotal(pdf.numPages);
              }}
            />
          </div>
          {renderTotal > 0 && (
            <div className="flex gap-4 items-end">
              <div>
                <label className="text-sm text-[var(--muted-text)] block mb-2">Page</label>
                <input
                  type="number"
                  min={1}
                  max={renderTotal}
                  className="input-field w-24"
                  value={renderPage}
                  onChange={(e) => setRenderPage(Math.max(1, Math.min(+e.target.value, renderTotal)))}
                />
              </div>
              <button className="btn-primary" onClick={renderPdfPage} disabled={rendering}>
                {rendering ? 'Rendering...' : 'Render Page as PNG'}
              </button>
            </div>
          )}
          {pdfImages[renderPage - 1] && (
            <div className="tool-card p-4 space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pdfImages[renderPage - 1]} alt={`Page ${renderPage}`} className="w-full rounded-xl" />
              <a
                href={pdfImages[renderPage - 1]}
                download={`page-${renderPage}.png`}
                className="btn-primary inline-block text-sm"
              >
                ⬇ Download Page {renderPage}
              </a>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: IMAGES ➔ PDF */}
      {tab === 'img-to-pdf' && (
        <div className="space-y-5">
          <div className="drop-zone py-10" onClick={() => document.getElementById('img-pdf-input')?.click()}>
            <div className="text-4xl mb-2">📄</div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              {imgFiles.length > 0
                ? `${imgFiles.length} image(s) selected`
                : 'Click to select images (PNG/JPG), or press Ctrl + V to paste'}
            </p>
            <p className="text-xs text-[var(--muted-text)] mt-1">Combine multiple images into a single PDF</p>
            <input
              id="img-pdf-input"
              type="file"
              accept="image/png,image/jpeg"
              multiple
              className="hidden"
              onChange={(e) => setImgFiles(Array.from(e.target.files || []))}
            />
          </div>
          {imgFiles.length > 0 && (
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {imgFiles.map((f, i) => (
                <div key={i} className="tool-card p-2 text-center text-xs text-[var(--muted-text)]">
                  <div className="text-2xl mb-1">🖼️</div>
                  <div className="truncate">{f.name}</div>
                </div>
              ))}
            </div>
          )}
          <button
            className="btn-primary"
            onClick={buildPdfFromImages}
            disabled={imgFiles.length === 0 || buildingPdf}
          >
            {buildingPdf ? 'Building PDF...' : 'Convert to PDF'}
          </button>
          {imgPdfResult && (
            <a href={imgPdfResult} download="images.pdf" className="btn-secondary inline-block">
              ⬇ Download PDF
            </a>
          )}
        </div>
      )}
    </ToolPageWrapper>
  );
}
