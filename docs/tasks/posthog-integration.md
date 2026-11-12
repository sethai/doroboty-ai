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
