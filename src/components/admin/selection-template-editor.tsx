"use client";

import { useState } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { CopyButton } from "@/components/admin/copy-button";
import { CopyRichButton } from "@/components/admin/copy-rich-button";
import { DEFAULT_SELECTION_TEMPLATE, PLACEHOLDERS, renderSelectionEmail, type RenderOptions, type SelectionTemplate, type TemplateVars } from "@/features/selection/template";
import type { ActionResult } from "@/lib/server";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
type Sample = TemplateVars & { label: string };

const FIELDS: { key: keyof SelectionTemplate; label: string; type?: string }[] = [
  { key: "telegramLink", label: "Telegram channel link ({telegramLink})", type: "url" },
  { key: "rulebookLink", label: "Rulebook link ({rulebookLink})", type: "url" },
  { key: "websiteLink", label: "Website link ({websiteLink})", type: "url" },
  { key: "telegramLabel", label: "Telegram button text" },
  { key: "rulebookLabel", label: "Rulebook button text" },
  { key: "websiteLabel", label: "Website button text" },
];

/**
 * Edits the selection email and shows the real formatted email, filled in for one
 * team, exactly as it will look when pasted into Gmail.
 */
export function SelectionTemplateEditor({ action, initial, sample, render, canEdit }: { action: Action; initial: SelectionTemplate; sample: Sample | null; render: RenderOptions; canEdit: boolean }) {
  const [tpl, setTpl] = useState<SelectionTemplate>(initial);
  const set = (k: keyof SelectionTemplate) => (e: { target: { value: string } }) => setTpl((t) => ({ ...t, [k]: e.target.value }));
  const { label, ...vars } = sample ?? { label: "" };
  const mail = renderSelectionEmail(tpl, vars, render);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ActionForm action={action} submitLabel="Save template">
        <label className="grid gap-1.5 text-sm">
          <span className="field-label">Subject</span>
          <input name="subject" value={tpl.subject} onChange={set("subject")} required maxLength={300} className="input" disabled={!canEdit} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="field-label">Heading (large title under the banner)</span>
          <input name="heading" value={tpl.heading} onChange={set("heading")} maxLength={200} className="input" disabled={!canEdit} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="field-label">Message</span>
          <textarea name="body" value={tpl.body} onChange={set("body")} required maxLength={8000} rows={20} className="input font-mono text-xs leading-relaxed" disabled={!canEdit} />
        </label>
        <details className="text-xs text-muted" open>
          <summary className="cursor-pointer">Formatting and placeholders</summary>
          <ul className="mt-2 grid gap-1">
            <li>
              Blank line = new paragraph · <code className="font-mono">1.</code> or <code className="font-mono">-</code> at the start of a line = list
            </li>
            <li>
              <code className="font-mono">**bold**</code> · <code className="font-mono">[click here]({"{telegramLink}"})</code> = clickable link
            </li>
            {Object.entries(PLACEHOLDERS).map(([k, v]) => (
              <li key={k}>
                <code className="font-mono">{`{${k}}`}</code> · {v}
              </li>
            ))}
          </ul>
        </details>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <label key={f.key} className="grid gap-1.5 text-sm">
              <span className="field-label">{f.label}</span>
              <input name={f.key} type={f.type ?? "text"} value={tpl[f.key]} onChange={set(f.key)} required={f.type === "url"} maxLength={300} className="input" disabled={!canEdit} />
            </label>
          ))}
        </div>
        <div>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!canEdit} onClick={() => setTpl(DEFAULT_SELECTION_TEMPLATE)}>
            Reset to the default design (press Save to keep it)
          </button>
        </div>
      </ActionForm>

      <div className="grid content-start gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Preview{label ? ` · ${label}` : ""}</p>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={mail.subject} label="Copy subject" />
            <CopyRichButton html={mail.fragment} text={mail.text} />
          </div>
        </div>
        <p className="rounded-lg border border-line px-3 py-2 text-sm">
          <span className="text-muted">Subject: </span>
          {mail.subject}
        </p>
        <iframe title="Email preview" srcDoc={mail.html} sandbox="" className="h-[820px] w-full rounded-xl border border-line bg-white" />
        <p className="text-xs text-muted">
          The portal never sends this email. On <a className="underline" href="/admin/final-selection">Final selection</a>, each team has Gmail, Copy formatted email and Preview buttons. Images load from the live website, so they appear after the site is deployed.
        </p>
      </div>
    </div>
  );
}
