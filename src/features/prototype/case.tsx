import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  jobVariant,
  metricsCsv,
  publicationMetrics,
  scopeCardVariantLabels,
  type PublicationMetrics,
} from "./experiment";
import { downloadText } from "./settings";
import { PageTitle } from "./shell";
import { usePrototype } from "./store";

const dateFormat = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });
const formatDate = (value?: string) => (value ? dateFormat.format(new Date(value)) : "—");
const formatValue = (value: number | null, suffix = "") =>
  value === null ? "—" : `${value.toLocaleString("pl-PL")}${suffix}`;

const reportColumns: {
  key: keyof PublicationMetrics;
  label: string;
  format?: (row: PublicationMetrics) => string;
}[] = [
  { key: "title", label: "Oferta" },
  { key: "period", label: "Okres" },
  { key: "scopeCardVariant", label: "Wariant" },
  { key: "nApplications", label: "Aplikacje" },
  { key: "nWithCard", label: "Z kartą" },
  { key: "pctScreened", label: "% przejrzanych", format: (r) => formatValue(r.pctScreened, "%") },
  { key: "nInvited", label: "Zaproszenia" },
  { key: "pctInvited", label: "% zaproszonych", format: (r) => formatValue(r.pctInvited, "%") },
  {
    key: "daysToFirstInterview",
    label: "Dni do 1. zaproszenia",
    format: (r) => formatValue(r.daysToFirstInterview),
  },
  { key: "nInterviews", label: "Rozmowy z decyzją" },
  { key: "nContinue", label: "Kontynuujemy" },
  {
    key: "pctContinueOfInterviews",
    label: "% kontynuujemy",
    format: (r) => formatValue(r.pctContinueOfInterviews, "%"),
  },
  {
    key: "pctContinueOfInterviewsWithCard",
    label: "% kontynuujemy (z kartą)",
    format: (r) => formatValue(r.pctContinueOfInterviewsWithCard, "%"),
  },
  { key: "nAbandonedForms", label: "Porzucone formularze" },
];

export function CasePage() {
  return (
    <>
      <PageTitle>Materiały case study</PageTitle>
      <section className="prototype-panel prototype-form">
        <h2>Etap początkowy</h2>
        <p>
          Zespół chce zwiększyć liczbę ukończonych aplikacji. Sprawdź, gdzie użytkownicy rezygnują i
          co dzieje się po wysłaniu zgłoszenia.
        </p>
        <p>
          Dane historyczne są osobnym materiałem dydaktycznym. Twoje działania w prototypie nie
          zmieniają tych wyników.
        </p>
        <a
          className="text-[var(--gui-link)] underline"
          href={`${import.meta.env.BASE_URL}case/baseline.csv`}
          download
        >
          Pobierz dane etapu początkowego
        </a>
      </section>
      <ExperimentPanel />
    </>
  );
}

function ExperimentPanel() {
  const { state, run } = usePrototype();
  const flagId = useId();
  const enabled = Boolean(state.experiment?.e1Enabled);
  const rows = publicationMetrics(state);
  const events = state.events ?? [];
  return (
    <section
      className="prototype-panel prototype-form experiment-panel mt-6"
      aria-labelledby="experiment-title"
    >
      <h2 id="experiment-title">Eksperyment E1: karta „Mój zakres”</h2>
      <p>
        Każda oferta opublikowana przy włączonym eksperymencie dostaje na stałe wariant{" "}
        <strong>control</strong> (pracodawca nie widzi karty) albo <strong>scope_card</strong>{" "}
        (pracodawca widzi kartę). Kandydaci we wszystkich ofertach widzą ten sam formularz. Oferty
        opublikowane wcześniej mają wariant „brak” i są okresem bazowym.
      </p>
      <p className="scope-card-intro">
        To symulacja w przeglądarce na fikcyjnych personach: pokazuje przydział, zdarzenia i raport,
        ale nie mierzy prawdziwych decyzji rekruterów.
      </p>
      <label className="experiment-flag">
        <Checkbox
          checked={enabled}
          aria-labelledby={flagId}
          onCheckedChange={(checked) => run({ type: "experiment_flag", enabled: checked })}
        />
        <span id={flagId}>
          Eksperyment włączony: nowe oferty dostają wariant, a pracodawcy w wariancie scope_card
          widzą kartę. Wyłączenie ukrywa kartę u wszystkich pracodawców bez usuwania przydziałów i
          danych.
        </span>
      </label>
      <p role="status" className="experiment-status">
        Stan: {enabled ? "włączony" : "wyłączony"}. Zapisane zdarzenia: {events.length}.
      </p>

      <h3>Jak przeprowadzić test</h3>
      <ol className="experiment-steps">
        <li>Włącz eksperyment powyżej.</li>
        <li>
          Jako pracodawca opublikuj co najmniej dwie nowe oferty i sprawdź poniżej, jaki wariant
          dostały.
        </li>
        <li>Jako kandydat aplikuj na te oferty (z kartą, bez karty albo przez „Pomiń kartę”).</li>
        <li>
          Jako pracodawca przejrzyj kandydatów, zaproś na rozmowę i zapisz decyzję po pierwszej
          rozmowie.
        </li>
        <li>Wróć tutaj i pobierz raport oraz zdarzenia.</li>
      </ol>

      <h3 id="experiment-jobs-title">Oferty i przydział wariantu</h3>
      <div
        className="experiment-table-scroll"
        role="region"
        aria-labelledby="experiment-jobs-title"
        tabIndex={0}
      >
        <table className="experiment-table">
          <thead>
            <tr>
              <th scope="col">Oferta</th>
              <th scope="col">Firma</th>
              <th scope="col">Opublikowana</th>
              <th scope="col">Wariant</th>
              <th scope="col">Przydzielono</th>
            </tr>
          </thead>
          <tbody>
            {state.jobs.map((job) => (
              <tr key={job.id}>
                <td>{job.title}</td>
                <td>{state.companies.find((x) => x.id === job.companyId)?.name}</td>
                <td>{formatDate(job.publishedAt)}</td>
                <td>{scopeCardVariantLabels[jobVariant(job)]}</td>
                <td>{formatDate(job.scopeCardAssignedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 id="experiment-report-title">Raport na ofertę</h3>
      <p className="scope-card-intro">
        Główna miara: „% kontynuujemy” — odsetek pierwszych rozmów zakończonych decyzją „Kolejny
        etap”. Zaproszenie to etap „Zaproszenie na rozmowę”, wstrzymanie to „W przeglądzie”.
      </p>
      <div
        className="experiment-table-scroll"
        role="region"
        aria-labelledby="experiment-report-title"
        tabIndex={0}
      >
        <table className="experiment-table">
          <thead>
            <tr>
              {reportColumns.map((column) => (
                <th scope="col" key={column.key}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.publicationId}>
                {reportColumns.map((column) => (
                  <td key={column.key}>
                    {column.format
                      ? column.format(row)
                      : column.key === "scopeCardVariant"
                        ? scopeCardVariantLabels[row.scopeCardVariant]
                        : String(row[column.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="scope-card-actions">
        <Button
          type="button"
          onClick={() => downloadText("e1-raport-ofert.csv", metricsCsv(rows), "text/csv")}
        >
          Pobierz raport (CSV)
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            downloadText("e1-zdarzenia.json", JSON.stringify(events, null, 2), "application/json")
          }
        >
          Pobierz zdarzenia (JSON)
        </Button>
      </div>
    </section>
  );
}
