import { Textarea } from "@/components/ui/textarea";
import { SCOPE_CARD_EMPTY_TEXT, scopeCardFields, type ScopeCard } from "./model";

/** Read-only scope card. Empty fields stay visible with an explicit absence text. */
export function ScopeCardFacts({
  card,
  id = "scope-card",
}: {
  card: ScopeCard | undefined;
  id?: string;
}) {
  return (
    <section className="scope-card" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>Mój zakres</h3>
      <dl className="scope-card-facts">
        {scopeCardFields.map((field) => {
          const value = card?.[field.key].trim() ?? "";
          return (
            <div key={field.key}>
              <dt>{field.label}</dt>
              <dd data-empty={value ? undefined : ""}>{value || SCOPE_CARD_EMPTY_TEXT}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

/** Editable scope card fields shared by the profile and the application form. All optional. */
export function ScopeCardEditor({
  value,
  onChange,
  idPrefix,
  disabled,
}: {
  value: ScopeCard;
  onChange: (value: ScopeCard) => void;
  idPrefix: string;
  disabled?: boolean;
}) {
  return (
    <div className="scope-card-editor">
      {scopeCardFields.map((field) => {
        const id = `${idPrefix}-${field.key}`;
        return (
          <div className="field" key={field.key}>
            <label htmlFor={id}>{field.label} (opcjonalnie)</label>
            <p className="scope-card-hint" id={`${id}-hint`}>
              {field.hint}
            </p>
            <Textarea
              id={id}
              disabled={disabled}
              rows={3}
              maxLength={1000}
              aria-describedby={`${id}-hint`}
              value={value[field.key]}
              onChange={(event) => onChange({ ...value, [field.key]: event.target.value })}
            />
          </div>
        );
      })}
    </div>
  );
}
