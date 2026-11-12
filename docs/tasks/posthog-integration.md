# PostHog integration

## Intent

Add PostHog product analytics to the prototype with the PostHog wizard (`npx @posthog/wizard`, v2.92.1, React Router detected), without breaking the participant setup or the "no private free text" rule.

## Acceptance criteria

- PostHog is opt-in: it starts only when `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` and `VITE_PUBLIC_POSTHOG_HOST` are set. Locally they live in `.env.development.local` (dev server only, ignored; template `.env.example` is committed). Deployed builds take them from the hosting environment, e.g. Netlify.
- With no `.env`, `npm run dev`, the static build and the browser journeys behave as before and make no PostHog requests.
- Custom events carry ids, categories, stages and booleans only. No notes, answers, scope-card text or other free text.
- Session recordings, if enabled in the PostHog project, mask all inputs and all text.
- The E1 browser-local event log (OPS-05/SYS-03) is unchanged and independent.
- FEATURES.md SYS-03 and the implementation limits describe the new behavior.

## Review of the wizard output

Kept: `posthog.init` in `src/main.tsx`, `PostHogErrorBoundary`, `src/features/prototype/analytics.ts` (`captureEvent` no-ops when unconfigured), persona `identify`/`reset` in `store.tsx`, ten product events in feature files.

Changed after review:

- Removed the wizard's development-mode `throw` when the env variables are missing; it stopped `npm run dev` for anyone without `.env`.
- Added `session_recording: { maskAllInputs: true, maskTextSelector: "*" }`.
- Moved the wizard's `.env` to `.env.development.local`: `vite build` read `.env`, so `npm run check` built a PostHog-enabled bundle and 6 browser journeys failed (including the no-external-requests journey and submit clicks under a paused clock). With the dev-only file the gate is hermetic again.
- `.gitignore`: the wizard's redundant `.env` line became `!.env.example` because `.env*` also ignored the template.

Notes: `identify` sends the synthetic persona name and role. The wizard also sorted `package.json` dependencies alphabetically, with no version changes besides the two new packages.

## Verification

2026-11-12, Node 24.22.2 (Homebrew `node@24`; the default Node 26 is rejected by the design-system kit check): `./scripts/verify` passed — formatting, design-system check (67 files), lint, typecheck, 37 unit tests, packet verification (120 journeys), build, 36 Playwright journeys. With the PostHog-enabled build the same journeys had 6 failures, which is why keys stay out of production builds made locally.

## Production deploy (2026-11-12)

- The user set `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` and `VITE_PUBLIC_POSTHOG_HOST` (EU) in Netlify, all contexts, not secret. They match the local dev values.
- Deployed local `main` at `cb7cc3f` (plus the untracked `netlify.toml`) with the Netlify MCP deploy: deploy `6af5d9732bcc3764cbcae9d3`, live at https://doroboty-ai-4axq.netlify.app.
- Live check in the in-app browser on `#/oferty`: PostHog `config.js`, `/e/` events and `/i/v1/logs` returned 200 from `eu.i.posthog.com`; the session recorder loaded (masking config applies); no console errors.

## Hash-route pageviews and same-origin proxy (2026-11-12)

Problem seen in PostHog live events: very little activity while browsing production.

Findings on https://doroboty-ai-4axq.netlify.app (SDK debug mode in the in-app browser): the bundle has the expected EU token and host, project autocapture is on (`autocapture_opt_out: false`) and `$autocapture`, `$$heatmap` and `$snapshot` were sent with 200 responses. Three route changes (`#/firmy/brightlabs`, `#/oferty`, `#/metodologia`) produced no `$pageview`: PostHog's `history_change` pageviews compare `location.pathname`, which stays `/` under `HashRouter`. Privacy blockers commonly drop requests to `*.i.posthog.com`.

Acceptance criteria:

- Each hash-route navigation sends exactly one `$pageview` (none duplicated by StrictMode); `$pageleave` still sent.
- With PostHog configured, the browser talks only to its own origin: `/ingest/static/*` → `eu-assets.i.posthog.com`, `/ingest/*` → `eu.i.posthog.com` (Netlify redirects, mirrored by the Vite dev/preview proxy). `ui_host` points to `eu.posthog.com`.
- With no PostHog variables nothing changes: no proxy, no requests, all journeys pass.

Verification: `npm run dev` with keys in the in-app browser and SDK debug on: `/`, `#/oferty` and `#/metodologia` sent exactly three `$pageview`s; every PostHog request went to `127.0.0.1:3001/ingest/...` with 200 (config, extensions, flags, `/e/`, `/i/v0/e/`, `/s/`, logs); no console errors. `./scripts/verify` on Node 24.22.2 passed: kit (67 files), 37 unit tests, packet (120 journeys), build, 36 Playwright journeys. The Netlify redirects are verified only after a deploy.
