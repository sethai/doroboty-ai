import type { Ref } from "react";
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

/** Editable scope card fields shared by the profile and the application form. */
export function ScopeCardEditor({
  value,
  onChange,
  idPrefix,
  disabled,
  ownWorkRequired,
  ownWorkError,
  ownWorkRef,
}: {
  value: ScopeCard;
  onChange: (value: ScopeCard) => void;
  idPrefix: string;
  disabled?: boolean;
  ownWorkRequired?: boolean;
  ownWorkError?: string;
  ownWorkRef?: Ref<HTMLTextAreaElement>;
}) {
  return (
    <div className="scope-card-editor">
      {scopeCardFields.map((field) => {
        const id = `${idPrefix}-${field.key}`;
        const own = field.key === "ownWork";
        const error = own ? ownWorkError : undefined;
        const required = own && ownWorkRequired;
        return (
          <div className="field" key={field.key}>
            <label htmlFor={id}>
              {field.label}
              {required ? " (wymagane)" : " (opcjonalnie)"}
            </label>
            <p className="scope-card-hint" id={`${id}-hint`}>
              {field.hint}
            </p>
            <Textarea
              id={id}
              ref={own ? ownWorkRef : undefined}
              disabled={disabled}
              rows={3}
              maxLength={1000}
              required={required || undefined}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-hint ${id}-error` : `${id}-hint`}
              value={value[field.key]}
              onChange={(event) => onChange({ ...value, [field.key]: event.target.value })}
            />
            {error && (
              <p id={`${id}-error`} className="error-message" role="alert">
                {error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
