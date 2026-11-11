# Record sheets and process timelines — host components

These components implement the shared employer and candidate process-view composition. See the [host catalog](HOST-COMPONENTS.md) for return links, application preview, hover and motion, and [status](STATUS.md) for unresolved findings. They extend the React host using Poster People typography, paper/white/ink/pink, existing controls and the r24 outlined reading surface. They are not a new release of the immutable v1 reference.

## RecordSheet

Owner: src/components/record-sheet.tsx; styles: src/app/records.css.

| Prop          | Contract                                                                                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| label         | Accessible section and tab-list name.                                                                                                                                                        |
| lead          | Optional content rendered before the tabs, inside the same surface and separated by a rule. Used for the candidate-authored scope card („Mój zakres”), which must be read before the answer. |
| sections      | Nonempty array of unique `{ value, label, content }` entries. Labels are concise; content supplies its section heading and reading content. First section is initially active.               |
| attachment    | Optional persistent file row outside the changing panels.                                                                                                                                    |
| children      | Optional integrated editor/supporting section, independent of panel mounting.                                                                                                                |
| onValueChange | Optional callback with the newly selected section value (used for the local E1 tab event).                                                                                                   |
| footer        | Optional actions or terminal-state explanation.                                                                                                                                              |

Use one outlined surface for related submitted materials, editing and decisions. The sheet includes a visually hidden H2 from its label; the application answer, submitted CV and recruiter note use the existing 26px H3 scale, retaining section spacing and the associated textarea label. Do not wrap each section in another panel. Base UI Tabs owns selection, roving focus, arrows/Home/End and panel relationships; selection follows keyboard focus because all content is local; tabs compose the existing Button via `render`. Base UI owns active-panel mounting; an exiting panel may briefly remain inert during its lifecycle. Select panels by their accessible tab name in tests rather than assuming there is always exactly one panel node. Keep unsaved notes outside panels so switching tabs preserves them. Panels remain keyboard reachable. Long content wraps and retains line breaks; buttons wrap labels at small widths.

## CvAttachment

Owner: [cv-attachment.tsx](../../src/features/prototype/cv-attachment.tsx).

| Prop         | Contract                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------- |
| candidateId  | Required scenario candidate identifier.                                                             |
| fallbackText | Required full saved CV text; compare this snapshot with the fixture before choosing a prepared PDF. |
| layout       | `stack` (default) or `row`; both preserve the existing file actions.                                |
| preview      | Boolean, default false; embed the matching local PDF, otherwise render the complete custom text.    |
| contextLabel | Defaults to “CV z momentu aplikowania”; editable application uses “CV z Twojego profilu”.           |

CvAttachment's `layout="row"` supplies an unboxed icon, filename/context and existing local open/download links. Default `layout="stack"` preserves profile and submitted candidate-detail consumers; the editable application form uses the row composition. `contextLabel` describes the attachment context (default: submitted snapshot; the application form uses “CV z Twojego profilu”). Row-mode custom CVs retain their complete saved text. `preview` adds a titled, framed native PDF iframe beneath the file row, using the exact same local snapshot URL as the file links. Mount this composition inside the CV panel, not the persistent attachment slot: the Answer panel has no CV controls or viewer. Keep open/download links available when the browser cannot display an embedded PDF. No PDF parsing, remote viewer or dependency is added. Only a matching immutable fixture snapshot gets its prepared PDF; custom text snapshots with preview enabled get an explicit text descriptor and their complete text instead of an iframe. Never label a mismatched prepared PDF as the submitted CV.

## ProcessTimeline

Owner: src/components/process-timeline.tsx; styles: src/app/records.css.

`items` contains ordered `{ id, title, dateTime, content? }` records. Render a semantic ordered list, complete stage names, machine-readable time and optional preformatted note. The last recorded event has `aria-current="step"`. Dots and connecting lines are decorative. Supply actual events only, never future completed stages or invented dates. Callers enforce role boundaries before passing private notes.

## Shared application composition

[ApplicationRecord](../../src/features/prototype/application-record.tsx) composes the shared header, RecordSheet answer/CV snapshots, score and open history/summary margin. Props are `application` (explicit public snapshot fields), `companyName`, `audience`, projected `history`, optional `statusRef`, `children` and `footer`. The audience chooses role-title/candidate-name header context and the correct BackLink; it is presentation, not authorization. Controllers must apply the existing owner/company lookup first.

[CandidateApplication](../../src/features/prototype/candidate-application.tsx) projects each event to stage/date before passing history. It never supplies employer notes, source notes or generated drafts to reading panels or timeline. Its footer owns two-step withdrawal; confirm/cancel focus and surviving status focus follow the action. Terminal states omit actions. [RecruitingApplication](../../src/features/prototype/recruiting-application.tsx) supplies authorized employer history and owns its note editor and existing stage operations. Shared layout/snapshots must not be copied into another role-specific page.

Both roles use H3 answer/CV headings, CV-only local preview/actions and complete custom-text fallback. The candidate view retains immutable submitted material even if the current profile changes. Candidate ownership checks and the user's existing local application IDs/data remain unchanged.

## Employer composition and states

Owner: src/features/prototype/recruiting-application.tsx. At wide widths, open history/summary margin sits left of a single sheet. At <=950px, materials precede history in both DOM and visual reading order; history and summary share two columns until <=600px, then stack. Header and actions wrap; narrow pages retain complete content at 320px. At Wojtek’s request the unchanged scenario Match Score is a noninteractive supporting-fact tag in the metadata row below the candidate name; the visible “Wynik przykładowy” caption is removed. The summary stays below history. This placement does not add automated assessment behavior.

Keep actual available transitions from `nextStages`. Notes append only on successful stage mutation and then clear; failure retains them. Move focus to the updated status after action buttons change, announce success politely and omit note/actions at terminal stages. Candidate and employer controllers share ApplicationRecord but retain their separate action and history-visibility boundaries. Preserve ownership checks before rendering this composition. A role label describes this scenario's UI visibility, not secure storage.

Validate keyboard tabs/focus, note retention, local PDF snapshot identity, custom/long imported content, terminal states, mobile order, role omissions and persistence. Run the project gate and compare real screenshots against the selected composition and source foundations. Test results do not establish human design acceptance.

## MatchScore

Owner: src/features/prototype/match-score.tsx; host styles: src/app/poster-people.css; host tokens: tokens.css. `score` is a validated domain percentage (integer 0–100). Reuse this noninteractive pill in both role lists/details and employer header metadata. The percentage remains visible text; color is supplementary. Preserve the existing band boundaries: 0–39 red (#ff6b79), 40–59 orange (#ffb15c), 60–79 yellow (#ffe45b), 80–100 vivid green (#00c853). All fills use ink text for contrast. Measured ink/fill contrast in the implementation task was 6.45:1 red, 9.89:1 orange, 13.95:1 yellow and 7.94:1 green; recheck after token changes. These dedicated host fact colors do not replace error/success action palettes or change the original kit. Do not implement a second score renderer or reuse an unrelated pink status tag. The underlying scenario score and summary remain unchanged.

## ScopeCardFacts and ScopeCardEditor

Owner: [scope-card.tsx](../../src/features/prototype/scope-card.tsx); styles: src/app/records.css. `ScopeCardFacts` renders the shared four-field card as an H3 „Mój zakres” plus `dl/dt/dd` on a paper (`--pp-paper`) inset with r18 and no second contour; fields flow into as many ≥260px columns as fit and stack on narrow sheets. Empty fields remain visible with „brak informacji w zgłoszeniu” in muted italic. `ScopeCardEditor` renders the same fields as labelled textareas with hints (`aria-describedby`), an optional required own-contribution flag, inline error and focus ref. Profile, application form, both record views and the employer list use these owners; field labels come from `scopeCardFields` in the domain model. This is a host extension composed from existing recipes, not a v1 kit component.

`ApplicationRecord` takes `showScopeCard` (default true; the employer controller passes the E1 visibility rule), `onScopeCardVisible` (called once after the card was in view for one second) and `onTabChange`. Hiding the card removes the lead slot entirely, so `control`/`none` records match the pre-card sheet. The employer list uses the same visibility rule for its two scope lines.
