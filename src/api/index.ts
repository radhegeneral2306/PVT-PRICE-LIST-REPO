import { env } from '../lib/env';
import { realApi } from './client';
import { createMockApi } from './mock';
import type { Api } from './types';

export { ApiError } from './types';
export type { Api, ApiErrorCode, UploadPayload } from './types';

/** The only api object the rest of the app uses. Empty VITE_API_URL => in-memory mock. */
export const api: Api = env.useMock ? createMockApi() : realApi;
