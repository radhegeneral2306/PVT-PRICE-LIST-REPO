# Pricelist Vault

Private PWA for storing and comparing factory pricelists (tiles and sanitaryware). Phone first, works on PC, installable, works offline for viewing.

- Frontend: React + TypeScript + Vite, hosted on GitHub Pages
- Database: Google Sheets through a Google Apps Script web app (`apps-script/Code.gs`)
- Files (PDF/photos): saved in a private Google Drive folder

## Setup (owner)
1. Follow `docs/SETUP.md` (Hinglish, step by step) to create the Sheet and deploy the script. You get a web app URL ending in `/exec`.
2. In GitHub: Settings > Secrets and variables > Actions > Variables, add `VITE_API_URL` = that URL.
3. In GitHub: Settings > Pages > Source = GitHub Actions. Merge to `main`; `.github/workflows/deploy.yml` builds and publishes.
4. Open the Pages URL on the phone, sign in, then "Add to Home screen" / "Install app".

## Develop
```
npm install
npm run dev        # runs with a built-in mock backend when VITE_API_URL is empty
                   # mock logins: Owner / 1234, Rakesh (staff) / 5678
npm run typecheck
npm test
npm run build
```
For a real backend locally, put `VITE_API_URL=<exec url>` in `.env.local`.

## Layout
- `src/types.ts`, `docs/api-contract.md`: the contract between app and script
- `src/ui`: design system and shell; `src/features/*`: screens
- `src/store`, `src/api`: offline-first data layer, real client and mock
- `src/lib/parseList.ts`: turns pasted text into pricelist rows
- `mockups/`: approved design renders
