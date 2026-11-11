# E1 experiment instrumentation for the scope card

## Intent

Make the scope card ("Mój zakres", see `scope-card.md`) testable as a controlled experiment: jobs are assigned `control` or `scope_card` at publication, only `scope_card` jobs show the card to employers, candidates see the same form in every job, and every relevant step is logged and summarized per job.

This is a browser-local simulation of the pilot described in the E1 developer brief (2026-11-11). It demonstrates assignment, variants, events and the report on synthetic personas; it does not measure real recruiting outcomes. FEATURES OPS-05 (experiments) and SYS-03 (analytics) were removed earlier; reintroducing them in this local form was decided by the product owner on 2026-11-11.

## Decisions (accepted 2026-11-11)

1. Commit the scope card first (45b5051); E1 is a separate change.
2. Recruiter decisions map to existing stages, no new stages: `reviewed` = `hold`, `interview_invited` = `invite` (also `interview_scheduled`, with the invite time as `interview_at`), `rejected` before an invite = `reject`. After `first_conversation_held`: `continued` = `continue`, `rejected` = `reject`.
3. The employer list stays company-wide. `employer_candidate_list_viewed` is emitted once per job present in the list, with that job's counts.
4. Baseline rows are local jobs with variant `none`, labelled as baseline. The historical `public/case/baseline.csv` stays separate.
5. The instructor persona ("Prowadzący") toggles the global flag and sees the job/variant list and the report on `/#/app/case`. Role selection is a simulation, not security.
6. Seed jobs stay `none`; only jobs published while the flag is on get a variant. The run instructions say so.

## Spec mapping

| Brief                        | Prototype implementation                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Z1 flag and assignment       | `experiment.e1Enabled` in scenario state (default off). New job published while on: `scopeCardVariant` from FNV-1a hash of the job id (even → `control`, odd → `scope_card`) plus `scopeCardAssignedAt`; edits keep the stored assignment. Off: `none`. Turning the flag off hides the card everywhere but keeps assignments and data.                                                                                       |
| Z2 employer views            | Card line, "Wkład innych osób" line (≈140 chars) and record card only when flag on and job variant `scope_card`. Otherwise the views match the pre-card screens. Match Score, order and summary unchanged.                                                                                                                                                                                                                   |
| Z3 optional own contribution | No required field; "Pomiń kartę" collapses the section and submits without a card ("Wypełnij kartę" restores it).                                                                                                                                                                                                                                                                                                            |
| Z4 no assistant              | No writing assistant exists (CAN-12). Test: submitted card equals typed text apart from trimmed ends. `writing_assistant_used` is always false.                                                                                                                                                                                                                                                                              |
| Z5 summary source            | Summary is the fixed persona scenario text (OPS-07), never derived from the card. Applications store `summarySource: "scenario_fixture"`.                                                                                                                                                                                                                                                                                    |
| Z6 events                    | `events` array in scenario state (max 5000, oldest dropped), included in JSON export/import. Domain events (`application_submitted`, screening, interview, post-interview) come from transitions; UI events (section viewed, skipped, abandoned, list viewed, impression ≥1 s, opened, tab) via a `log_event` action. Each has `event`, `ts`, `publicationId`, `variant`, optional `applicationId`/`actorId` and attributes. |
| Z7 report                    | `publicationMetrics(state)` → one row per job with the brief's columns, shown on `/#/app/case` with CSV download; computed from application stage histories plus abandoned-form events.                                                                                                                                                                                                                                      |

## Acceptance criteria

Brief section 4, items 1–10, adapted: deterministic ~50/50 split over 100 ids (unit test); control/none employer views without card elements (browser test); same candidate form in both variants; submit without card and via skip; char-for-char card; summary source stored; event path candidate → list → detail → invite → post-interview decision with `publicationId` and `variant`; report rows for both variants and baseline; flag off hides the card without data loss; 390 px without horizontal overflow. Run `./scripts/verify` on Node 24.

## Implementation and verification

- Domain: `experiment.ts` (variants, event schema, FNV-1a assignment, `employerSeesScopeCard`, `publicationMetrics`, CSV) and `model.ts` (job variant fields, `experiment`/`events` state, `experiment_flag` and `log_event` actions, events from submit and stage transitions, optional card on submit, `summarySource`).
- UI: optional card with „Pomiń kartę”/„Wypełnij kartę” and candidate events in `ApplyPage`; variant-aware list lines and record card with list/detail/tab/impression events (`workspace.tsx`, `recruiting-application.tsx`, `application-record.tsx`, `RecordSheet.onValueChange`); `useVisibleOnce` for section-viewed and ≥1 s impressions; E1 panel on `/#/app/case` (`case.tsx`). FEATURES CAN-09/13, EMP-03/07/08, OPS-01, OPS-05, SYS-03, SYS-10 and RECORDS.md updated.
- Tests: six new unit tests (100-id split, flag/assignment/edit, visibility and kill switch, char-for-char card plus summary source, full event path, report incl. baseline and CSV); card-optional unit test. Browser journey rewritten for E1: seeded `scope_card`/`control` jobs, profile reuse, skip on the card arm, prefilled card on the control arm, employer list/detail per arm, decisions through „Kolejny etap”, impression event, event integrity (publication and variant match the job), report rows for both arms and baseline, Axe on the panel, 390/320 px, flag off hides the card and keeps assignments.

### What actually ran (2026-11-11, Node 24.22.2)

`./scripts/verify` passed (exit 0): formatting, kit checks (67 files, 6/6 example tests), lint, typecheck, 34 unit tests, baseline packet, build (existing >500 kB chunk warning), 35 Chromium journeys. One intermediate e2e run failed because `dist` was stale (Playwright serves the build) and one because the seed helper did not reload after writing localStorage; both were test-harness issues, fixed before the final run. Manual preview check of the instructor panel (flag toggle, job/variant and report tables).

## Separate review

Reviewed the diff against the brief. Known differences, all intentional or prototype limits:

- `interview_at` is the invite time (no scheduling in the prototype); a rejection after an invite but before the conversation is neither a screening nor a post-interview decision event.
- Baseline rows are local `none` jobs, not eight weeks of historical data; `public/case/baseline.csv` stays separate.
- „Control looks as before” is asserted by the absence of card elements and the tabs being first, not by a pixel snapshot.
- The candidate help text („Pracodawca zobaczy tę kartę…”) is identical in both arms as the brief requires, so it is not accurate for `control` jobs; this is a research-ethics choice for the product owner.
- Events are stored only in this browser's scenario (max 5000, oldest dropped) and are exported with it; no delivery anywhere.
- CSV cells are quoted but not protected against spreadsheet formula injection; acceptable for local synthetic data.
