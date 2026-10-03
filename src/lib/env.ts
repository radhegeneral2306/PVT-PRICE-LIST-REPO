// Build-time environment. An empty VITE_API_URL means "use the in-memory mock".
const raw = (import.meta.env?.VITE_API_URL as string | undefined) ?? '';

export const env = {
  apiUrl: raw.trim(),
  get useMock(): boolean {
    return this.apiUrl === '';
  },
};
