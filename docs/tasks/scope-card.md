# Scope card ("Mój zakres") — idea I1

## Intent

Let a candidate describe their own contribution in four short fields that reach the employer unchanged, and show that card to the recruiter at the top of the submitted application. The candidate keeps one card in the profile and reuses it across applications.

Problem being addressed (O1): from the application alone a recruiter cannot tell what the candidate did personally; this usually surfaces only in the interview. This prototype change demonstrates the mechanism for a test with a real person; it is not evidence that it improves hiring decisions.

> **Superseded in part (2026-11-11):** the E1 change (`e1-scope-card-experiment.md`) made every card field optional, added „Pomiń kartę” and shows the card to employers only in the `scope_card` arm. Decision 2 and the "Required on submit" column below describe the first version only.

## Decisions (accepted 2026-11-11)

1. No writing-assistant simulation. The prototype has no assistant (CAN-12), so the fields reach the employer exactly as typed; the form says so.
2. "Mój własny wkład" is required on submission; the other three fields are optional. The existing answer (minimum 20 characters) stays.
3. Match Score stays in the employer header metadata; the card becomes the first content of the record sheet, before the Answer/CV tabs.
4. One card per candidate profile. The application form is prefilled from the profile (or from a saved draft), is editable per application, and an explicit "Zapisz kartę w profilu" action updates the profile card.
5. Seed data: Marek has a filled profile card and a card in the example application; Anna starts empty.
6. No experiment flag or variant toggle.

## Fields

| Key          | Label                             | Required on submit |
| ------------ | --------------------------------- | ------------------ |
| `project`    | Projekt i kontekst                | no                 |
| `ownWork`    | Mój własny wkład                  | yes                |
| `othersWork` | Wkład innych osób                 | no                 |
| `result`     | Rezultat i czego nie mogę pokazać | no                 |

Empty fields are rendered as "brak informacji w zgłoszeniu", never hidden.

## Affected routes and owners

| Route                                          | Owner                                               | Change                                                                                                                                            |
| ---------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/#/app/profil`                                | `ProfilePage` (workspace.tsx)                       | New "Mój zakres" form section with its own save action                                                                                            |
| `/#/app/profil/podglad`                        | `ProfilePage preview`                               | Card rendered read-only                                                                                                                           |
| `/#/aplikuj/:slug`                             | `ApplyPage` (workspace.tsx), application.css        | Card section between CV and answer; prefill; draft save; "Zapisz kartę w profilu"; required own-work validation and focus; editing resets consent |
| `/#/app/aplikacje/:id`, `/#/app/kandydaci/:id` | `ApplicationRecord` → `RecordSheet` new `lead` slot | Immutable submitted card before tabs                                                                                                              |
| `/#/app/kandydaci`                             | `ApplicationsPage employer`                         | One line with own contribution above the summary                                                                                                  |

Design system: host extension composed from existing recipes (record-sheet surface, H3 26px, dl/dt/dd facts as in the offer terms and application preview facts, Field/Textarea/Button). No new color, font or card family. The kit stays immutable.

## Data

- Shared Zod `scopeCardSchema` (four trimmed strings, max 1000) used by forms and domain operations.
- Optional `scopeCard` on person, draft and application; version-1 saves and imports without it remain valid. Submitted card is a snapshot and does not change when the profile card changes.
- New action `scope_card` (candidate only) saves the profile card. `submit` and `draft` carry `scopeCard`; `submit` rejects an empty own contribution.

## Acceptance criteria

- Candidate can fill, save to profile, reload and see the card prefilled in a new application.
- Submission without own contribution shows an inline error, focuses the field and keeps the input.
- Draft save and reload keep card fields.
- Employer and candidate record views show the submitted card before the tabs; empty fields show "brak informacji w zgłoszeniu"; later profile edits do not change the submitted card.
- Old saves/imports without cards still load.
- Desktop (1280) and mobile (390/320) without horizontal overflow; keyboard order follows visual order.
- `./scripts/verify` passes; FEATURES.md updated.

## Implementation and verification

- Domain: `scopeCardSchema`, `submittedScopeCardSchema`, `scopeCardFields`, `scope_card` action and optional `scopeCard` on person/draft/application in `model.ts`; Marek's seed card in `people.json`.
- UI: `scope-card.tsx` (`ScopeCardFacts`, `ScopeCardEditor`), profile form and preview, application form section, `RecordSheet` `lead` slot, employer list line; styles in `records.css`. RECORDS.md documents the new slot and components; FEATURES.md rows CAN-03/07/09/10/13/15, EMP-07/08 and SYS-10 updated.
- Tests: one new unit test (required own contribution, snapshot immutability, employer cannot save a card, draft keeps card, legacy saves valid, seed). Browser journeys updated for the required field, plus a new journey covering profile save → reuse → submit → employer view at 390/320px with Axe.

### What actually ran (2026-11-11)

- Machine has Node 26.8.1, not Node 24. `./scripts/verify` therefore stops at the Node 24 guard in `design-system:check`. Playwright Chromium was initially missing; the user installed it (`npx playwright install chromium`).
- Ran the gate steps individually under Node 26: format:check, lint, typecheck, unit tests (28 passed), verify:packet and build passed. In `design-system:check`, the user's `./scripts/verify` run confirmed "Design-system reference verified: 67 files match version 1.0.0"; the kit's own example check (`agent-kit/scripts/check.mjs`) then stopped at its Node 24 guard and did not execute.
- `test:e2e` under Node 26 after the browser install: first run 34 passed, 1 failed. The failure was a test defect (the validation journey expected two alerts; the app correctly also shows the missing-approval alert). After fixing the expectation: 35 passed, including the new scope-card journey. Inspected `artifacts/scope-card-employer-320.png`: card before the Answer/CV tabs, explicit empty fields, no clipping at 320px.
- Final gate: after the user installed Node 24.22.2 (`brew install node@24`), `./scripts/verify` with that Node passed end to end (exit 0): formatting; kit file check (67 files match 1.0.0) and kit example check (6/6 tests, 333 local references); lint; typecheck; 28 unit tests; baseline packet (120 journeys); build (existing >500 kB chunk warning only); 35 Chromium journeys.
- Manual checks in the dev preview (127.0.0.1:3001): employer record at 1280/390/320px (no horizontal overflow, card before tabs, empty fields explicit), employer list line, application validation (own-contribution error and focus), save card to profile, submit, profile prefill after reload. Axe (axe-core from `@axe-core/playwright`) on profile, profile preview, candidate list/record, application form, employer list and both employer records: 0 violations.

## Separate review

Reviewed the full diff. Found and fixed one test defect, in two steps: the validation journey first asserted a single alert, then two; the app shows all three missing requirements (own contribution, short answer, approval) with focus on the first. Remaining notes: the "Zapisz kartę w profilu" confirmation uses the form's existing status region near the submit actions, so it is announced but not visually next to the button; the card is shown for legacy applications without one as four explicit absences. No new tokens, fonts, dependencies or network requests. Nothing committed.
