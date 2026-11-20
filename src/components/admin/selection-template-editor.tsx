"use client";

import { useState } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { CopyButton } from "@/components/admin/copy-button";
import { CopyRichButton } from "@/components/admin/copy-rich-button";
import { DEFAULT_SELECTION_TEMPLATE, PLACEHOLDERS, renderSelectionEmail, SELECTION_DESIGNS, type SelectionDesign, type SelectionTemplate, type TemplateVars } from "@/features/selection/template";
import { cn } from "@/lib/cn";
import type { ActionResult } from "@/lib/server";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
type Sample = { vars: TemplateVars; members: string[]; label: string };
type Key = keyof SelectionTemplate;
type Field = { key: Key; label: string; type?: string; required?: boolean; rows?: number };

/** Fields each design shows. Everything else is kept in hidden inputs so saving never wipes the other design. */
const DESIGN_FIELDS: Record<SelectionDesign, { text: Field[]; lines: Field[] }> = {
  technova: {
    text: [
      { key: "subject", label: "Subject", required: true },
      { key: "body", label: "Message (above the team card)", required: true, rows: 8 },
      { key: "telegramNote", label: "Telegram note (above the button)", rows: 3 },
    ],
    lines: [
      { key: "emoji", label: "Icon at the top (emoji)" },
      { key: "headline", label: "Headline" },
      { key: "subheadline", label: "Line under the headline" },
      { key: "telegramLabel", label: "Telegram button text" },
      { key: "websiteCaption", label: "Text under the website link" },
    ],
  },
  classic: {
    text: [
      { key: "classicSubject", label: "Subject", required: true },
      { key: "classicHeading", label: "Heading (large title under the banner)" },
      { key: "classicBody", label: "Message", required: true, rows: 18 },
    ],
    lines: [
      { key: "classicTelegramLabel", label: "Telegram button text" },
      { key: "classicRulebookLabel", label: "Rulebook button text" },
      { key: "classicWebsiteLabel", label: "Website button text" },
    ],
  },
};

const SHARED: Field[] = [
  { key: "helplineEmail", label: "Helpline email", type: "email" },
  { key: "telegramLink", label: "Telegram link ({telegramLink})", type: "url", required: true },
  { key: "websiteLink", label: "Website link ({websiteLink})", type: "url", required: true },
  { key: "rulebookLink", label: "Rulebook link ({rulebookLink})", type: "url", required: true },
];

/** Edits the selection email and shows the real formatted email for one team, exactly as it will be sent. */
export function SelectionTemplateEditor({
  action,
  initial,
  defaults = DEFAULT_SELECTION_TEMPLATE,
  sample,
  assetBase,
  canEdit,
  footnote,
}: {
  action: Action;
  initial: SelectionTemplate;
  defaults?: SelectionTemplate;
  sample: Sample | null;
  assetBase: string;
  canEdit: boolean;
  footnote?: string;
}) {
  const [tpl, setTpl] = useState<SelectionTemplate>(initial);
  const set = (k: Key) => (e: { target: { value: string } }) => setTpl((t) => ({ ...t, [k]: e.target.value }));
  const mail = renderSelectionEmail(tpl, sample?.vars ?? {}, { members: sample?.members ?? [], assetBase });
  const fields = DESIGN_FIELDS[tpl.design];
  const shown = new Set<Key>(["design", ...fields.text.map((f) => f.key), ...fields.lines.map((f) => f.key), ...SHARED.map((f) => f.key)]);
  const hidden = (Object.keys(tpl) as Key[]).filter((k) => !shown.has(k));

  const resetDesign = () =>
    setTpl((t) => {
      const next = { ...t };
      for (const f of [...fields.text, ...fields.lines]) (next as Record<Key, string>)[f.key] = defaults[f.key];
      return next;
    });

  const input = (f: Field) =>
    f.rows ? (
      <textarea name={f.key} value={tpl[f.key]} onChange={set(f.key)} required={f.required} maxLength={8000} rows={f.rows} className="input font-mono text-xs leading-relaxed" disabled={!canEdit} />
    ) : (
      <input name={f.key} type={f.type ?? "text"} value={tpl[f.key]} onChange={set(f.key)} required={f.required} maxLength={300} className="input" disabled={!canEdit} />
    );

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ActionForm action={action} submitLabel="Save template">
        <fieldset className="grid gap-2">
          <legend className="field-label mb-1.5">Design</legend>
          <input type="hidden" name="design" value={tpl.design} />
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Email design">
            {(Object.entries(SELECTION_DESIGNS) as [SelectionDesign, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={tpl.design === key}
                disabled={!canEdit}
                onClick={() => setTpl((t) => ({ ...t, design: key }))}
                className={cn("btn btn-sm", tpl.design === key ? "btn-primary" : "btn-secondary")}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted">The saved design is used everywhere: preview, Copy formatted email, Final selection and Send to all.</span>
        </fieldset>

        {fields.text.map((f) => (
          <label key={f.key} className="grid gap-1.5 text-sm">
            <span className="field-label">{f.label}</span>
            {input(f)}
          </label>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          {[...fields.lines, ...SHARED].map((f) => (
            <label key={f.key} className="grid gap-1.5 text-sm">
              <span className="field-label">{f.label}</span>
              {input(f)}
            </label>
          ))}
        </div>
        {hidden.map((k) => (
          <input key={k} type="hidden" name={k} value={tpl[k]} />
        ))}

        <details className="text-xs text-muted">
          <summary className="cursor-pointer">Formatting and placeholders</summary>
          <ul className="mt-2 grid gap-1">
            <li>
              Blank line = new paragraph · <code className="font-mono">1.</code> or <code className="font-mono">-</code> at the start of a line = list
            </li>
            <li>
              <code className="font-mono">**bold**</code> · <code className="font-mono">[click here]({"{telegramLink}"})</code> = clickable link
            </li>
            {tpl.design === "technova" && <li>The team name and member list are filled in automatically in the team card.</li>}
            {Object.entries(PLACEHOLDERS).map(([k, v]) => (
              <li key={k}>
                <code className="font-mono">{`{${k}}`}</code> · {v}
              </li>
            ))}
          </ul>
        </details>
        <div>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!canEdit} onClick={resetDesign}>
            Reset {SELECTION_DESIGNS[tpl.design]} text to default (press Save to keep it)
          </button>
        </div>
      </ActionForm>

      <div className="grid content-start gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            Preview · {SELECTION_DESIGNS[tpl.design]}
            {sample ? ` · ${sample.label}` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={mail.subject} label="Copy subject" />
            <CopyRichButton html={mail.fragment} text={mail.text} />
          </div>
        </div>
        <p className="rounded-lg border border-line px-3 py-2 text-sm">
          <span className="text-muted">Subject: </span>
          {mail.subject}
        </p>
        <iframe title="Email preview" srcDoc={mail.html} sandbox="" className={cn("h-[960px] w-full rounded-xl border border-line", tpl.design === "classic" ? "bg-[#f1f5f9]" : "bg-[#0b0603]")} />
        <p className="text-xs text-muted">
          {footnote ?? (
            <>
              Saving never sends anything. To email every selected team at once, use the Send button above (super admin). To send one team by hand, use <a className="underline" href="/admin/final-selection">Final selection</a>.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
