// Lazy-loaded: imported only via dynamic import() from the viewer so pdf.js stays out of the main bundle.
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfDoc = pdfjs.PDFDocumentProxy;
export type PdfPage = pdfjs.PDFPageProxy;
export type RenderTask = pdfjs.RenderTask;

export function openPdf(url: string): { promise: Promise<PdfDoc>; destroy: () => void } {
  const task = pdfjs.getDocument({ url });
  return { promise: task.promise, destroy: () => void task.destroy() };
}
