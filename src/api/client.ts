import { ApiError, type Api } from './types';

export { ApiError };
export type { ApiErrorCode } from './types';

const TIMEOUT_MS = 30_000;

/**
 * POST one action to the Apps Script web app.
 * Content-Type text/plain avoids a CORS preflight (Apps Script cannot answer OPTIONS).
 */
export async function callApi<T>(
  action: string,
  params: Record<string, unknown> = {},
  token?: string,
  url: string = import.meta.env.VITE_API_URL as string,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...(token ? { token } : {}), ...params }),
      redirect: 'follow',
      signal: ctrl.signal,
    });
  } catch (e) {
    const timedOut = ctrl.signal.aborted;
    throw new ApiError(
      'NETWORK',
      timedOut ? 'The server took too long to answer.' : 'Cannot reach the server. Check your internet.',
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new ApiError('SERVER', `Server problem (${res.status}). Try again in a minute.`);
  let body: { ok?: boolean; data?: T; error?: string };
  try {
    body = await res.json();
  } catch {
    throw new ApiError('SERVER', 'The server sent an unreadable answer. Try again.');
  }
  if (body && body.ok) return body.data as T;
  const msg = (body && body.error) || 'Something went wrong.';
  if (msg === 'SESSION_EXPIRED') throw new ApiError('SESSION_EXPIRED', 'Your session ended. Please sign in again.');
  throw new ApiError('BAD_REQUEST', msg);
}

export const realApi: Api = {
  login: (name, pin) => callApi('login', { name, pin }),
  bootstrap: (t) => callApi('bootstrap', {}, t),
  getItems: (t, pricelistId) => callApi('getItems', { pricelistId }, t),
  getAllCurrentItems: (t) => callApi('getAllCurrentItems', {}, t),
  saveFactory: (t, draft, id) => callApi('saveFactory', { draft, ...(id ? { id } : {}) }, t),
  savePricelist: (t, draft) => callApi('savePricelist', { draft }, t),
  uploadFile: (t, p) => callApi('uploadFile', { ...p }, t),
  getFile: (t, fileId) => callApi('getFile', { fileId }, t),
  saveSettings: (t, settings) => callApi('saveSettings', { settings }, t),
  listUsers: (t) => callApi('listUsers', {}, t),
  saveUser: (t, u) => callApi('saveUser', { ...u }, t),
  deleteUser: async (t, id) => {
    await callApi('deleteUser', { id }, t);
  },
};
