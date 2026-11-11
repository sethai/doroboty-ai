import { z } from "zod";
import type { State } from "./model";

/** E1: does showing the scope card to employers change who they invite? Unit: one job. */
export const scopeCardVariants = ["none", "control", "scope_card"] as const;
export type ScopeCardVariant = (typeof scopeCardVariants)[number];
export const scopeCardVariantLabels: Record<ScopeCardVariant, string> = {
  none: "brak (poza eksperymentem)",
  control: "control (bez karty)",
  scope_card: "scope_card (z kartą)",
};

export const experimentEventNames = [
  "scope_card_section_viewed",
  "scope_card_skipped",
  "application_submitted",
  "application_form_abandoned",
  "employer_candidate_list_viewed",
  "employer_scope_card_impression",
  "employer_application_opened",
  "employer_tab_opened",
  "employer_screening_decision",
  "interview_scheduled",
  "post_interview_decision_recorded",
] as const;
export type ExperimentEventName = (typeof experimentEventNames)[number];
const eventId = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/);
const attributes = z
  .record(z.string().max(60), z.union([z.string().max(200), z.number(), z.boolean()]))
  .refine((value) => Object.keys(value).length <= 12);
export const experimentEventSchema = z.object({
  event: z.enum(experimentEventNames),
  ts: z.iso.datetime(),
  publicationId: eventId,
  variant: z.enum(scopeCardVariants),
  applicationId: eventId.optional(),
  actorId: eventId.optional(),
  attrs: attributes,
});
export type ExperimentEvent = z.infer<typeof experimentEventSchema>;
export type ExperimentEventAttributes = ExperimentEvent["attrs"];
export const MAX_EXPERIMENT_EVENTS = 5000;

/** Deterministic 50/50 assignment from the job id (32-bit FNV-1a). */
export function assignScopeCardVariant(jobId: string): Exclude<ScopeCardVariant, "none"> {
  let hash = 0x811c9dc5;
  for (let i = 0; i < jobId.length; i++) {
    hash ^= jobId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 2 === 0 ? "control" : "scope_card";
}

type Job = State["jobs"][number];
type Application = State["applications"][number];
export function jobVariant(job: Pick<Job, "scopeCardVariant"> | undefined): ScopeCardVariant {
  return job?.scopeCardVariant ?? "none";
}
/** Employers see the card only while the global flag is on and the job is in the card arm. */
export function employerSeesScopeCard(state: State, jobId: string) {
  const job = state.jobs.find((x) => x.id === jobId);
  return Boolean(state.experiment?.e1Enabled) && jobVariant(job) === "scope_card";
}
export function hasScopeCard(application: Pick<Application, "scopeCard">) {
  return Boolean(application.scopeCard?.ownWork.trim());
}
export function truncate(text: string, max = 140) {
  const value = text.trim();
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

const screeningStages = new Set(["reviewed", "interview_invited", "rejected"]);
function applicationOutcome(application: Application) {
  const stages = application.events.map((event) => event.stage);
  const heldAt = stages.indexOf("first_conversation_held");
  const afterHeld = heldAt >= 0 ? stages.slice(heldAt + 1) : [];
  const decision = afterHeld.find((stage) => stage === "continued" || stage === "rejected");
  return {
    screened: stages.slice(1).some((stage) => screeningStages.has(stage)),
    invitedAt: application.events.find((event) => event.stage === "interview_invited")?.at,
    interviewed: decision !== undefined,
    continued: decision === "continued",
  };
}
const ratio = (part: number, whole: number) =>
  whole === 0 ? null : Math.round((part / whole) * 1000) / 10;

export type PublicationMetrics = {
  publicationId: string;
  title: string;
  companyName: string;
  period: "eksperyment" | "bazowy";
  scopeCardVariant: ScopeCardVariant;
  publishedAt: string;
  roleCategory: Job["category"];
  nApplications: number;
  nWithCard: number;
  pctScreened: number | null;
  nInvited: number;
  pctInvited: number | null;
  daysToFirstInterview: number | null;
  nInterviews: number;
  nContinue: number;
  pctContinueOfInterviews: number | null;
  pctContinueOfInterviewsWithCard: number | null;
  nAbandonedForms: number;
};

/** One row per job, computed from submitted applications, stage histories and form events. */
export function publicationMetrics(state: State): PublicationMetrics[] {
  return state.jobs.map((job) => {
    const applications = state.applications.filter((x) => x.jobId === job.id);
    const outcomes = applications.map((application) => ({
      card: hasScopeCard(application),
      ...applicationOutcome(application),
    }));
    const interviewed = outcomes.filter((x) => x.interviewed);
    const interviewedWithCard = interviewed.filter((x) => x.card && x.invitedAt);
    const firstInvite = outcomes
      .map((x) => x.invitedAt)
      .filter((x): x is string => Boolean(x))
      .sort()[0];
    const variant = jobVariant(job);
    return {
      publicationId: job.id,
      title: job.title,
      companyName: state.companies.find((x) => x.id === job.companyId)?.name ?? "",
      period: variant === "none" ? "bazowy" : "eksperyment",
      scopeCardVariant: variant,
      publishedAt: job.publishedAt,
      roleCategory: job.category,
      nApplications: applications.length,
      nWithCard: outcomes.filter((x) => x.card).length,
      pctScreened: ratio(outcomes.filter((x) => x.screened).length, applications.length),
      nInvited: outcomes.filter((x) => x.invitedAt).length,
      pctInvited: ratio(outcomes.filter((x) => x.invitedAt).length, applications.length),
      daysToFirstInterview: firstInvite
        ? Math.round(((Date.parse(firstInvite) - Date.parse(job.publishedAt)) / 864e5) * 10) / 10
        : null,
      nInterviews: interviewed.length,
      nContinue: interviewed.filter((x) => x.continued).length,
      pctContinueOfInterviews: ratio(
        interviewed.filter((x) => x.continued).length,
        interviewed.length,
      ),
      pctContinueOfInterviewsWithCard: ratio(
        interviewedWithCard.filter((x) => x.continued).length,
        interviewedWithCard.length,
      ),
      nAbandonedForms: (state.events ?? []).filter(
        (event) => event.event === "application_form_abandoned" && event.publicationId === job.id,
      ).length,
    };
  });
}

const csvColumns: [keyof PublicationMetrics, string][] = [
  ["publicationId", "publication_id"],
  ["title", "title"],
  ["companyName", "company"],
  ["period", "period"],
  ["scopeCardVariant", "scope_card_variant"],
  ["publishedAt", "published_at"],
  ["roleCategory", "role_category"],
  ["nApplications", "n_applications"],
  ["nWithCard", "n_with_card"],
  ["pctScreened", "pct_screened"],
  ["nInvited", "n_invited"],
  ["pctInvited", "pct_invited"],
  ["daysToFirstInterview", "days_to_first_interview"],
  ["nInterviews", "n_interviews"],
  ["nContinue", "n_continue"],
  ["pctContinueOfInterviews", "pct_continue_of_interviews"],
  ["pctContinueOfInterviewsWithCard", "pct_continue_of_interviews_with_card"],
  ["nAbandonedForms", "n_abandoned_forms"],
];
export function metricsCsv(rows: PublicationMetrics[]) {
  const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    csvColumns.map(([, header]) => header).join(","),
    ...rows.map((row) => csvColumns.map(([key]) => cell(row[key])).join(",")),
  ].join("\n");
}
