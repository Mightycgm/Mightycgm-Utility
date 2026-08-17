'use client';
import { useState, useCallback } from 'react';
import ToolPageWrapper from '@/components/layout/ToolPageWrapper';
import { PDFDocument } from 'pdf-lib';

type Tab = 'merge' | 'split' | 'to-image' | 'img-to-pdf';

export default function PdfToolsPage() {
  const [tab, setTab] = useState<Tab>('merge');

  // Merge
  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [mergeResult, setMergeResult] = useState('');
  const [merging, setMerging] = useState(false);

  // Split
  const [splitFile, setSplitFile] = useState<File | null>(null);
  const [splitFrom, setSplitFrom] = useState(1);
  const [splitTo, setSplitTo] = useState(1);
  const [splitTotal, setSplitTotal] = useState(0);
  const [splitResult, setSplitResult] = useState('');
  const [splitting, setSplitting] = useState(false);

  // PDF to image
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfImages, setPdfImages] = useState<string[]>([]);
  const [rendering, setRendering] = useState(false);
  const [renderPage, setRenderPage] = useState(1);
  const [renderTotal, setRenderTotal] = useState(0);

  // Img to PDF
  const [imgFiles, setImgFiles] = useState<File[]>([]);
  const [imgPdfResult, setImgPdfResult] = useState('');
  const [buildingPdf, setBuildingPdf] = useState(false);

  // Merge PDFs
  const mergePdfs = async () => {
    if (mergeFiles.length < 2) return;
    setMerging(true);
    try {
      const merged = await PDFDocument.create();
      for (const file of mergeFiles) {
        const bytes = await file.arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }
      const out = await merged.save();
      const blob = new Blob([out as unknown as BlobPart], { type: 'application/pdf' });
      setMergeResult(URL.createObjectURL(blob));
    } catch (e) { console.error(e); }
    setMerging(false);
  };

  // Load split file to get page count
  const loadSplitFile = async (file: File) => {
    setSplitFile(file); setSplitResult('');
    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes);
      setSplitTotal(doc.getPageCount());
      setSplitFrom(1); setSplitTo(doc.getPageCount());
    } catch (e) { console.error(e); }
  };

  // Split PDF
  const splitPdf = async () => {
    if (!splitFile) return;
    setSplitting(true);
    try {
      const bytes = await splitFile.arrayBuffer();
      const src = await PDFDocument.load(bytes);
      const out = await PDFDocument.create();
      const indices = Array.from({ length: splitTo - splitFrom + 1 }, (_, i) => i + splitFrom - 1);
      const pages = await out.copyPages(src, indices);
      pages.forEach(p => out.addPage(p));
      const saved = await out.save();
      const blob = new Blob([saved as unknown as BlobPart], { type: 'application/pdf' });
      setSplitResult(URL.createObjectURL(blob));
    } catch (e) { console.error(e); }
    setSplitting(false);
  };

  // PDF → Image (using pdf.js)
  const renderPdfPage = async () => {
    if (!pdfFile) return;
    setRendering(true);
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
      const bytes = await pdfFile.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      setRenderTotal(pdf.numPages);
      const page = await pdf.getPage(renderPage);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport, canvas }).promise;
      setPdfImages(prev => {
        const arr = [...prev];
        arr[renderPage - 1] = canvas.toDataURL('image/png');
        return arr;
      });
    } catch (e) { console.error(e); }
    setRendering(false);
  };

  // Images → PDF
  const buildPdfFromImages = async () => {
    if (imgFiles.length === 0) return;
    setBuildingPdf(true);
    try {
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
    } catch (e) { console.error(e); }
    setBuildingPdf(false);
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'merge', label: '⊕ Merge PDFs' },
    { key: 'split', label: '✂ Split PDF' },
    { key: 'to-image', label: '🖼 PDF → Image' },
    { key: 'img-to-pdf', label: '📄 Images → PDF' },
  ];

  return (
    <ToolPageWrapper title="PDF Tools" description="Merge, split, convert PDFs — all in your browser" emoji="📄">
      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl font-medium text-sm ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Merge */}
      {tab === 'merge' && (
        <div className="space-y-5">
          <div className="border-2 border-dashed border-gray-700 rounded-2xl p-8 text-center cursor-pointer hover:border-gray-600"
            onClick={() => document.getElementById('merge-input')?.click()}>
            <div className="text-4xl mb-2">📎</div>
            <p className="text-gray-400">{mergeFiles.length > 0 ? `${mergeFiles.length} file(s) selected` : 'Click to select PDF files'}</p>
            <input id="merge-input" type="file" accept=".pdf" multiple className="hidden"
              onChange={e => setMergeFiles(Array.from(e.target.files || []))} />
          </div>
          {mergeFiles.length > 1 && (
            <div className="space-y-2">
              {mergeFiles.map((f, i) => (
                <div key={i} className="tool-card p-3 flex justify-between items-center text-sm">
                  <span className="text-gray-300">📄 {f.name}</span>
                  <button className="text-red-400 hover:text-red-300 text-xs" onClick={() => setMergeFiles(prev => prev.filter((_, j) => j !== i))}>Remove</button>
                </div>
              ))}
            </div>
          )}
          <button className="btn-primary" onClick={mergePdfs} disabled={mergeFiles.length < 2 || merging}>
            {merging ? 'Merging...' : 'Merge PDFs'}
          </button>
          {mergeResult && <a href={mergeResult} download="merged.pdf" className="btn-secondary inline-block">⬇ Download Merged PDF</a>}
        </div>
      )}

      {/* Split */}
      {tab === 'split' && (
        <div className="space-y-5">
          <div className="border-2 border-dashed border-gray-700 rounded-2xl p-8 text-center cursor-pointer hover:border-gray-600"
            onClick={() => document.getElementById('split-input')?.click()}>
            <div className="text-4xl mb-2">✂️</div>
            <p className="text-gray-400">{splitFile ? splitFile.name : 'Click to select a PDF'}</p>
            {splitTotal > 0 && <p className="text-indigo-400 text-sm mt-1">{splitTotal} pages</p>}
            <input id="split-input" type="file" accept=".pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) loadSplitFile(f); }} />
          </div>
          {splitTotal > 0 && (
            <div className="flex gap-4 items-end">
              <div>
                <label className="text-sm text-gray-400 block mb-2">From page</label>
                <input type="number" min={1} max={splitTotal} className="input-field w-24" value={splitFrom}
                  onChange={e => setSplitFrom(Math.max(1, Math.min(+e.target.value, splitTo)))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">To page</label>
                <input type="number" min={splitFrom} max={splitTotal} className="input-field w-24" value={splitTo}
                  onChange={e => setSplitTo(Math.max(splitFrom, Math.min(+e.target.value, splitTotal)))} />
              </div>
              <button className="btn-primary" onClick={splitPdf} disabled={splitting}>
                {splitting ? 'Splitting...' : 'Extract Pages'}
              </button>
            </div>
          )}
          {splitResult && <a href={splitResult} download="split.pdf" className="btn-secondary inline-block">⬇ Download Split PDF</a>}
        </div>
      )}

      {/* PDF → Image */}
      {tab === 'to-image' && (
        <div className="space-y-5">
          <div className="border-2 border-dashed border-gray-700 rounded-2xl p-8 text-center cursor-pointer hover:border-gray-600"
            onClick={() => document.getElementById('pdf-img-input')?.click()}>
            <div className="text-4xl mb-2">🖼️</div>
            <p className="text-gray-400">{pdfFile ? pdfFile.name : 'Click to select a PDF'}</p>
            {renderTotal > 0 && <p className="text-indigo-400 text-sm mt-1">{renderTotal} pages total</p>}
            <input id="pdf-img-input" type="file" accept=".pdf" className="hidden"
              onChange={async e => {
                const f = e.target.files?.[0];
                if (!f) return;
                setPdfFile(f); setPdfImages([]); setRenderPage(1);
                const pdfjs = await import('pdfjs-dist');
                pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
                const bytes = await f.arrayBuffer();
                const pdf = await pdfjs.getDocument({ data: bytes }).promise;
                setRenderTotal(pdf.numPages);
              }} />
          </div>
          {renderTotal > 0 && (
            <div className="flex gap-4 items-end">
              <div>
                <label className="text-sm text-gray-400 block mb-2">Page</label>
                <input type="number" min={1} max={renderTotal} className="input-field w-24" value={renderPage}
                  onChange={e => setRenderPage(Math.max(1, Math.min(+e.target.value, renderTotal)))} />
              </div>
              <button className="btn-primary" onClick={renderPdfPage} disabled={rendering}>
                {rendering ? 'Rendering...' : 'Render Page as PNG'}
              </button>
            </div>
          )}
          {pdfImages[renderPage - 1] && (
            <div className="tool-card p-4 space-y-3">
              <img src={pdfImages[renderPage - 1]} alt={`Page ${renderPage}`} className="w-full rounded-xl" />
              <a href={pdfImages[renderPage - 1]} download={`page-${renderPage}.png`} className="btn-primary inline-block text-sm">⬇ Download Page {renderPage}</a>
            </div>
          )}
        </div>
      )}

      {/* Images → PDF */}
      {tab === 'img-to-pdf' && (
        <div className="space-y-5">
          <div className="border-2 border-dashed border-gray-700 rounded-2xl p-8 text-center cursor-pointer hover:border-gray-600"
            onClick={() => document.getElementById('img-pdf-input')?.click()}>
            <div className="text-4xl mb-2">📄</div>
            <p className="text-gray-400">{imgFiles.length > 0 ? `${imgFiles.length} image(s) selected` : 'Click to select images (PNG/JPG)'}</p>
            <input id="img-pdf-input" type="file" accept="image/png,image/jpeg" multiple className="hidden"
              onChange={e => setImgFiles(Array.from(e.target.files || []))} />
          </div>
          {imgFiles.length > 0 && (
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
              {imgFiles.map((f, i) => (
                <div key={i} className="tool-card p-2 text-center text-xs text-gray-400">
                  <div className="text-2xl mb-1">🖼️</div>
                  <div className="truncate">{f.name}</div>
                </div>
              ))}
            </div>
          )}
          <button className="btn-primary" onClick={buildPdfFromImages} disabled={imgFiles.length === 0 || buildingPdf}>
            {buildingPdf ? 'Building PDF...' : 'Convert to PDF'}
          </button>
          {imgPdfResult && <a href={imgPdfResult} download="images.pdf" className="btn-secondary inline-block">⬇ Download PDF</a>}
        </div>
      )}
    </ToolPageWrapper>
  );
}
