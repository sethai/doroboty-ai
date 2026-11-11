import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { CheckCircle2, FileText } from "lucide-react";
import { ConfettiBurst, type ConfettiOrigin } from "@/components/confetti-burst";
import { BackLink } from "@/components/back-link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { JobCard } from "@/features/jobs/job-card";
import { ApplicationOfferPreview } from "@/features/jobs/application-offer-preview";
import { usePrototype } from "./store";
import {
  currentPerson,
  emptyScopeCard,
  publishedJobs,
  SCOPE_CARD_EMPTY_TEXT,
  stageLabels,
  MIN_APPLICATION_ANSWER_LENGTH,
  type ScopeCard,
} from "./model";
import { ScopeCardEditor, ScopeCardFacts } from "./scope-card";
import { useVisibleOnce } from "./use-visible-once";
import { employerSeesScopeCard, hasScopeCard, truncate } from "./experiment";
import type { Application } from "./model";
import { PageTitle, Empty, NotFound, Notice } from "./shell";
import { CvAttachment } from "./cv-attachment";
import { MatchScore } from "./match-score";
import { RecruitingApplication } from "./recruiting-application";
import { CandidateApplication } from "./candidate-application";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function PersonPicker() {
  const { state, run } = usePrototype();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const audience = params.get("audience");
  const people =
    audience === "candidate" || audience === "employer"
      ? state.people.filter((person) => person.role === audience)
      : state.people;
  const safeNext = next && /^\/(?!\/)/.test(next) && !next.startsWith("/auth") ? next : null;
  return (
    <section className="prototype-section max-w-4xl">
      <h1>Wybierz osobę</h1>
      <p className="mt-4 mb-8 text-muted-foreground">
        Wybierz profil, z którego chcesz korzystać w prototypie. Hasło nie jest potrzebne.
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        {people.map((person) => (
          <article key={person.id} className="prototype-panel">
            <h2 className="text-xl">{person.name}</h2>
            <p className="my-4 text-muted-foreground">{person.headline}</p>
            <Button
              variant="outline"
              onClick={() => {
                run({ type: "select_person", id: person.id });
                navigate(
                  person.role === "candidate"
                    ? (safeNext ?? "/app")
                    : person.role === "employer"
                      ? "/app/oferty"
                      : "/app/case",
                );
              }}
            >
              Wejdź jako {person.name}
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
export function RequireRole({
  role,
  children,
}: {
  role?: "candidate" | "employer" | "operator";
  children: ReactNode;
}) {
  const { state } = usePrototype();
  const person = currentPerson(state);
  if (!person) return <PersonPicker />;
  if (role && person.role !== role)
    return (
      <Empty>
        <p className="mb-4">
          Ten widok jest dostępny dla{" "}
          {role === "candidate" ? "kandydata" : role === "employer" ? "pracodawcy" : "prowadzącego"}
          .
        </p>
        <Link className={buttonVariants({ variant: "outline" })} to="/auth/sign-in">
          Zmień osobę
        </Link>
      </Empty>
    );
  return children;
}
export function WorkspaceHome() {
  const { state } = usePrototype();
  const person = currentPerson(state)!;
  if (person.role === "operator") return <Navigate to="/app/case" replace />;
  const candidate = person.role === "candidate";
  const applications = state.applications.filter((a) =>
    candidate ? a.candidateId === person.id : a.companyId === person.companyId,
  );
  return (
    <>
      <PageTitle>Witaj, {person.name.split(" ")[0]}</PageTitle>
      <div className="grid gap-5 sm:grid-cols-3">
        {[
          ["Aplikacje", applications.length],
          [
            candidate ? "Zapisane oferty" : "Twoje oferty",
            candidate
              ? state.saved.filter((x) => x.candidateId === person.id).length
              : state.jobs.filter((x) => x.companyId === person.companyId).length,
          ],
          [
            "W trakcie procesu",
            applications.filter((x) => !["rejected", "withdrawn", "hired"].includes(x.stage))
              .length,
          ],
        ].map(([label, value]) => (
          <div className="prototype-panel" key={label}>
            <p className="text-muted-foreground">{label}</p>
            <strong className="mt-3 block text-3xl">{value}</strong>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link className={buttonVariants()} to={candidate ? "/oferty" : "/app/kandydaci"}>
          {candidate ? "Przeglądaj oferty" : "Przejrzyj kandydatów"}
        </Link>
        <Link
          className={buttonVariants({ variant: "outline" })}
          to={candidate ? "/app/profil" : "/app/oferty"}
        >
          {candidate ? "Edytuj profil" : "Zarządzaj ofertami"}
        </Link>
      </div>
    </>
  );
}
export function ProfilePage({ preview = false }: { preview?: boolean }) {
  const { state, run } = usePrototype();
  const person = currentPerson(state)!;
  const [message, setMessage] = useState("");
  const [scopeCard, setScopeCard] = useState<ScopeCard>(person.scopeCard ?? emptyScopeCard);
  const [scopeMessage, setScopeMessage] = useState("");
  function saveScopeCard(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (run({ type: "scope_card", value: scopeCard }))
      setScopeMessage("Karta „Mój zakres” została zapisana w profilu.");
  }
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (
      run({
        type: "profile",
        value: {
          name: String(data.get("name")),
          headline: String(data.get("headline")),
          bio: String(data.get("bio")),
          location: String(data.get("location")),
        },
      })
    )
      setMessage("Profil został zapisany.");
  }
  return (
    <>
      <PageTitle
        action={
          <Link
            to={preview ? "/app/profil" : "/app/profil/podglad"}
            className={buttonVariants({ variant: "outline" })}
          >
            {preview ? "Edytuj profil" : "Podgląd profilu"}
          </Link>
        }
      >
        {preview ? person.name : "Twój profil"}
      </PageTitle>
      {preview ? (
        <div className="prototype-panel space-y-4">
          <h2>{person.headline}</h2>
          <p>{person.location}</p>
          <p>{person.bio}</p>
          {person.role === "candidate" && (
            <ScopeCardFacts card={person.scopeCard} id="profile-scope-card" />
          )}
        </div>
      ) : (
        <form onSubmit={save} className="prototype-panel prototype-form">
          <Field label="Imię i nazwisko">
            <Input name="name" required maxLength={200} defaultValue={person.name} />
          </Field>
          <Field label="Nagłówek zawodowy">
            <Input name="headline" required maxLength={200} defaultValue={person.headline} />
          </Field>
          <Field label="Lokalizacja">
            <Input name="location" required maxLength={200} defaultValue={person.location} />
          </Field>
          <Field label="O mnie">
            <Textarea name="bio" maxLength={12000} defaultValue={person.bio} />
          </Field>
          <Button type="submit">Zapisz profil</Button>
          {message && <p role="status">{message}</p>}
        </form>
      )}
      {!preview && person.role === "candidate" && (
        <form
          onSubmit={saveScopeCard}
          className="prototype-panel prototype-form profile-scope-card mt-6"
          aria-labelledby="profile-scope-title"
        >
          <h2 id="profile-scope-title">Mój zakres</h2>
          <p className="scope-card-intro">
            Opisz raz jeden projekt i swój wkład. Karta wypełni się przy kolejnych aplikacjach, a
            pracodawca zobaczy ją na górze zgłoszenia dokładnie w tej formie.
          </p>
          <ScopeCardEditor value={scopeCard} onChange={setScopeCard} idPrefix="profile-scope" />
          <Button type="submit">Zapisz kartę</Button>
          {scopeMessage && <p role="status">{scopeMessage}</p>}
        </form>
      )}
      <section className="prototype-panel mt-6">
        <h2 className="mb-4 flex items-center gap-2">
          <FileText className="size-5" />
          CV
        </h2>
        <CvAttachment candidateId={person.id} fallbackText={person.cv} />
      </section>
    </>
  );
}
export function SavedPage() {
  const { state } = usePrototype();
  const person = currentPerson(state)!;
  const jobs = publishedJobs(state).filter((job) =>
    state.saved.some((x) => x.candidateId === person.id && x.jobId === job.id),
  );
  return (
    <>
      <PageTitle>Zapisane oferty</PageTitle>
      {jobs.length ? (
        jobs.map((job) => <JobCard key={job.id} job={job} saved />)
      ) : (
        <Empty>
          <p className="mb-4">Nie masz jeszcze zapisanych ofert.</p>
          <Link className={buttonVariants({ variant: "outline" })} to="/oferty">
            Przeglądaj oferty
          </Link>
        </Empty>
      )}
    </>
  );
}
export function ApplyPage() {
  const { slug } = useParams();
  const { state, run } = usePrototype();
  const person = currentPerson(state)!;
  const navigate = useNavigate();
  const job = publishedJobs(state).find((x) => x.slug === slug);
  const draft = state.drafts.find((x) => x.jobId === job?.id && x.candidateId === person.id);
  const notes = draft?.notes ?? "";
  const generated = draft?.generated ?? "";
  const [answer, setAnswer] = useState(draft?.answer ?? "");
  const [scopeCard, setScopeCard] = useState<ScopeCard>(
    draft?.scopeCard ?? person.scopeCard ?? emptyScopeCard,
  );
  const [skipped, setSkipped] = useState(false);
  const skipToggle = useRef<HTMLButtonElement>(null);
  const focusAfterSkip = useRef(false);
  const started = useRef(false);
  const reachedScopeCard = useRef(false);
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [attempted, setAttempted] = useState(false);
  const answerInput = useRef<HTMLTextAreaElement>(null);
  const sendButton = useRef<HTMLButtonElement>(null);
  const submittedOnce = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [confettiOrigin, setConfettiOrigin] = useState<ConfettiOrigin | null>(null);
  useEffect(() => {
    if (!submitted) return;
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 900;
    const timeout = window.setTimeout(() => navigate("/app/aplikacje?wyslano=1"), delay);
    return () => window.clearTimeout(timeout);
  }, [submitted, navigate]);
  const existing = state.applications.find(
    (x) => x.jobId === job?.id && x.candidateId === person.id,
  );
  const formShown = Boolean(job && (!existing || submitted));
  const jobId = job?.id;
  const prefilledFromProfile = Boolean(person.scopeCard && !draft?.scopeCard);
  const scopeSection = useVisibleOnce<HTMLElement>(
    () => {
      reachedScopeCard.current = true;
      if (jobId)
        run({
          type: "log_event",
          event: "scope_card_section_viewed",
          jobId,
          attrs: { prefilled_from_profile: prefilledFromProfile },
        });
    },
    { enabled: formShown },
  );
  // Leaving a started, unsent form counts as abandoned (in-app navigation or closing the tab).
  useEffect(() => {
    if (!jobId || !formShown) return;
    let logged = false;
    const abandon = () => {
      if (logged || !started.current || submittedOnce.current) return;
      logged = true;
      run({
        type: "log_event",
        event: "application_form_abandoned",
        jobId,
        attrs: { reached_scope_card_section: reachedScopeCard.current },
      });
    };
    window.addEventListener("pagehide", abandon);
    return () => {
      window.removeEventListener("pagehide", abandon);
      abandon();
    };
    // run is recreated per render; the latest state is read through the store ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, formShown]);
  useEffect(() => {
    if (!focusAfterSkip.current) return;
    focusAfterSkip.current = false;
    if (skipped) skipToggle.current?.focus();
    else document.getElementById("application-scope-project")?.focus();
  }, [skipped]);
  const answerLength = answer.trim().length;
  const answerInvalid = attempted && answerLength < MIN_APPLICATION_ANSWER_LENGTH;
  const consentInvalid = attempted && !consent;
  if (!job) return <NotFound />;
  if (existing && !submitted)
    return (
      <section className="prototype-section">
        <Notice>Aplikacja na tę ofertę została już wysłana.</Notice>
        <Link to={`/app/aplikacje/${existing.id}`} className={buttonVariants()}>
          Zobacz aplikację
        </Link>
      </section>
    );
  function submit(e: FormEvent) {
    e.preventDefault();
    if (submittedOnce.current) return;
    setAttempted(true);
    if (answerLength < MIN_APPLICATION_ANSWER_LENGTH) {
      answerInput.current?.focus();
      return;
    }
    if (!consent) {
      document.getElementById("application-consent")?.focus();
      return;
    }
    if (
      run({
        type: "submit",
        jobId: job!.id,
        notes,
        generated,
        answer,
        scopeCard: skipped ? undefined : scopeCard,
        consent,
      })
    ) {
      submittedOnce.current = true;
      setSubmitted(true);
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const rect = sendButton.current?.getBoundingClientRect();
        if (rect)
          setConfettiOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      }
    }
  }
  return (
    <section className="pp-container application-page">
      <BackLink to={`/oferty/${job.slug}`}>Wróć do oferty</BackLink>
      <header className="application-header">
        <h1>Aplikuj na ofertę</h1>
        <p>Sprawdź ofertę i opowiedz, dlaczego pasujesz do tej roli.</p>
      </header>
      <div className="application-layout">
        <ApplicationOfferPreview job={job} />
        <form
          noValidate
          onSubmit={submit}
          className="record-sheet application-form"
          aria-labelledby="application-form-title"
        >
          <header className="application-form-intro">
            <h2 id="application-form-title">Twoja aplikacja</h2>
            <p>
              Aplikujesz jako <strong>{person.name}</strong>.
            </p>
          </header>
          <section className="application-form-section" aria-labelledby="application-cv-title">
            <h3 id="application-cv-title">Twoje CV</h3>
            <p className="application-help">Do aplikacji dołączymy CV z Twojego profilu.</p>
            <CvAttachment
              candidateId={person.id}
              fallbackText={person.cv}
              layout="row"
              contextLabel="CV z Twojego profilu"
            />
          </section>
          <section
            ref={scopeSection}
            className="application-form-section application-scope"
            aria-labelledby="application-scope-title"
          >
            <h3 id="application-scope-title">Mój zakres</h3>
            {skipped ? (
              <>
                <p className="application-help">
                  Pominięto kartę. Aplikacja zostanie wysłana bez karty „Mój zakres”.
                </p>
                <div className="scope-card-actions">
                  <Button
                    ref={skipToggle}
                    type="button"
                    variant="outline"
                    disabled={submitted}
                    onClick={() => {
                      focusAfterSkip.current = true;
                      setSkipped(false);
                      setConsent(false);
                    }}
                  >
                    Wypełnij kartę
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="application-help">
                  Opisz jeden projekt i swój wkład. Pracodawca zobaczy tę kartę na górze zgłoszenia,
                  przed Twoją odpowiedzią — dokładnie w tej formie, bez przepisywania. Wszystkie
                  pola są opcjonalne.
                </p>
                {prefilledFromProfile && (
                  <p className="application-help">
                    Karta została wypełniona z Twojego profilu. Zmiany tutaj dotyczą tylko tej
                    aplikacji, dopóki nie zapiszesz ich w profilu.
                  </p>
                )}
                <ScopeCardEditor
                  value={scopeCard}
                  onChange={(value) => {
                    started.current = true;
                    setScopeCard(value);
                    setConsent(false);
                  }}
                  idPrefix="application-scope"
                  disabled={submitted}
                />
                <div className="scope-card-actions">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={submitted}
                    onClick={() => {
                      if (run({ type: "scope_card", value: scopeCard }))
                        setMessage("Karta „Mój zakres” została zapisana w profilu.");
                    }}
                  >
                    Zapisz kartę w profilu
                  </Button>
                  <Button
                    ref={skipToggle}
                    type="button"
                    variant="ghost"
                    disabled={submitted}
                    onClick={() => {
                      started.current = true;
                      focusAfterSkip.current = true;
                      run({ type: "log_event", event: "scope_card_skipped", jobId: job.id });
                      setSkipped(true);
                      setConsent(false);
                    }}
                  >
                    Pomiń kartę
                  </Button>
                </div>
              </>
            )}
          </section>
          <section
            className="application-form-section application-answer"
            aria-label="Odpowiedź do aplikacji"
          >
            <Field label="Dlaczego pasujesz do tej roli?">
              <Textarea
                disabled={submitted}
                ref={answerInput}
                required
                minLength={MIN_APPLICATION_ANSWER_LENGTH}
                maxLength={12000}
                aria-invalid={answerInvalid || undefined}
                aria-describedby="application-answer-help"
                value={answer}
                onChange={(e) => {
                  started.current = true;
                  setAnswer(e.target.value);
                  setConsent(false);
                }}
              />
            </Field>
            <p
              id="application-answer-help"
              role={answerInvalid ? "alert" : undefined}
              className={answerInvalid ? "error-message" : "text-sm text-muted-foreground"}
            >
              {answerInvalid
                ? `Odpowiedź jest za krótka. Wpisz co najmniej ${MIN_APPLICATION_ANSWER_LENGTH} znaków (obecnie: ${answerLength}).`
                : `Minimum ${MIN_APPLICATION_ANSWER_LENGTH} znaków. Obecnie: ${answerLength}.`}
            </p>
          </section>
          <div className="application-form-section application-submit">
            <label className="application-consent">
              <Checkbox
                id="application-consent"
                disabled={submitted}
                checked={consent}
                onCheckedChange={(v) => setConsent(v)}
                aria-invalid={consentInvalid || undefined}
                aria-describedby={consentInvalid ? "application-consent-error" : undefined}
                aria-label="Zatwierdzam treść i przesłanie aplikacji"
              />
              <span>
                Zatwierdzam treść aplikacji i przesłanie profilu oraz przykładowego CV pracodawcy.
              </span>
            </label>
            {consentInvalid && (
              <p id="application-consent-error" className="error-message" role="alert">
                Zatwierdź treść aplikacji i jej przesłanie pracodawcy.
              </p>
            )}
            <div className="application-actions">
              <Button
                ref={sendButton}
                type="submit"
                disabled={submitted}
                className="application-send"
              >
                {submitted && <CheckCircle2 aria-hidden="true" />}
                {submitted ? "Wysłano!" : "Wyślij aplikację"}
              </Button>
              <Button
                type="button"
                disabled={submitted}
                variant="outline"
                onClick={() => {
                  if (run({ type: "draft", jobId: job.id, notes, generated, answer, scopeCard }))
                    setMessage("Szkic został zapisany.");
                }}
              >
                Zapisz szkic
              </Button>
            </div>
            <p
              role="status"
              className={submitted || !message ? "sr-only" : "application-save-status"}
            >
              {submitted ? "Wysłano aplikację. Otwieramy listę Twoich aplikacji." : message}
            </p>
            <p className="application-help">
              Prototyp: aplikacja zostaje w tym przeglądarkowym scenariuszu.
            </p>
          </div>
        </form>
      </div>
      <ConfettiBurst origin={confettiOrigin} />
    </section>
  );
}
function ScopeCardLines({ application }: { application: Application }) {
  const { run } = usePrototype();
  const ref = useVisibleOnce<HTMLDivElement>(
    () =>
      run({
        type: "log_event",
        event: "employer_scope_card_impression",
        applicationId: application.id,
        attrs: { place: "list" },
      }),
    { minMs: 1000 },
  );
  const card = application.scopeCard;
  return (
    <div ref={ref} className="application-scope-lines">
      <p>
        <strong>Mój własny wkład:</strong> {card?.ownWork.trim() || SCOPE_CARD_EMPTY_TEXT}
      </p>
      <p>
        <strong>Wkład innych osób:</strong>{" "}
        {card?.othersWork.trim() ? truncate(card.othersWork) : SCOPE_CARD_EMPTY_TEXT}
      </p>
    </div>
  );
}
export function ApplicationsPage({ employer = false }: { employer?: boolean }) {
  const { state, run } = usePrototype();
  const person = currentPerson(state)!;
  const [query, setQuery] = useState("");
  const [params] = useSearchParams();
  const listLogged = useRef(false);
  useEffect(() => {
    if (!employer || listLogged.current) return;
    listLogged.current = true;
    const companyApplications = state.applications.filter((x) => x.companyId === person.companyId);
    for (const jobId of new Set(companyApplications.map((x) => x.jobId))) {
      const forJob = companyApplications.filter((x) => x.jobId === jobId);
      run({
        type: "log_event",
        event: "employer_candidate_list_viewed",
        jobId,
        attrs: { n_applications: forJob.length, n_with_card: forJob.filter(hasScopeCard).length },
      });
    }
    // Logged once per visit of the list, one event per job present.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const applications = state.applications.filter(
    (x) =>
      (employer ? x.companyId === person.companyId : x.candidateId === person.id) &&
      `${x.candidateName} ${x.jobTitle}`
        .toLocaleLowerCase("pl")
        .includes(query.toLocaleLowerCase("pl")),
  );
  return (
    <>
      <PageTitle>{employer ? "Kandydaci" : "Moje aplikacje"}</PageTitle>
      {params.has("wyslano") && (
        <Notice>
          <CheckCircle2 className="inline size-5" /> Aplikacja została wysłana.
        </Notice>
      )}
      <Field label={employer ? "Szukaj kandydata lub oferty" : "Szukaj oferty"}>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} />
      </Field>
      <div className="mt-6 space-y-4">
        {applications.length ? (
          applications.map((a) => (
            <article className="prototype-panel" key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Link
                    className="text-xl font-semibold text-[var(--gui-link)]"
                    to={`${employer ? "/app/kandydaci" : "/app/aplikacje"}/${a.id}`}
                  >
                    {employer ? a.candidateName : a.jobTitle}
                  </Link>
                  <p className="my-3 text-muted-foreground">
                    {employer
                      ? a.jobTitle
                      : state.companies.find((x) => x.id === a.companyId)?.name}
                  </p>
                  <p>{stageLabels[a.stage]}</p>
                </div>
                <MatchScore score={a.score} />
              </div>
              {employer && employerSeesScopeCard(state, a.jobId) && (
                <ScopeCardLines application={a} />
              )}
              {employer && <p className="mt-4 text-muted-foreground">{a.summary}</p>}
            </article>
          ))
        ) : (
          <Empty>Brak aplikacji spełniających kryteria.</Empty>
        )}
      </div>
    </>
  );
}
export function ApplicationDetail({ employer = false }: { employer?: boolean }) {
  const { id } = useParams();
  const { state } = usePrototype();
  const person = currentPerson(state)!;
  const application = state.applications.find(
    (x) =>
      x.id === id && (employer ? x.companyId === person.companyId : x.candidateId === person.id),
  );
  if (!application) return <NotFound />;
  if (employer) return <RecruitingApplication key={application.id} application={application} />;
  return <CandidateApplication key={application.id} application={application} />;
}
