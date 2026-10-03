// STUB: owner agent replaces this file. Must export DataProvider and useData(): DataApi.
import { createContext, useContext, type ReactNode } from 'react';
import type { DataApi } from '../types';
const Ctx = createContext<DataApi | null>(null);
export function DataProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={null}>{children}</Ctx.Provider>;
}
export function useData(): DataApi {
  const v = useContext(Ctx);
  if (!v) return { session: null } as unknown as DataApi;
  return v;
}
