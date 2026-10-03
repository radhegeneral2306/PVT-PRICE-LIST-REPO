import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseList } from '../../lib/parseList';
import { useData } from '../../store/DataContext';
import type { Category, Factory } from '../../types';
import {
  clearDraft, initialState, isDirty, loadDraft, newKey, reducer, saveDraft,
  type Action, type AddState, type DraftRow,
} from './state';

export interface AddApi {
  state: AddState;
  dispatch: (a: Action) => void;
  factory: Factory | null;
  dirty: boolean;
  /** The title used when the user has not typed one: "Factory Mon YYYY". */
  defaultTitle: string;
  selectFactory: (f: Factory) => void;
  setText: (text: string) => void;
  addFiles: (files: File[]) => void;
  retryFile: (key: string) => void;
  /** Local object URL for an image file chosen in this session, if any. */
  previewUrl: (key: string) => string | undefined;
  /** Forget the draft for good (after save or discard). */
  discard: () => void;
  /** False until the factory list is available (needed for the ?factory= preselect). */
  ready: boolean;
}

const Ctx = createContext<AddApi | null>(null);

export function useAdd(): AddApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAdd must be used inside <AddProvider>');
  return v;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function makeTitle(factoryName: string, date: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(date);
  const when = m ? `${MONTHS[+m[2] - 1]} ${m[1]}` : '';
  return [factoryName, when].filter(Boolean).join(' ');
}

export function AddProvider({ children }: { children: ReactNode }) {
  const { factories, ready, uploadFile } = useData();
  const [params] = useSearchParams();
  const queryFactory = useRef(params.get('factory'));
  const [state, rawDispatch] = useReducer(reducer, null, () => loadDraft() ?? initialState());
  const stateRef = useRef(state);
  stateRef.current = state;
  const discarded = useRef(false);
  const files = useRef(new Map<string, File>());
  const previews = useRef(new Map<string, string>());

  const dispatch = useCallback((a: Action) => rawDispatch(a), []);

  // Persist on every change (unless the draft was just discarded or saved).
  useEffect(() => {
    if (!discarded.current) saveDraft(state);
  }, [state]);

  // ?factory=:id preselects once and skips step 1. A different factory than the stored draft starts fresh.
  const applied = useRef(false);
  useEffect(() => {
    const id = queryFactory.current;
    if (!id || applied.current || !ready) return;
    applied.current = true;
    const f = factories.find((x) => x.id === id);
    if (!f) return;
    const cur = stateRef.current;
    if (cur.factoryId === f.id) {
      rawDispatch({ type: 'patch', patch: { factoryLocked: true } });
    } else {
      rawDispatch({ type: 'reset', state: { ...initialState(), factoryId: f.id, factoryLocked: true, category: f.category } });
    }
  }, [ready, factories]);

  // Free local preview URLs when the flow goes away.
  useEffect(() => {
    const p = previews.current;
    return () => p.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const factory = useMemo(() => factories.find((f) => f.id === state.factoryId) ?? null, [factories, state.factoryId]);
  const defaultTitle = makeTitle(factory?.name ?? '', state.date);

  const selectFactory = useCallback((f: Factory) => {
    const cur = stateRef.current;
    rawDispatch({
      type: 'patch',
      patch: { factoryId: f.id, ...(cur.categoryTouched ? {} : { category: f.category as Category }) },
    });
  }, []);

  const setText = useCallback((text: string) => {
    const cur = stateRef.current;
    const res = parseList(text, { category: cur.category });
    const prevEdited = cur.rows.filter((r) => !r.manual && r.edited);
    const used = new Set<string>();
    const rows: DraftRow[] = res.rows.map((r) => {
      const keep = prevEdited.find((p) => !used.has(p.key) && p.raw === r.raw);
      if (keep) { used.add(keep.key); return keep; }
      return { key: newKey('r'), raw: r.raw, manual: false, edited: false, item: r.item, confidence: r.confidence, issues: r.issues };
    });
    const manual = cur.rows.filter((r) => r.manual);
    rawDispatch({ type: 'setText', text, rows: [...rows, ...manual], skipped: res.skipped.map((s) => ({ line: s.line, raw: s.raw, reason: s.reason })) });
  }, []);

  const runUpload = useCallback((key: string, file: File) => {
    rawDispatch({ type: 'updateFile', key, patch: { status: 'uploading', pct: 0, error: undefined } });
    uploadFile(file, (pct) => rawDispatch({ type: 'updateFile', key, patch: { pct } })).then(
      (ref) => rawDispatch({ type: 'updateFile', key, patch: { status: 'done', pct: 100, ref } }),
      (e: unknown) => rawDispatch({ type: 'updateFile', key, patch: { status: 'error', error: e instanceof Error ? e.message : 'Upload failed. Please try again.' } }),
    );
  }, [uploadFile]);

  const addFiles = useCallback((list: File[]) => {
    for (const file of list) {
      const key = newKey('f');
      files.current.set(key, file);
      if (file.type.startsWith('image/')) {
        try { previews.current.set(key, URL.createObjectURL(file)); } catch { /* no preview */ }
      }
      rawDispatch({ type: 'addFile', file: { key, name: file.name || 'Photo', mime: file.type, size: file.size, status: 'uploading', pct: 0 } });
      runUpload(key, file);
    }
  }, [runUpload]);

  const retryFile = useCallback((key: string) => {
    const f = files.current.get(key);
    if (f) runUpload(key, f);
  }, [runUpload]);

  const previewUrl = useCallback((key: string) => previews.current.get(key), []);

  const discard = useCallback(() => {
    discarded.current = true;
    clearDraft();
  }, []);

  const value = useMemo<AddApi>(
    () => ({ state, dispatch, factory, dirty: isDirty(state), defaultTitle, selectFactory, setText, addFiles, retryFile, previewUrl, discard, ready }),
    [state, dispatch, factory, defaultTitle, selectFactory, setText, addFiles, retryFile, previewUrl, discard, ready],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
