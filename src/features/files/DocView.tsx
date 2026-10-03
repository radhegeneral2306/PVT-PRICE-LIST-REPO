import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PdfDoc, RenderTask } from './pdfLoader';

export type PageSpec =
  | { key: string; kind: 'img'; aspect: number; url: string; alt: string }
  | { key: string; kind: 'pdf'; aspect: number; doc: PdfDoc; index: number };

const GAP = 12;
const PAD_TOP = 4;
const PAD_BOTTOM = 80; // room so the floating controls never cover the last page
const MAX_W = 920;
const MIN_S = 1;
const MAX_S = 6;
const MAX_CANVAS_PX = 12_000_000;

const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Tf { x: number; y: number; s: number }
interface Ptr { x: number; y: number }

/**
 * Pinch/pan/zoom surface for a vertical stack of pages. A single CSS transform moves the whole stack
 * (no scroll listeners). Only pages near the viewport are drawn.
 */
export function DocView({ pages }: { pages: PageSpec[] }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cur, setCur] = useState(0);
  const [visible, setVisible] = useState<Set<number>>(() => new Set([0, 1]));
  const [quality, setQuality] = useState(1);
  const [zoomed, setZoomed] = useState(false);

  const W = Math.max(120, Math.min(size.w - 28, MAX_W));
  const layout = useMemo(() => {
    let y = PAD_TOP;
    const tops: number[] = [];
    const hs: number[] = [];
    for (const p of pages) {
      const h = Math.round(W * p.aspect);
      tops.push(y);
      hs.push(h);
      y += h + GAP;
    }
    return { tops, hs, total: y - GAP + PAD_BOTTOM };
  }, [pages, W]);

  const t = useRef<Tf>({ x: 0, y: 0, s: 1 });
  const dims = useRef({ sw: 0, sh: 0, W, layout });
  dims.current = { sw: size.w, sh: size.h, W, layout };
  const curRef = useRef(0);
  const raf = useRef(0);
  const qTimer = useRef(0);
  const animTimer = useRef(0);

  const clampTf = useCallback((n: Tf): Tf => {
    const { sw, sh, W: w, layout: l } = dims.current;
    const s = clampN(n.s, MIN_S, MAX_S);
    const cw = w * s;
    const x = cw <= sw ? (sw - cw) / 2 : clampN(n.x, sw - cw, 0);
    const ch = l.total * s;
    const y = ch <= sh ? 0 : clampN(n.y, sh - ch, 0);
    return { x, y, s };
  }, []);

  const flush = useCallback(() => {
    raf.current = 0;
    const { x, y, s } = t.current;
    const el = docRef.current;
    if (el) el.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    const { sh, layout: l } = dims.current;
    const cy = (sh / 2 - y) / s;
    let idx = l.tops.length - 1;
    for (let i = 0; i < l.tops.length; i++) {
      if (cy < l.tops[i] + l.hs[i] + GAP / 2) { idx = i; break; }
    }
    if (idx !== curRef.current) { curRef.current = idx; setCur(idx); }
    setZoomed(s > 1.02);
    window.clearTimeout(qTimer.current);
    qTimer.current = window.setTimeout(() => setQuality(clampN(Math.ceil(t.current.s), 1, 4)), 220);
  }, []);

  const commit = useCallback((n: Tf, animate = false) => {
    t.current = clampTf(n);
    const el = docRef.current;
    if (el && animate) {
      el.classList.add('anim');
      window.clearTimeout(animTimer.current);
      animTimer.current = window.setTimeout(() => el.classList.remove('anim'), 240);
    }
    if (!raf.current) raf.current = requestAnimationFrame(flush);
  }, [clampTf, flush]);

  useEffect(() => () => { cancelAnimationFrame(raf.current); window.clearTimeout(qTimer.current); window.clearTimeout(animTimer.current); }, []);

  // Measure the stage.
  useLayoutEffect(() => {
    const el = stageRef.current!;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Re-clamp when the geometry changes.
  useLayoutEffect(() => {
    if (!size.w) return;
    commit(t.current);
  }, [size.w, size.h, W, layout, commit]);

  const zoomAt = useCallback((px: number, py: number, factor: number, animate = false) => {
    const c = t.current;
    const s = clampN(c.s * factor, MIN_S, MAX_S);
    const k = s / c.s;
    commit({ s, x: px - (px - c.x) * k, y: py - (py - c.y) * k }, animate);
  }, [commit]);

  const goTo = useCallback((i: number, s = t.current.s) => {
    const idx = clampN(i, 0, pages.length - 1);
    const { layout: l } = dims.current;
    commit({ s, x: t.current.x, y: -(l.tops[idx] - PAD_TOP) * s }, true);
  }, [commit, pages.length]);

  const zoomCentre = (f: number) => zoomAt(dims.current.sw / 2, dims.current.sh / 2, f, true);
  const fit = () => goTo(curRef.current, 1);

  // Pointer gestures.
  const ptrs = useRef(new Map<number, Ptr>());
  const pinch = useRef<{ dist: number; s: number; docX: number; docY: number } | null>(null);
  const tap = useRef({ downAt: 0, moved: 0, lastAt: 0, lastX: 0, lastY: 0 });

  const local = (e: React.PointerEvent): Ptr => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const beginPinch = () => {
    const [a, b] = Array.from(ptrs.current.values());
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: t.current.s, docX: (mx - t.current.x) / t.current.s, docY: (my - t.current.y) / t.current.s };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.fv-ctl')) return;
    stageRef.current!.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, local(e));
    if (ptrs.current.size === 1) tap.current.downAt = Date.now(), tap.current.moved = 0;
    else tap.current.moved = 99;
    if (ptrs.current.size === 2) beginPinch();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = ptrs.current.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    ptrs.current.set(e.pointerId, p);
    if (ptrs.current.size >= 2 && pinch.current) {
      const [a, b] = Array.from(ptrs.current.values());
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const s = clampN(pinch.current.s * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist), MIN_S, MAX_S);
      commit({ s, x: mx - pinch.current.docX * s, y: my - pinch.current.docY * s });
    } else if (ptrs.current.size === 1) {
      tap.current.moved += Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y);
      commit({ s: t.current.s, x: t.current.x + (p.x - prev.x), y: t.current.y + (p.y - prev.y) });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const had = ptrs.current.delete(e.pointerId);
    if (!had) return;
    pinch.current = null; // a finger left: any remaining finger keeps panning from where it is
    if (e.type === 'pointercancel' || ptrs.current.size > 0) return;
    const tp = tap.current;
    const now = Date.now();
    if (tp.moved < 10 && now - tp.downAt < 300) {
      const p = local(e);
      if (now - tp.lastAt < 320 && Math.hypot(p.x - tp.lastX, p.y - tp.lastY) < 40) {
        tp.lastAt = 0;
        if (t.current.s > 1.05) commit({ ...t.current, s: 1 }, true);
        else zoomAt(p.x, p.y, 2.5, true);
      } else {
        tp.lastAt = now; tp.lastX = p.x; tp.lastY = p.y;
      }
    }
  };

  // Wheel (mouse/trackpad): wheel pans, ctrl/cmd + wheel (and trackpad pinch) zooms.
  useEffect(() => {
    const el = stageRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01));
      else commit({ s: t.current.s, x: t.current.x - e.deltaX, y: t.current.y - e.deltaY });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [commit, zoomAt]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const c = t.current;
    switch (e.key) {
      case 'ArrowDown': commit({ ...c, y: c.y - 80 }); break;
      case 'ArrowUp': commit({ ...c, y: c.y + 80 }); break;
      case 'ArrowLeft': commit({ ...c, x: c.x + 80 }); break;
      case 'ArrowRight': commit({ ...c, x: c.x - 80 }); break;
      case 'PageDown': case ' ': goTo(curRef.current + 1); break;
      case 'PageUp': goTo(curRef.current - 1); break;
      case 'Home': goTo(0); break;
      case 'End': goTo(pages.length - 1); break;
      case '+': case '=': zoomCentre(1.4); break;
      case '-': zoomCentre(1 / 1.4); break;
      case '0': fit(); break;
      default: return;
    }
    e.preventDefault();
  };

  // Visible pages, via IntersectionObserver on the stage.
  useEffect(() => {
    const root = stageRef.current!;
    const io = new IntersectionObserver(
      (entries) => {
        setVisible((prev) => {
          const next = new Set(prev);
          for (const en of entries) {
            const i = Number((en.target as HTMLElement).dataset.i);
            if (en.isIntersecting) next.add(i); else next.delete(i);
          }
          return next.size === prev.size && [...next].every((i) => prev.has(i)) ? prev : next;
        });
      },
      { root, rootMargin: '60% 0px 60% 0px' },
    );
    docRef.current!.querySelectorAll('[data-i]').forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [pages, layout]);

  return (
    <div className="fv-stage" ref={stageRef} tabIndex={0} role="document" aria-label="Pricelist pages"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onKeyDown={onKeyDown}>
      <div className="fv-doc" ref={docRef} style={{ width: W, height: layout.total }}>
        {pages.map((p, i) => (
          <div key={p.key} className="fv-page" data-i={i} style={{ top: layout.tops[i], width: W, height: layout.hs[i] }}>
            {visible.has(i) ? (
              p.kind === 'pdf' ? <PdfCanvas doc={p.doc} index={p.index} width={W} quality={quality} /> : <img src={p.url} alt={p.alt} draggable={false} />
            ) : null}
          </div>
        ))}
      </div>
      <div className="fv-ctl fv-pill" role="group" aria-label="Page">
        <button type="button" aria-label="Previous page" disabled={cur <= 0} onClick={() => goTo(cur - 1)}><i className="ph-bold ph-caret-left" /></button>
        <span aria-live="polite">{cur + 1} / {pages.length}</span>
        <button type="button" aria-label="Next page" disabled={cur >= pages.length - 1} onClick={() => goTo(cur + 1)}><i className="ph-bold ph-caret-right" /></button>
      </div>
      <div className="fv-ctl fv-zoom" role="group" aria-label="Zoom">
        <button type="button" aria-label="Zoom in" onClick={() => zoomCentre(1.4)}><i className="ph ph-plus" /></button>
        <button type="button" aria-label="Zoom out" disabled={!zoomed} onClick={() => zoomCentre(1 / 1.4)}><i className="ph ph-minus" /></button>
        <button type="button" aria-label="Fit page to screen" onClick={fit}><i className="ph ph-arrows-out" /></button>
      </div>
    </div>
  );
}

function PdfCanvas({ doc, index, width, quality }: { doc: PdfDoc; index: number; width: number; quality: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const canvas = ref.current!;
    let cancelled = false;
    let task: RenderTask | null = null;
    (async () => {
      const page = await doc.getPage(index + 1);
      const base = page.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      let k = (width / base.width) * dpr * quality;
      k = Math.min(k, Math.sqrt(MAX_CANVAS_PX / (base.width * base.height)));
      const vp = page.getViewport({ scale: k });
      const off = document.createElement('canvas');
      off.width = Math.max(1, Math.floor(vp.width));
      off.height = Math.max(1, Math.floor(vp.height));
      const ctx = off.getContext('2d');
      if (!ctx) throw new Error('no canvas');
      task = page.render({ canvas: off, canvasContext: ctx, viewport: vp });
      await task.promise;
      if (cancelled) return;
      canvas.width = off.width;
      canvas.height = off.height;
      canvas.getContext('2d')!.drawImage(off, 0, 0);
      off.width = 0; off.height = 0;
      page.cleanup();
      setDrawn(true);
    })().catch((e: unknown) => {
      if (!cancelled && (e as { name?: string })?.name !== 'RenderingCancelledException') setFailed(true);
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, index, width, quality]);

  // Free the bitmap when the page scrolls far away (component unmounts).
  useEffect(() => {
    const c = ref.current;
    return () => { if (c) { c.width = 0; c.height = 0; } };
  }, []);

  return (
    <>
      <canvas ref={ref} aria-label={`Page ${index + 1}`} />
      {!drawn ? <div className="fv-ph">{failed ? 'Could not draw this page' : 'Loading page'}</div> : null}
    </>
  );
}
