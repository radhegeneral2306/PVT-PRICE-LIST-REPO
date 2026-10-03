// Shrinks phone photos before upload: max 2000 px on the longest side, JPEG quality 0.82.

export const MAX_SIDE = 2000;
export const JPEG_QUALITY = 0.82;
/** Images at or below this size and dimensions are sent as they are. */
const SMALL_BYTES = 400 * 1024;

/** Pure helper: target size keeping aspect ratio, never upscaling. */
export function fitWithin(w: number, h: number, max = MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(w, h);
  if (longest <= max) return { width: w, height: h };
  const k = max / longest;
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, q));
}

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  // GIF/SVG would lose meaning as JPEG
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height } = fitWithin(bmp.width, bmp.height);
    const resized = width !== bmp.width || height !== bmp.height;
    if (!resized && file.size <= SMALL_BYTES) {
      bmp.close?.();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bmp.close?.();
      return file;
    }
    // JPEG has no alpha: paint white first so transparent PNGs do not turn black
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bmp, 0, 0, width, height);
    bmp.close?.();
    const blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);
    if (!blob || (!resized && blob.size >= file.size)) return file;
    const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
