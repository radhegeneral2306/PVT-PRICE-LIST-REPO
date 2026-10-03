# Build brief (all build agents read this first)

Product: **Pricelist Vault**, phone-first PWA (React + TypeScript + Vite, HashRouter) for a tile + sanitaryware trader to store/compare factory pricelists. Google Sheets (via Apps Script) is the database. Hosted on GitHub Pages. Owner is non-technical: copy must be plain English, labels functional.

Approved look = the mockups. BEFORE coding UI, open the matching `mockups/screens/*.html` (source) and `mockups/out/*.png` (render, use the Read tool to view). Reproduce them faithfully: same layout, spacing, hierarchy, tokens. `mockups/tokens.css` holds the design tokens + base classes (accent green, Geist fonts, radius scale, light + dark via `data-theme`). `docs/api-contract.md` + `src/types.ts` are the contract. Do not change types.ts (ask in your final report if you need a change).

## Rules
- Stack is fixed: React 19, react-router-dom 7 (HashRouter), plain CSS from `src/styles/app.css` (no Tailwind), Phosphor icon CSS font (`<i className="ph ph-house" />`, bold `ph-bold`, fill `ph-fill`) already imported in main.tsx, idb-keyval, Vitest. Do not add dependencies without a strong reason; if unavoidable say so in your report.
- Edit ONLY the files you own. Other agents work in parallel; a stub file owned by someone else may be mid-edit. Typecheck errors in files you do not own are not your problem.
- No em-dash or en-dash characters in any visible text or code comments you write. No emoji. One accent colour. Label above input. Tap targets >= 44px. Use `min-height: 100dvh`, never `100vh`. Honour `prefers-reduced-motion`. Every screen needs loading (skeleton), empty and error states. Dark mode must work.
- Phone first (390px), then wider: at >= 1024px the shell becomes side rail + wider content (see mockups/screens/d-*.html).
- Components and screens must work against the mock API (`VITE_API_URL` empty) so the whole app runs and is testable without Google.
- Verify: `npm run typecheck` (own files clean), `npm test` if you wrote tests. UI agents: run the dev server (`npx vite --port 5173 &`), screenshot with Playwright (`/opt/node-tools/node_modules/playwright/index.mjs`, chromium at `/opt/pw-browsers/chromium`, viewport 390x844, base path is `/PVT-PRICE-LIST-REPO/#/...`), Read the PNG, compare to the mockup PNG, fix differences. Save screenshots under `/tmp/claude-0/-home-user-PVT-PRICE-LIST-REPO/c724b6c1-ed11-5751-aaf9-b6280116c3ff/scratchpad/` only, never in the repo.
- Do NOT git commit or push. Final report: files created, public exports others must know, anything you could not finish. Short.
