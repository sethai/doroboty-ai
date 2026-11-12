# Link the prototype folder to a Netlify project

## Intent and acceptance

Connect this folder to a Netlify project and list what the app still needs before the first publish. No deploy in this task.

- A Netlify project exists on the `sethai` team and the folder is linked through `.netlify/state.json` (gitignored, local only).
- `netlify.toml` builds the static Vite app reproducibly: `npm run build`, publish `dist`, Node 24 (matches `.nvmrc` and `engines`).
- No SPA fallback redirect, because routing is hash-based.
- The bundle contains only baseline and synthetic material: no `docs/source`, case history or instructor files.

## Decisions (user, 2026-11-12)

- Project name `doroboty-ai` was taken; Netlify created `doroboty-ai-4axq` (https://doroboty-ai-4axq.netlify.app).
- Access: public link. This replaces the readiness report's earlier "no public deployment for now" decision.
  The new project currently requires Netlify team login for all deploys, so it has to be switched to public before participants can open it.

## Validation

`npm run build` passed locally (Node 26 on this machine; Netlify uses Node 24). `dist` is 16 MB: index, JS/CSS bundle, Geist Serif, the illustration, 25 demo logos, 2 synthetic CV PDFs and `case/baseline.csv`. Bundle hosts are only library/schema/example strings; no runtime calls to other hosts.

FEATURES.md reviewed: no product behavior changed, no update needed.

`./scripts/verify` on Node 24.22.2 (Homebrew `node@24`; the default shell Node is 26, which the kit check rejects): formatting, 67-file kit, lint, types, 37 unit tests, packet, build, 37 Chromium journeys, exit 0. An earlier run in the same session failed the render-failure journey (no recovery screen, case page showed only "—" values) and it failed 3/3 when rerun alone. After a fresh `npm run build` it passed 3/3 with and without this change, and the full gate then passed. The cause was not identified; this change touches no `src/` or test files.

## First production publish (2026-11-12)

- Environment check: the app has no dev/production configuration (no `.env`, no `VITE_*` variables; only Vite's built-in `BASE_URL`). `npm run build` is always a production build, so no Netlify environment variable was set.
- Deployed from the local working tree (branch `doublecheck` at `9bead27` plus this uncommitted change) with Netlify's MCP deploy, which uploads the source and builds on Netlify with `netlify.toml`. Deploy `6af5bbdc104125d0e2cfd204` is live at https://doroboty-ai-4axq.netlify.app. No Git continuous deployment is connected.
- Visitor access switched from Netlify team login to public (no password, no team login).
- HTTP checks: `/`, `case/baseline.csv` and the CV PDF return 200. `docs/source/...`, `BRIEF.md`, `src/main.tsx`, `package.json` and `.netlify/state.json` return 404. Hashed assets are served with `public,max-age=31536000,immutable`. HTTP redirects to HTTPS (301).
- Smoke test (`docs/release-smoke-test.md`) in the in-app browser: the deep link `#/oferty/ai-product-manager` opened. Signed in as Anna Kowalska, sent an application, and it was still listed after a reload. Karolina Wiśniewska saw it under „Kandydaci” (saving a decision was not tested). The scenario was reset afterwards. Resources loaded only from the site's own host; no console errors.
- Netlify injects its own `/.netlify/scripts/hud` script and a „Powered by Netlify” badge into the page. Both are served from the same host.
