// Tiny generated sample files so the viewer works against the mock.

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Minimal valid multi-page PDF (Helvetica text only), returned as base64. */
export function samplePdfBase64(title: string, pages: number): string {
  const objs: string[] = [];
  const fontNum = 3 + pages * 2;
  const kids: string[] = [];
  for (let p = 0; p < pages; p++) kids.push(`${3 + p * 2} 0 R`);
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages} >>`;
  for (let p = 0; p < pages; p++) {
    const pageNum = 3 + p * 2;
    const contentNum = pageNum + 1;
    const lines = [
      `BT /F1 20 Tf 50 780 Td (${title}) Tj ET`,
      `BT /F1 12 Tf 50 750 Td (Sample pricelist, page ${p + 1} of ${pages}) Tj ET`,
      'BT /F1 11 Tf 50 710 Td (Item) Tj 200 0 Td (Size) Tj 120 0 Td (Rate per sqft) Tj ET',
    ];
    for (let r = 0; r < 14; r++) {
      const y = 685 - r * 22;
      lines.push(
        `BT /F1 11 Tf 50 ${y} Td (Sample design ${p * 14 + r + 1}) Tj 200 0 Td (600x1200) Tj 120 0 Td (${(30 + ((r * 7 + p * 3) % 20) + 0.5).toFixed(2)}) Tj ET`,
      );
    }
    const stream = lines.join('\n');
    objs[pageNum] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontNum} 0 R >> >> /Contents ${contentNum} 0 R >>`;
    objs[contentNum] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  }
  objs[fontNum] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = out.length;
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return toBase64(bytes);
}

let crcTable: Uint32Array | null = null;
function crc32(buf: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(buf: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function u32(n: number): number[] {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const t = new Uint8Array([...type].map((c) => c.charCodeAt(0)));
  const body = new Uint8Array(t.length + data.length);
  body.set(t, 0);
  body.set(data, t.length);
  return new Uint8Array([...u32(data.length), ...body, ...u32(crc32(body))]);
}

/** Small valid PNG (uncompressed deflate) with a soft gradient and a ruled "table" look, base64. */
export function samplePngBase64(w: number, h: number, tint: [number, number, number]): string {
  const raw = new Uint8Array((w * 3 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    for (let x = 0; x < w; x++) {
      const rule = y % 12 === 0 || x % 30 === 0;
      const g = 245 - Math.floor((y / h) * 25);
      const dark = rule ? 0.8 : 1;
      raw[o++] = Math.floor(((g * 3 + tint[0]) / 4) * dark);
      raw[o++] = Math.floor(((g * 3 + tint[1]) / 4) * dark);
      raw[o++] = Math.floor(((g * 3 + tint[2]) / 4) * dark);
    }
  }
  const z: number[] = [0x78, 0x01];
  for (let i = 0; i < raw.length; i += 65535) {
    const part = raw.subarray(i, Math.min(i + 65535, raw.length));
    const final = i + 65535 >= raw.length ? 1 : 0;
    z.push(final, part.length & 255, part.length >> 8, ~part.length & 255, (~part.length >> 8) & 255);
    for (let k = 0; k < part.length; k++) z.push(part[k]);
  }
  z.push(...u32(adler32(raw)));
  const ihdr = new Uint8Array([...u32(w), ...u32(h), 8, 2, 0, 0, 0]);
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', new Uint8Array(z)),
    chunk('IEND', new Uint8Array(0)),
  ];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const png = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    png.set(p, off);
    off += p.length;
  }
  return toBase64(png);
}
