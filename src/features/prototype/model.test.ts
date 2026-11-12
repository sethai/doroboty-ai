import { describe, expect, it } from "vitest";
import { initialState, transition, stateSchema, type State } from "./model";
import {
  assignScopeCardVariant,
  buildExperimentEvent,
  employerSeesScopeCard,
  type ExperimentEvent,
  metricsCsv,
  publicationMetrics,
} from "./experiment";
const card = {
  project: "Automatyzacja zgłoszeń",
  ownWork: "Przeprowadziłam badania i ustaliłam priorytety.",
  othersWork: "",
  result: "",
};
const time = "2026-11-03T10:00:00.000Z";
function as(state: State, id: string) {
  return transition(state, { type: "select_person", id });
}
function submitted() {
  const s = as(initialState(), "candidate-anna");
  return transition(
    s,
    {
      type: "submit",
      jobId: s.jobs[0].id,
      notes: "Original notes",
      generated: "Generated copy",
      answer: "Approved application with sufficient context.",
      scopeCard: card,
      consent: true,
    },
    time,
    "application-anna",
  );
}
describe("coherent browser scenario", () => {
  it("requires approval and prevents duplicate applications", () => {
    const s = as(initialState(), "candidate-anna");
    const input = {
      type: "submit" as const,
      jobId: s.jobs[0].id,
      notes: "",
      generated: "",
      answer: "Approved application with sufficient context.",
      scopeCard: card,
      consent: false,
    };
    expect(() => transition(s, input, time)).toThrow("Zatwierdź");
    expect(() => transition(submitted(), { ...input, consent: true }, time)).toThrow("już wysłana");
    expect(s.applications).toHaveLength(1);
  });
  it("preserves approved sources while profile and notes evolve", () => {
    const s = submitted();
    const app = s.applications.at(-1)!;
    const changed = transition(s, {
      type: "profile",
      value: {
        name: "Updated Name",
        headline: "Updated Headline",
        bio: "Changed",
        location: "Wrocław",
      },
    });
    expect(changed.applications.at(-1)).toEqual(app);
    expect(app.candidateName).toBe("Anna Kowalska");
    expect(app.sourceNotes).toBe("Original notes");
    expect(app.generatedAnswer).toBe("Generated copy");
  });
  it("supports employer review through conversation and continuation without skipping stages", () => {
    let s = as(submitted(), "employer-brightlabs");
    expect(() =>
      transition(
        s,
        { type: "stage", applicationId: "application-anna", stage: "continued", note: "" },
        time,
      ),
    ).toThrow();
    for (const stage of [
      "reviewed",
      "interview_invited",
      "first_conversation_held",
      "continued",
      "hired",
    ] as const)
      s = transition(
        s,
        { type: "stage", applicationId: "application-anna", stage, note: "Employer note" },
        time,
      );
    expect(s.applications.at(-1)?.stage).toBe("hired");
    expect(s.applications.at(-1)?.events).toHaveLength(6);
  });
  it("rejects another employer’s stage writes and another candidate’s withdrawal", () => {
    expect(() =>
      transition(
        as(submitted(), "employer-northstar"),
        { type: "stage", applicationId: "application-anna", stage: "reviewed", note: "" },
        time,
      ),
    ).toThrow();
    expect(() =>
      transition(
        as(submitted(), "candidate-marek"),
        { type: "withdraw", applicationId: "application-anna" },
        time,
      ),
    ).toThrow();
  });
  it("makes withdrawal terminal and keeps drafts and saved jobs person-specific", () => {
    let s = submitted();
    s = transition(s, { type: "withdraw", applicationId: "application-anna" }, time);
    expect(() =>
      transition(
        as(s, "employer-brightlabs"),
        { type: "stage", applicationId: "application-anna", stage: "reviewed", note: "" },
        time,
      ),
    ).toThrow();
    s = transition(s, {
      type: "draft",
      jobId: s.jobs[1].id,
      notes: "Notes",
      generated: "Output",
      answer: "Edited",
    });
    s = transition(s, { type: "toggle_saved", jobId: s.jobs[1].id });
    expect(s.drafts[0].candidateId).toBe("candidate-anna");
    expect(s.saved[0].candidateId).toBe("candidate-anna");
  });
  it("validates broken references, duplicate submissions and invalid histories on import", () => {
    const s = submitted();
    s.applications.push({ ...s.applications.at(-1)!, id: "another-id" });
    expect(stateSchema.safeParse(s).success).toBe(false);
    const broken = submitted();
    broken.applications.at(-1)!.events.push({ stage: "hired", at: time, note: "" });
    broken.applications.at(-1)!.stage = "hired";
    expect(stateSchema.safeParse(broken).success).toBe(false);
    const unknown = initialState();
    unknown.jobs[0].companyId = "missing";
    expect(stateSchema.safeParse(unknown).success).toBe(false);
  });
  it("only publishes own-company jobs and keeps submitted job snapshots unchanged", () => {
    const state = as(submitted(), "employer-brightlabs");
    const updated = { ...state.jobs[0], title: "Updated public role" };
    const result = transition(state, { type: "publish", job: updated });
    expect(result.jobs[0].title).toBe("Updated public role");
    expect(result.applications.at(-1)?.jobTitle).toBe("AI Product Manager");
    expect(() =>
      transition(as(state, "employer-northstar"), { type: "publish", job: updated }),
    ).toThrow();
    expect(() =>
      transition(state, { type: "publish", job: { ...updated, salaryMin: 500, salaryMax: 1 } }),
    ).toThrow();
  });
  it("accepts applications without a card, snapshots the card and keeps old saves valid", () => {
    const s = as(initialState(), "candidate-anna");
    const input = {
      type: "submit" as const,
      jobId: s.jobs[0].id,
      notes: "",
      generated: "",
      answer: "Approved application with sufficient context.",
      consent: true,
    };
    const withoutCard = transition(s, input, time, "application-anna");
    expect(withoutCard.applications.at(-1)?.scopeCard).toBeUndefined();
    const blank = transition(
      s,
      { ...input, scopeCard: { project: " ", ownWork: "", othersWork: "", result: "" } },
      time,
      "application-anna",
    );
    expect(blank.applications.at(-1)?.scopeCard).toBeUndefined();
    let changed = transition(s, { type: "scope_card", value: card });
    expect(changed.people.find((p) => p.id === "candidate-anna")?.scopeCard).toEqual(card);
    changed = transition(changed, { ...input, scopeCard: card }, time, "application-anna");
    changed = transition(changed, {
      type: "scope_card",
      value: { ...card, ownWork: "Inny opis" },
    });
    expect(changed.applications.at(-1)?.scopeCard).toEqual(card);
    expect(() =>
      transition(as(changed, "employer-brightlabs"), { type: "scope_card", value: card }),
    ).toThrow();
    const draft = transition(s, {
      type: "draft",
      jobId: s.jobs[1].id,
      notes: "",
      generated: "",
      answer: "Szkic",
      scopeCard: card,
    });
    expect(draft.drafts.at(-1)?.scopeCard).toEqual(card);
    const legacy = structuredClone(changed);
    delete legacy.applications.at(-1)!.scopeCard;
    for (const person of legacy.people) delete person.scopeCard;
    expect(stateSchema.safeParse(legacy).success).toBe(true);
    expect(initialState().applications[0].scopeCard?.ownWork).toContain("12 wywiadów");
  });
});

describe("E1 scope card experiment", () => {
  function publishNew(state: State, id: string) {
    return transition(
      as(state, "employer-brightlabs"),
      {
        type: "publish",
        job: { ...state.jobs[0], id, slug: `oferta-${id}`, title: `Oferta ${id}` },
      },
      time,
    );
  }
  function enabled() {
    return transition(as(initialState(), "operator"), { type: "experiment_flag", enabled: true });
  }
  it("splits 100 job ids roughly 50/50 and is deterministic", () => {
    const variants = Array.from({ length: 100 }, (_, i) => assignScopeCardVariant(`job-${i}`));
    const cards = variants.filter((x) => x === "scope_card").length;
    expect(cards).toBeGreaterThanOrEqual(40);
    expect(cards).toBeLessThanOrEqual(60);
    expect(assignScopeCardVariant("job-7")).toBe(assignScopeCardVariant("job-7"));
  });
  it("assigns a variant only while the flag is on and keeps it after edits", () => {
    expect(() =>
      transition(as(initialState(), "employer-brightlabs"), {
        type: "experiment_flag",
        enabled: true,
      }),
    ).toThrow();
    const off = publishNew(initialState(), "job-off");
    expect(off.jobs[0].scopeCardVariant).toBe("none");
    let on = publishNew(enabled(), "job-7");
    const job = on.jobs[0];
    expect(job.scopeCardVariant).toBe(assignScopeCardVariant("job-7"));
    expect(job.scopeCardAssignedAt).toBe(time);
    on = transition(as(on, "operator"), { type: "experiment_flag", enabled: false });
    on = transition(as(on, "employer-brightlabs"), {
      type: "publish",
      job: { ...job, title: "Zmieniony tytuł", scopeCardVariant: undefined },
    });
    expect(on.jobs[0]).toMatchObject({
      title: "Zmieniony tytuł",
      scopeCardVariant: job.scopeCardVariant,
      scopeCardAssignedAt: time,
    });
    expect(initialState().jobs.every((x) => x.scopeCardVariant === undefined)).toBe(true);
  });
  it("shows the card to employers only for scope_card jobs while the flag is on", () => {
    const s = enabled();
    s.jobs[0].scopeCardVariant = "scope_card";
    s.jobs[1].scopeCardVariant = "control";
    expect(employerSeesScopeCard(s, s.jobs[0].id)).toBe(true);
    expect(employerSeesScopeCard(s, s.jobs[1].id)).toBe(false);
    expect(employerSeesScopeCard(s, s.jobs[2].id)).toBe(false);
    const off = transition(as(s, "operator"), { type: "experiment_flag", enabled: false });
    expect(employerSeesScopeCard(off, off.jobs[0].id)).toBe(false);
    expect(off.jobs[0].scopeCardVariant).toBe("scope_card");
  });
  it("keeps the submitted card character for character and records the summary source", () => {
    const typed = {
      project: "  Projekt „Ala” — 1/2 ",
      ownWork: "Zrobiłam: A; B & C.\nDruga linia",
      othersWork: "",
      result: "",
    };
    const s = transition(
      as(initialState(), "candidate-anna"),
      {
        type: "submit",
        jobId: initialState().jobs[1].id,
        notes: "",
        generated: "",
        answer: "Approved application with sufficient context.",
        scopeCard: typed,
        consent: true,
      },
      time,
      "application-anna",
    );
    const saved = s.applications.at(-1)!;
    expect(saved.scopeCard).toEqual({ ...typed, project: typed.project.trim() });
    expect(saved.summarySource).toBe("scenario_fixture");
    expect(saved.summary).toBe(initialState().people[0].exampleSummary);
  });
  it("records the candidate → employer event path with publication and variant", () => {
    let s = enabled();
    s.jobs[0].scopeCardVariant = "scope_card";
    const jobId = s.jobs[0].id;
    s = as(s, "candidate-anna");
    const events: ExperimentEvent[] = [
      buildExperimentEvent(
        s,
        { event: "scope_card_section_viewed", jobId, attrs: { prefilled_from_profile: false } },
        time,
      ),
    ];
    const before = structuredClone(s);
    s = transition(
      s,
      {
        type: "submit",
        jobId,
        notes: "",
        generated: "",
        answer: "Approved application with sufficient context.",
        scopeCard: card,
        consent: true,
      },
      time,
      "application-anna",
      events,
    );
    expect(Object.keys(s)).toEqual(Object.keys(before));
    s = as(s, "employer-brightlabs");
    for (const stage of [
      "reviewed",
      "interview_invited",
      "first_conversation_held",
      "continued",
    ] as const)
      s = transition(
        s,
        { type: "stage", applicationId: "application-anna", stage, note: "" },
        time,
        undefined,
        events,
      );
    expect(events.map((x) => x.event)).toEqual([
      "scope_card_section_viewed",
      "application_submitted",
      "employer_screening_decision",
      "employer_screening_decision",
      "interview_scheduled",
      "post_interview_decision_recorded",
    ]);
    expect(events.every((x) => x.publicationId === jobId && x.variant === "scope_card")).toBe(true);
    expect(events[1].attrs).toMatchObject({
      has_card: true,
      card_fields_filled: 2,
      card_own_contribution_chars: card.ownWork.length,
      card_saved_to_profile: false,
      writing_assistant_used: false,
    });
    expect(
      events.filter((x) => x.event === "employer_screening_decision").map((x) => x.attrs.decision),
    ).toEqual(["hold", "invite"]);
    expect(events.at(-1)?.attrs).toMatchObject({ decision: "continue", has_card: true });
    expect(events.find((x) => x.event === "application_submitted")?.actorId).toBe("candidate-anna");
    expect(() =>
      buildExperimentEvent(s, { event: "employer_tab_opened", applicationId: "missing" }, time),
    ).toThrow();
    const failed: ExperimentEvent[] = [];
    expect(() =>
      transition(
        s,
        { type: "stage", applicationId: "application-anna", stage: "reviewed", note: "" },
        time,
        undefined,
        failed,
      ),
    ).toThrow();
    expect(failed).toEqual([]);
  });
  it("reports one row per job for both arms and the baseline", () => {
    let s = enabled();
    s.jobs[0].scopeCardVariant = "scope_card";
    s.jobs[1].scopeCardVariant = "control";
    s = transition(
      as(s, "candidate-anna"),
      {
        type: "submit",
        jobId: s.jobs[0].id,
        notes: "",
        generated: "",
        answer: "Approved application with sufficient context.",
        scopeCard: card,
        consent: true,
      },
      "2026-11-03T10:00:00.000Z",
      "application-anna",
    );
    const abandoned = buildExperimentEvent(
      s,
      {
        event: "application_form_abandoned",
        jobId: s.jobs[1].id,
        attrs: { reached_scope_card_section: true },
      },
      time,
    );
    s = as(s, "employer-brightlabs");
    for (const stage of [
      "reviewed",
      "interview_invited",
      "first_conversation_held",
      "continued",
    ] as const)
      s = transition(
        s,
        { type: "stage", applicationId: "application-anna", stage, note: "" },
        "2026-11-04T10:00:00.000Z",
      );
    s = transition(
      s,
      { type: "stage", applicationId: "application-example", stage: "rejected", note: "" },
      "2026-11-04T10:00:00.000Z",
    );
    const rows = publicationMetrics(s, [abandoned]);
    expect(rows).toHaveLength(s.jobs.length);
    const cardRow = rows.find((x) => x.publicationId === s.jobs[0].id)!;
    expect(cardRow).toMatchObject({
      period: "eksperyment",
      scopeCardVariant: "scope_card",
      nApplications: 2,
      nWithCard: 2,
      pctScreened: 100,
      nInvited: 1,
      pctInvited: 50,
      nInterviews: 1,
      nContinue: 1,
      pctContinueOfInterviews: 100,
      pctContinueOfInterviewsWithCard: 100,
    });
    expect(cardRow.daysToFirstInterview).toBeGreaterThan(0);
    expect(rows.find((x) => x.publicationId === s.jobs[1].id)).toMatchObject({
      scopeCardVariant: "control",
      nApplications: 0,
      pctContinueOfInterviews: null,
      nAbandonedForms: 1,
    });
    expect(rows.find((x) => x.publicationId === s.jobs[2].id)?.period).toBe("bazowy");
    const csv = metricsCsv(rows).split("\n");
    expect(metricsCsv([{ ...rows[0], title: '=HYPERLINK("x")' }])).toContain(
      `"'=HYPERLINK(""x"")"`,
    );
    expect(metricsCsv([{ ...rows[0], daysToFirstInterview: -1.5 }])).toContain('"-1.5"');
    expect(csv[0]).toContain("pct_continue_of_interviews_with_card");
    expect(csv).toHaveLength(rows.length + 1);
  });
});
