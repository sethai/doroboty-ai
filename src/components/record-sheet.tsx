import type { ReactNode } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { Button } from "@/components/ui/button";

type RecordSection = { value: string; label: string; content: ReactNode };

export function RecordSheet({
  label,
  sections,
  lead,
  attachment,
  children,
  footer,
  onValueChange,
}: {
  label: string;
  sections: RecordSection[];
  lead?: ReactNode;
  attachment?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Called with the newly selected section value. */
  onValueChange?: (value: string) => void;
}) {
  return (
    <section className="record-sheet" aria-label={label}>
      <h2 className="sr-only">{label}</h2>
      {lead && <div className="record-lead">{lead}</div>}
      <Tabs.Root
        defaultValue={sections[0]?.value}
        onValueChange={(value) => onValueChange?.(String(value))}
      >
        <Tabs.List className="record-tabs" aria-label={label} activateOnFocus>
          {sections.map((section) => (
            <Tabs.Tab
              key={section.value}
              value={section.value}
              className="record-tab"
              render={<Button variant="ghost" />}
            >
              {section.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {attachment && <div className="record-attachment">{attachment}</div>}
        {sections.map((section) => (
          <Tabs.Panel key={section.value} value={section.value} className="record-reading">
            {section.content}
          </Tabs.Panel>
        ))}
      </Tabs.Root>
      {children && <div className="record-section">{children}</div>}
      {footer && <footer className="record-footer">{footer}</footer>}
    </section>
  );
}
