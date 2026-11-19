"use client";

import { useState } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { CopyButton } from "@/components/admin/copy-button";
import { DEFAULT_SELECTION_TEMPLATE, fillTemplate, PLACEHOLDERS, type SelectionTemplate, type TemplateVars } from "@/features/selection/template";
import type { ActionResult } from "@/lib/server";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/**
 * Edits the selection email. The preview fills the placeholders for one real team,
 * so organisers can see exactly what will be pasted or opened in their mail app.
 */
export function SelectionTemplateEditor({ action, initial, sample, canEdit }: { action: Action; initial: SelectionTemplate; sample: (Omit<TemplateVars, "telegramLink"> & { label: string }) | null; canEdit: boolean }) {
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [link, setLink] = useState(initial.telegramLink);
  const vars = sample ? { ...sample, telegramLink: link } : { telegramLink: link };
  const pSubject = fillTemplate(subject, vars);
  const pBody = fillTemplate(body, vars);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ActionForm action={action} submitLabel="Save template">
        <label className="grid gap-1.5 text-sm">
          <span className="field-label">Subject</span>
          <input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={300} className="input" disabled={!canEdit} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="field-label">Message</span>
          <textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} required maxLength={8000} rows={18} className="input font-mono text-xs leading-relaxed" disabled={!canEdit} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="field-label">Telegram channel link ({"{telegramLink}"})</span>
          <input name="telegramLink" type="url" value={link} onChange={(e) => setLink(e.target.value)} required className="input" disabled={!canEdit} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!canEdit}
            onClick={() => {
              setSubject(DEFAULT_SELECTION_TEMPLATE.subject);
              setBody(DEFAULT_SELECTION_TEMPLATE.body);
              setLink(DEFAULT_SELECTION_TEMPLATE.telegramLink);
            }}
          >
            Reset to default (not saved yet)
          </button>
        </div>
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">Placeholders you can use</summary>
          <ul className="mt-2 grid gap-1">
            {Object.entries(PLACEHOLDERS).map(([k, v]) => (
              <li key={k}>
                <code className="font-mono">{`{${k}}`}</code> · {v}
              </li>
            ))}
          </ul>
        </details>
      </ActionForm>

      <div className="grid content-start gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Preview{sample ? ` · ${sample.label}` : ""}</p>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={pSubject} label="Copy subject" />
            <CopyButton text={pBody} label="Copy message" />
          </div>
        </div>
        <div className="rounded-xl border border-line p-4 text-sm">
          <p className="mb-3 font-semibold">{pSubject}</p>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{pBody}</pre>
        </div>
        <p className="text-xs text-muted">
          The portal never sends this email. Open <a className="underline" href="/admin/final-selection">Final selection</a> to open a filled-in copy for each team in your own mail app, or to copy it.
        </p>
      </div>
    </div>
  );
}
