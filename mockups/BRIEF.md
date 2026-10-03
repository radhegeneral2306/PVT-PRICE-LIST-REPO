# Mockup brief (shared by all agents)

App: **Pricelist Vault**, internal PWA for a tile + sanitaryware trader (Radhe General) to store and compare factory pricelists. Phone first, then PC. Users: owner + staff.

## Hard rules
- Edit ONLY the files you own (listed in your task). Never edit tokens.css, data.js, render.mjs, BRIEF.md or other agents' files. Need extra CSS? Put a `<style>` block inside your own HTML.
- Every HTML starts with: `<link rel="stylesheet" href="../tokens.css">` and `<script src="../data.js"></script>` (data in `window.DATA`). Reuse classes from tokens.css (.app .statusbar .topbar .iconbtn .scroll .tabbar .tab .search .btn .btn-primary .chips .chip .list .row .avatar .section-title .badge .field .input .actionbar .desk .rail .navitem). Read tokens.css and data.js first.
- Use ONLY the sample data in data.js (add nothing that looks like a real brand). Money = Indian format with rupee sign, numbers in `.mono`.
- Phone files are named `m-*.html` (390x844 canvas = `.app`), desktop `d-*.html` (1280x800 = `.desk`). Dark variant: set `<html data-theme="dark">`.
- Navigation model (keep identical everywhere): bottom tab bar with 4 tabs: Home (ph-house), Factories (ph-factory), Search (ph-magnifying-glass), Settings (ph-gear). Mark the right one `.active`. Adding a pricelist = accent "Add pricelist" button (Home) or "+" iconbtn (Factories topbar). Flow screens (add, viewer) hide the tab bar and use `.actionbar` or a back button instead.
- Design rules: ONE accent (the green in tokens). Phosphor icons only (`<i class="ph ph-xxx">`, bold: `ph-bold`, fill: `ph-fill`), never hand-drawn SVG, never emoji. NO em-dashes or en-dashes anywhere in visible text (use hyphen, comma, colon). Label above input, never placeholder-as-label. Group with hairline lists, not boxes inside boxes. Tap targets >= 44px. Text must be AA readable. No decorative dots, no fake version labels, no marketing fluff copy. Plain functional labels.
- Screens must look like a REAL, finished app with realistic filled-in data, not wireframes. Dense enough to be useful, still thumb-friendly. Nothing may overflow or clip awkwardly at 390px.
- Render and LOOK at your own output: `cd /home/user/PVT-PRICE-LIST-REPO && node mockups/render.mjs <file-name-substring>` writes PNG to mockups/out/. Open the PNG with the Read tool, fix issues (overflow, misalignment, weak hierarchy, clipped text), re-render, repeat until you would be happy to show it to the business owner.
- Do not git commit. Final reply: list of files created + any design decisions the owner should know. Keep it short.
