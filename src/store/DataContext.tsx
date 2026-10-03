import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { api } from '../api';
import { compressImage } from '../lib/imageCompress';
import type { DataApi } from '../types';
import { DataEngine } from './engine';
import { createIdbKV, createLocalSyncStore, safeKV } from './storage';

const Ctx = createContext<DataApi | null>(null);
const RETRY_MS = 20_000;

export function DataProvider({ children }: { children: ReactNode }) {
  const [engine] = useState(
    () => new DataEngine({ api, kv: safeKV(createIdbKV()), sync: createLocalSyncStore(), compress: compressImage }),
  );
  const state = useSyncExternalStore(engine.subscribe, engine.getState, engine.getState);

  useEffect(() => {
    void engine.init();
    const on = () => engine.setOnline(true);
    const off = () => engine.setOnline(false);
    const vis = () => {
      if (document.visibilityState === 'visible') void engine.retryIfNeeded();
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    document.addEventListener('visibilitychange', vis);
    const timer = window.setInterval(() => void engine.retryIfNeeded(), RETRY_MS);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      document.removeEventListener('visibilitychange', vis);
      window.clearInterval(timer);
    };
  }, [engine]);

  // Revoke blob: URLs only when the provider goes away for good.
  useEffect(() => () => engine.dispose(), [engine]);

  const value = useMemo<DataApi>(
    () => ({
      ...state,
      login: engine.login,
      logout: engine.logout,
      refresh: engine.refresh,
      getItems: engine.getItems,
      getAllCurrentItems: engine.getAllCurrentItems,
      getFileUrl: engine.getFileUrl,
      saveFactory: engine.saveFactory,
      savePricelist: engine.savePricelist,
      uploadFile: engine.uploadFile,
      saveSettings: engine.saveSettings,
      listUsers: engine.listUsers,
      saveUser: engine.saveUser,
      deleteUser: engine.deleteUser,
    }),
    [engine, state],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData must be used inside <DataProvider>');
  return v;
}
