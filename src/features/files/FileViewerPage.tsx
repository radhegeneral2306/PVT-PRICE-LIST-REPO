import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../../store/DataContext';
import { Button, EmptyState, ErrorState, formatDate, IconButton, Sheet, useToast } from '../../ui';
import type { FileRef, Pricelist } from '../../types';
import { DocView, type PageSpec } from './DocView';
import { downloadName, isFileList, isPdf, sourceLabel } from './helpers';
import './viewer.css';

export { isFileList } from './helpers';

type Phase =
  | { kind: 'loading' }
  | { kind: 'ready'; pages: PageSpec[]; urls: string[] }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

const NOT_SAVED = 'This file is not saved on this phone yet. Connect to the internet once to open it.';

function measureImage(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalHeight / Math.max(1, img.naturalWidth));
    img.onerror = () => reject(new Error('This image could not be opened.'));
    img.src = url;
  });
}

export function FileViewerPage() {
  const { pricelistId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { ready, pricelists, factories, getFileUrl } = useData();
  const pricelist: Pricelist | undefined = pricelists.find((p) => p.id === pricelistId);
  const factory = factories.find((f) => f.id === pricelist?.factoryId);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [info, setInfo] = useState(false);
  const [sharing, setSharing] = useState(false);

  const goBack = useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(pricelist ? `/factories/${pricelist.factoryId}` : '/', { replace: true }); // the pricelist page forwards file lists back here, so go one level higher
  }, [navigate, pricelist]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') goBack(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goBack]);

  // Load the files (blob URLs) and build the page list. pdf.js is imported lazily.
  const files = pricelist?.files;
  const fileKey = files ? files.map((f) => f.fileId).join(',') : '';
  useEffect(() => {
    if (!files || files.length === 0) return;
    let dead = false;
    const destroyers: (() => void)[] = [];
    setPhase({ kind: 'loading' });
    (async () => {
      const urls = await Promise.all(files.map((f) => getFileUrl(f)));
      const pages: PageSpec[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (isPdf(f)) {
          const { openPdf } = await import('./pdfLoader');
          const h = openPdf(urls[i]);
          destroyers.push(h.destroy);
          const doc = await h.promise;
          const sizes = await Promise.all(
            Array.from({ length: doc.numPages }, async (_, n) => {
              const pg = await doc.getPage(n + 1);
              const v = pg.getViewport({ scale: 1 });
              return v.height / v.width;
            }),
          );
          sizes.forEach((aspect, n) => pages.push({ key: `${f.fileId}:${n}`, kind: 'pdf', aspect, doc, index: n }));
        } else {
          const aspect = await measureImage(urls[i]);
          pages.push({ key: f.fileId, kind: 'img', aspect, url: urls[i], alt: f.name });
        }
      }
      if (dead) return;
      setPhase({ kind: 'ready', pages, urls });
    })().catch((e: unknown) => {
      if (dead) return;
      const msg = e instanceof Error ? e.message : '';
      if (/not saved on this phone/i.test(msg) || (!navigator.onLine && /fetch|network|load/i.test(msg))) setPhase({ kind: 'offline' });
      else setPhase({ kind: 'error', message: msg && !/^[A-Z][A-Za-z]*Exception$/.test(msg) ? msg : 'The file could not be opened.' });
    });
    return () => { dead = true; destroyers.forEach((d) => d()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileKey, attempt]);

  const blobFor = useCallback(async (f: FileRef): Promise<Blob> => {
    const url = await getFileUrl(f);
    const res = await fetch(url);
    return res.blob();
  }, [getFileUrl]);

  const onDownload = async () => {
    if (!pricelist) return;
    try {
      for (let i = 0; i < pricelist.files.length; i++) {
        const f = pricelist.files[i];
        const url = await getFileUrl(f);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadName(factory, pricelist, f, i, pricelist.files.length);
        document.body.appendChild(a);
        a.click();
        a.remove();
        if (i < pricelist.files.length - 1) await new Promise((r) => setTimeout(r, 350));
      }
    } catch {
      toast.error('Could not download this file. Connect to the internet and try again.');
    }
  };

  const onShare = async () => {
    if (!pricelist || sharing) return;
    setSharing(true);
    try {
      const fl = await Promise.all(pricelist.files.map(async (f, i) => new File([await blobFor(f)], downloadName(factory, pricelist, f, i, pricelist.files.length), { type: f.mime })));
      const data: ShareData = { files: fl, title: `${factory?.name ?? pricelist.title} pricelist` };
      if (typeof navigator.share === 'function' && navigator.canShare?.(data)) {
        await navigator.share(data);
      } else {
        toast.show('Sharing is not available here. Use Download, then send the file.');
      }
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') toast.error('Could not share this file.');
    } finally {
      setSharing(false);
    }
  };

  const pageCount = phase.kind === 'ready' ? phase.pages.length : 0;
  const subtitle = useMemo(() => {
    if (!pricelist) return '';
    const parts = [factory?.name, sourceLabel(pricelist)];
    if (pageCount) parts.push(`${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`);
    return parts.filter(Boolean).join(' · ');
  }, [pricelist, factory, pageCount]);

  const missing = ready && (!pricelist || !isFileList(pricelist));
  const actionsOn = !!pricelist && isFileList(pricelist);

  return (
    <div className="fv">
      <header className="fv-top">
        <IconButton icon="arrow-left" label="Back" onClick={goBack} />
        <div className="fv-ttl">
          <b>{pricelist?.title ?? 'Pricelist'}</b>
          <small>{subtitle || ' '}</small>
        </div>
      </header>

      {missing ? (
        <div className="fv-state">
          <EmptyState icon="file-dashed" title="No file to show" text="This pricelist has no PDF or photos attached." action={<Button onClick={goBack}>Go back</Button>} />
        </div>
      ) : phase.kind === 'ready' ? (
        <DocView key={fileKey} pages={phase.pages} />
      ) : phase.kind === 'offline' ? (
        <div className="fv-state">
          <EmptyState icon="cloud-slash" title="Not saved on this phone" text={NOT_SAVED} action={<Button icon="arrow-clockwise" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>} />
        </div>
      ) : phase.kind === 'error' ? (
        <div className="fv-state"><ErrorState title="Could not open file" message={phase.message} onRetry={() => setAttempt((n) => n + 1)} /></div>
      ) : (
        <div className="fv-state" style={{ alignItems: 'stretch' }} role="status" aria-label="Loading file"><div className="fv-skel" /></div>
      )}

      <div className="fv-act">
        <Button icon="download-simple" iconWeight="regular" disabled={!actionsOn} onClick={() => void onDownload()}>Download</Button>
        <Button icon="share-network" iconWeight="regular" disabled={!actionsOn} loading={sharing} onClick={() => void onShare()}>Share</Button>
        <Button variant="primary" icon="info" iconWeight="regular" disabled={!pricelist} onClick={() => setInfo(true)}>Info</Button>
      </div>

      <Sheet open={info} onClose={() => setInfo(false)} title="Pricelist info" footer={<Button onClick={() => setInfo(false)}>Close</Button>}>
        {pricelist ? (
          <dl className="fv-info">
            <dt>Title</dt><dd>{pricelist.title}</dd>
            <dt>Factory</dt><dd>{factory?.name ?? 'Unknown'}</dd>
            <dt>Effective date</dt><dd>{formatDate(pricelist.effectiveDate)}</dd>
            <dt>Source</dt><dd>{sourceLabel(pricelist)}{pageCount ? ` · ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}` : ''}</dd>
            <dt>Note</dt><dd>{pricelist.note || 'No note'}</dd>
            {pricelist.createdBy ? (<><dt>Added by</dt><dd>{pricelist.createdBy}</dd></>) : null}
          </dl>
        ) : null}
      </Sheet>
    </div>
  );
}
