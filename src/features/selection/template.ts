/**
 * The selection email that organisers send by hand. Pure functions only, so the
 * same code renders it on the server (preview page) and in the browser (editor).
 *
 * The body uses a tiny, safe formatting syntax:
 *   blank line        new paragraph
 *   1. / -            numbered / bulleted list item
 *   **bold**          bold
 *   [text](url)       link; the url may be a placeholder such as {telegramLink}
 * Everything typed is HTML-escaped, and only http(s), mailto and tel links are kept.
 */

export const DEFAULT_TELEGRAM_LINK = "https://t.me/+i1nLFtZoiLkzYThl";
export const DEFAULT_WEBSITE = "https://coutechnova.xyz";

export interface SelectionTemplate {
  subject: string;
  heading: string;
  body: string;
  telegramLink: string;
  rulebookLink: string;
  websiteLink: string;
  telegramLabel: string;
  rulebookLabel: string;
  websiteLabel: string;
}

export const DEFAULT_SELECTION_TEMPLATE: SelectionTemplate = {
  subject: "Congratulations {teamName}! You are selected for the CoU AI Hackathon 2026 final",
  heading: "You're in the final, {teamName}! 🎉",
  body: `Dear {memberNames},

Congratulations! Your team **{teamName}** (Registration ID: **{registrationId}**) has been selected for the final round of the **CoU AI Hackathon 2026** with your idea "{ideaTitle}".

**Next steps**
1. **[Click here]({telegramLink})** to join our official Telegram channel. All announcements, schedules and updates will be shared there.
2. Confirm your place by paying the participation fee of **BDT {feeBdt}** through the [hackathon portal]({websiteLink}) by **{paymentDeadline}**.
3. Read the **[rulebook]({rulebookLink})** carefully before the pre-build period starts.
4. The on-site final takes place on **{eventDate}** at {venue}.

If you have any questions, reply to this email or ask in the Telegram channel.

Best regards,
**CoU AI Hackathon 2026 Organising Committee**
Faculty of Engineering, Comilla University`,
  telegramLink: DEFAULT_TELEGRAM_LINK,
  rulebookLink: `${DEFAULT_WEBSITE}/rulebook.pdf`,
  websiteLink: DEFAULT_WEBSITE,
  telegramLabel: "Join Telegram channel",
  rulebookLabel: "Read the rulebook",
  websiteLabel: "Visit website",
};

export const PLACEHOLDERS = {
  teamName: "Team name",
  registrationId: "Registration ID",
  ideaTitle: "Idea title",
  leaderName: "Team leader's name",
  memberNames: "All member names",
  telegramLink: "Telegram channel link",
  rulebookLink: "Rulebook link",
  websiteLink: "Website link",
  feeBdt: "Participation fee",
  paymentDeadline: "Payment deadline",
  eventDate: "Final event date",
  venue: "Venue",
} as const;

export type TemplateVars = Record<keyof typeof PLACEHOLDERS, string>;

/** Replaces {placeholders}; unknown ones are left as typed so mistakes stay visible. */
export function fillTemplate(text: string, vars: Partial<TemplateVars>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = Object.prototype.hasOwnProperty.call(vars, key) ? vars[key as keyof TemplateVars] : undefined;
    return v === undefined ? whole : String(v);
  });
}

/** "A, B and C" */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** A mailto: link that opens the admin's own mail app; nothing is sent by the portal. */
export function mailtoLink(to: string[], subject: string, body: string): string {
  // Mail clients expect CRLF line breaks in a mailto body.
  const q = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\r?\n/g, "\r\n"))}`;
  return `mailto:${to.map((e) => encodeURIComponent(e).replace(/%40/g, "@")).join(",")}?${q}`;
}

/** A Gmail compose window in the browser (recipients and subject; paste the formatted body). */
export function gmailComposeLink(to: string[], subject: string, body?: string): string {
  const p = new URLSearchParams({ view: "cm", fs: "1", to: to.join(","), su: subject });
  if (body) p.set("body", body);
  return `https://mail.google.com/mail/?${p.toString()}`;
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

export const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Only links a mail client can safely open. */
export function safeUrl(url: string): string | null {
  const u = url.trim();
  return /^(https?:\/\/|mailto:|tel:)/i.test(u) && !/[\s"'<>]/.test(u) ? u : null;
}

const INLINE = /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+?)\*\*/g;
const LINK_STYLE = "color:#6d28d9;font-weight:600;text-decoration:underline";

/** Formats one line. Formatting is read from the template before placeholders are filled, so team data can never inject markup. */
function inlineHtml(src: string, vars: Partial<TemplateVars>): string {
  let out = "";
  let last = 0;
  for (const m of src.matchAll(INLINE)) {
    out += escapeHtml(fillTemplate(src.slice(last, m.index), vars));
    if (m[1] !== undefined) {
      const url = safeUrl(fillTemplate(m[2], vars));
      const label = inlineHtml(m[1], vars);
      out += url ? `<a href="${escapeHtml(url)}" style="${LINK_STYLE}" target="_blank">${label}</a>` : label;
    } else {
      out += `<strong>${inlineHtml(m[3], vars)}</strong>`;
    }
    last = (m.index ?? 0) + m[0].length;
  }
  return out + escapeHtml(fillTemplate(src.slice(last), vars));
}

function inlineText(src: string, vars: Partial<TemplateVars>): string {
  const strip = (t: string): string => t.replace(INLINE, (_w, label?: string, url?: string, bold?: string) => (label !== undefined ? `${strip(label)} (${url})` : strip(bold ?? "")));
  return fillTemplate(strip(src), vars);
}

type Block = { kind: "p"; lines: string[] } | { kind: "ol" | "ul"; items: string[] };

function blocks(body: string): Block[] {
  const out: Block[] = [];
  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const ul = /^\s*[-•]\s+(.*)$/.exec(line);
    const prev = out[out.length - 1];
    if (!line.trim()) {
      out.push({ kind: "p", lines: [] });
    } else if (ol || ul) {
      const kind = ol ? "ol" : "ul";
      const text = (ol ?? ul)![1];
      if (prev && prev.kind === kind) prev.items.push(text);
      else out.push({ kind, items: [text] });
    } else if (prev && prev.kind === "p") {
      prev.lines.push(line.trim());
    } else {
      out.push({ kind: "p", lines: [line.trim()] });
    }
  }
  return out.filter((b) => (b.kind === "p" ? b.lines.length > 0 : true));
}

export interface RenderOptions {
  /** Origin that serves /email/header.jpg, e.g. https://coutechnova.xyz */
  assetBase: string;
  contactEmail?: string;
}

export interface RenderedSelectionEmail {
  subject: string;
  /** A complete HTML document (preview page). */
  html: string;
  /** The email body only, for pasting into a compose window. */
  fragment: string;
  text: string;
}

export function renderSelectionEmail(tpl: SelectionTemplate, vars: Partial<TemplateVars>, opts: RenderOptions): RenderedSelectionEmail {
  // Links always come from the template, so editing them updates every placeholder that uses them.
  const v: Partial<TemplateVars> = { ...vars, telegramLink: tpl.telegramLink, rulebookLink: tpl.rulebookLink, websiteLink: tpl.websiteLink };
  const e = escapeHtml;
  const subject = fillTemplate(tpl.subject, v);
  const heading = fillTemplate(tpl.heading, v);
  const base = opts.assetBase.replace(/\/+$/, "");
  const site = safeUrl(tpl.websiteLink) ?? base;
  const body = blocks(tpl.body)
    .map((b) => {
      if (b.kind === "p") return `<p style="margin:0 0 16px">${b.lines.map((l) => inlineHtml(l, v)).join("<br>")}</p>`;
      const tag = b.kind;
      return `<${tag} style="margin:0 0 18px;padding-left:22px">${b.items.map((i) => `<li style="margin:0 0 8px">${inlineHtml(i, v)}</li>`).join("")}</${tag}>`;
    })
    .join("\n");

  const buttons = [
    { url: safeUrl(tpl.telegramLink), label: tpl.telegramLabel, bg: "#229ED9" },
    { url: safeUrl(tpl.rulebookLink), label: tpl.rulebookLabel, bg: "#7c3aed" },
    { url: safeUrl(tpl.websiteLink), label: tpl.websiteLabel, bg: "#0f172a" },
  ].filter((b) => b.url && b.label.trim());
  const buttonRow = buttons.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr>${buttons
        .map(
          (b) =>
            `<td style="padding:0 8px 8px 0"><a href="${e(b.url)}" target="_blank" style="display:inline-block;background:${b.bg};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:10px">${e(fillTemplate(b.label, v))}</a></td>`,
        )
        .join("")}</tr></table>`
    : "";

  const facts: [string, string | undefined][] = [
    ["Team", v.teamName],
    ["Registration ID", v.registrationId],
    ["Final", v.eventDate],
    ["Venue", v.venue],
  ];
  const factsBox = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:4px 0 8px;border:1px solid #e5e7eb;border-radius:10px;border-collapse:separate">${facts
    .filter(([, val]) => val)
    .map(([k, val]) => `<tr><td style="padding:10px 14px;color:#64748b;font-size:13px;width:36%;border-bottom:1px solid #f1f5f9">${e(k)}</td><td style="padding:10px 14px;color:#0f172a;font-size:14px;font-weight:600;border-bottom:1px solid #f1f5f9">${e(val)}</td></tr>`)
    .join("")}</table>`;

  const footerLinks = [
    [tpl.websiteLink, "Website"],
    [tpl.telegramLink, "Telegram"],
    [tpl.rulebookLink, "Rulebook"],
    ...(opts.contactEmail ? [[`mailto:${opts.contactEmail}`, opts.contactEmail]] : []),
  ]
    .map(([u, l]) => (safeUrl(u) ? `<a href="${e(u)}" target="_blank" style="color:#a78bfa;text-decoration:none">${e(l)}</a>` : ""))
    .filter(Boolean)
    .join(' <span style="color:#475569">·</span> ');

  const fragment = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
<tr><td style="background:#0b0820;padding:0"><a href="${e(site)}" target="_blank"><img src="${e(base)}/email/header.jpg" width="600" alt="CoU AI Hackathon 2026 · Presented by GIGABYTE AORUS · Powered by IT Palace" style="display:block;width:100%;max-width:600px;height:auto;border:0"></a></td></tr>
<tr><td style="padding:30px 30px 8px;color:#0f172a;font-size:15px;line-height:1.65">
<h1 style="font-size:23px;line-height:1.3;margin:0 0 18px;color:#0f172a">${e(heading)}</h1>
${body}
${buttonRow}
${factsBox}
</td></tr>
<tr><td style="background:#0b0820;padding:20px 30px;color:#cbd5e1;font-size:12px;line-height:1.7">
<div style="color:#ffffff;font-weight:600;font-size:13px">CoU AI Hackathon 2026 · CoU Technova 2026</div>
<div>Faculty of Engineering, Comilla University, Cumilla, Bangladesh</div>
<div style="margin-top:6px">${footerLinks}</div>
<div style="margin-top:6px;color:#94a3b8">Five Hours. One Vision. Infinite Possibilities.</div>
</td></tr>
</table></td></tr></table>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(subject)}</title></head><body style="margin:0;background:#f1f5f9">${fragment}</body></html>`;

  const text = [
    heading,
    "",
    ...blocks(tpl.body).flatMap((b) =>
      b.kind === "p" ? [...b.lines.map((l) => inlineText(l, v)), ""] : [...b.items.map((it, i) => `${b.kind === "ol" ? `${i + 1}.` : "-"} ${inlineText(it, v)}`), ""],
    ),
    ...buttons.map((b) => `${fillTemplate(b.label, v)}: ${b.url}`),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { subject, html, fragment, text };
}
