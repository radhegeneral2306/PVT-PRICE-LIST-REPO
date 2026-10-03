import type {
  Bootstrap,
  Factory,
  FactoryDraft,
  FileRef,
  Item,
  Pricelist,
  PricelistDraft,
  Role,
  Session,
  Settings,
  User,
} from '../types';

export type ApiErrorCode = 'SESSION_EXPIRED' | 'NETWORK' | 'SERVER' | 'BAD_REQUEST';

export class ApiError extends Error {
  code: ApiErrorCode;
  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export interface UploadPayload {
  name: string;
  mime: string;
  base64: string;
}

/** One method per action in docs/api-contract.md. Same shape for the real client and the mock. */
export interface Api {
  login(name: string, pin: string): Promise<Session>;
  bootstrap(token: string): Promise<Bootstrap>;
  getItems(token: string, pricelistId: string): Promise<Item[]>;
  getAllCurrentItems(token: string): Promise<Item[]>;
  saveFactory(token: string, draft: FactoryDraft, id?: string): Promise<Factory>;
  savePricelist(token: string, draft: PricelistDraft): Promise<Pricelist>;
  uploadFile(token: string, payload: UploadPayload): Promise<FileRef>;
  getFile(token: string, fileId: string): Promise<{ mime: string; base64: string }>;
  saveSettings(token: string, settings: Settings): Promise<Settings>;
  listUsers(token: string): Promise<User[]>;
  saveUser(token: string, u: { id?: string; name: string; role: Role; pin?: string }): Promise<User>;
  deleteUser(token: string, id: string): Promise<void>;
}
