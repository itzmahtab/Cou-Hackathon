/**
 * The selection email that organisers send by hand, in the CoU TECHNOVA 2026 design
 * (dark card, orange accents). Pure functions only, so the same code renders it on
 * the server (preview page) and in the browser (editor).
 *
 * Text fields use a tiny, safe formatting syntax:
 *   blank line        new paragraph
 *   1. / -            numbered / bulleted list item
 *   **bold**          bold (orange)
 *   [text](url)       link; the url may be a placeholder such as {telegramLink}
 * Everything typed is HTML-escaped, and only http(s), mailto and tel links are kept.
 */

export const DEFAULT_TELEGRAM_LINK = "https://t.me/+i1nLFtZoiLkzYThl";
export const DEFAULT_WEBSITE = "https://coutechnova.xyz";
export const DEFAULT_HELPLINE_EMAIL = "coutechnova2026@gmail.com";

export interface SelectionTemplate {
  subject: string;
  headline: string;
  subheadline: string;
  body: string;
  telegramNote: string;
  telegramLabel: string;
  websiteCaption: string;
  helplineEmail: string;
  telegramLink: string;
  websiteLink: string;
  rulebookLink: string;
}

export const DEFAULT_SELECTION_TEMPLATE: SelectionTemplate = {
  subject: "Congratulations! You are selected | CoU TECHNOVA 2026",
  headline: "CONGRATULATIONS!",
  subheadline: "YOUR TEAM IS IN THE TOP 40 · AI HACKATHON",
  body: `Dear Participants,

We are delighted to inform you that your team has been **selected for the Final Round** of the AI Hackathon at CoU TECHNOVA 2026, after a competitive evaluation of Phase 1 submissions.`,
  telegramNote: `**Please join our official Telegram group now.**
Confirmation, payment instructions and all next steps will be shared there.`,
  telegramLabel: "✈️ JOIN TELEGRAM GROUP",
  websiteCaption: "Rules, schedule, FAQ and help",
  helplineEmail: DEFAULT_HELPLINE_EMAIL,
  telegramLink: DEFAULT_TELEGRAM_LINK,
  websiteLink: DEFAULT_WEBSITE,
  rulebookLink: `${DEFAULT_WEBSITE}/rulebook.pdf`,
};

export const PLACEHOLDERS = {
  teamName: "Team name",
  registrationId: "Registration ID",
  ideaTitle: "Idea title",
  leaderName: "Team leader's name",
  memberNames: "All member names",
  telegramLink: "Telegram group link",
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
const LINK_STYLE = "color:#ffa530;font-weight:bold;text-decoration:underline";
const BOLD_STYLE = "color:#ffa530";

/** Formats one line. Formatting is read from the template before placeholders are filled, so team data can never inject markup. */
function inlineHtml(src: string, vars: Partial<TemplateVars>, boldStyle = BOLD_STYLE): string {
  let out = "";
  let last = 0;
  for (const m of src.matchAll(INLINE)) {
    out += escapeHtml(fillTemplate(src.slice(last, m.index), vars));
    if (m[1] !== undefined) {
      const url = safeUrl(fillTemplate(m[2], vars));
      const label = inlineHtml(m[1], vars, boldStyle);
      out += url ? `<a href="${escapeHtml(url)}" style="${LINK_STYLE}" target="_blank">${label}</a>` : label;
    } else {
      out += `<b style="${boldStyle}">${inlineHtml(m[3], vars, boldStyle)}</b>`;
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
  /** The team's member names, in order (team card). */
  members?: string[];
}

export interface RenderedSelectionEmail {
  subject: string;
  /** A complete HTML document (preview page). */
  html: string;
  /** The email body only, for pasting into a compose window. */
  fragment: string;
  text: string;
}

/** Paragraphs and lists of one text field, in the email's light-on-dark style. */
function richHtml(src: string, v: Partial<TemplateVars>, gapPx = 14, boldStyle = BOLD_STYLE): string {
  const bs = blocks(src);
  return bs
    .map((b, i) => {
      const gap = i === bs.length - 1 ? "0" : `${gapPx}px`;
      if (b.kind === "p") return `<p style="margin:0 0 ${gap}">${b.lines.map((l) => inlineHtml(l, v, boldStyle)).join("<br>")}</p>`;
      return `<${b.kind} style="margin:0 0 ${gap};padding-left:22px">${b.items.map((it) => `<li style="margin:0 0 6px">${inlineHtml(it, v, boldStyle)}</li>`).join("")}</${b.kind}>`;
    })
    .join("");
}

function richText(src: string, v: Partial<TemplateVars>): string[] {
  return blocks(src).flatMap((b) => (b.kind === "p" ? [...b.lines.map((l) => inlineText(l, v)), ""] : [...b.items.map((it, i) => `${b.kind === "ol" ? `${i + 1}.` : "-"} ${inlineText(it, v)}`), ""]));
}

export function renderSelectionEmail(tpl: SelectionTemplate, vars: Partial<TemplateVars>, opts: RenderOptions = {}): RenderedSelectionEmail {
  // Links always come from the template, so editing them updates every placeholder that uses them.
  const v: Partial<TemplateVars> = { ...vars, telegramLink: tpl.telegramLink, rulebookLink: tpl.rulebookLink, websiteLink: tpl.websiteLink };
  const e = escapeHtml;
  const f = (t: string) => fillTemplate(t, v);
  const subject = f(tpl.subject);
  const members = (opts.members ?? []).filter((m) => m.trim());
  const telegram = safeUrl(tpl.telegramLink);
  const site = safeUrl(tpl.websiteLink);
  const siteLabel = (site ?? "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const helpline = tpl.helplineEmail.trim();
  const helplineUrl = helpline ? safeUrl(`mailto:${helpline}`) : null;

  const teamCard = `<tr><td style="padding:14px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1d0f05;border:1px solid #ff8a00;border-radius:12px;">
<tr><td style="padding:18px 20px;">
<div style="font-size:12px;letter-spacing:3px;color:#ff9a1f;font-weight:bold;">TEAM NAME</div>
<div style="font-size:24px;color:#ffffff;font-weight:bold;margin:4px 0 14px;">${e(v.teamName ?? "")}</div>
${
  members.length
    ? `<div style="font-size:12px;letter-spacing:3px;color:#ff9a1f;font-weight:bold;">TEAM MEMBERS</div>
<div style="font-size:15px;color:#ffffff;line-height:26px;margin-top:4px;">
${members.map((m, i) => `${i + 1}. ${e(m)}`).join("<br>")}
</div>`
    : ""
}
</td></tr></table>
</td></tr>`;

  const fragment = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0b0603" style="background:#0b0603;font-family:Arial,Helvetica,sans-serif;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#120a04;border:1px solid #ff8a00;border-radius:16px;overflow:hidden;">

<tr><td align="center" bgcolor="#ff8a00" style="background:#ff8a00;background:linear-gradient(90deg,#ff7a00,#ffb347);padding:26px 20px;">
<div style="font-size:12px;letter-spacing:4px;color:#2a1300;font-weight:bold;">FACULTY OF ENGINEERING PRESENTS</div>
<div style="font-size:30px;font-weight:bold;color:#1a0d00;margin-top:6px;letter-spacing:1px;">CoU TECHNOVA 2026</div>
<div style="font-size:12px;letter-spacing:3px;color:#2a1300;margin-top:4px;">AI &amp; TECHNOLOGY CARNIVAL</div>
</td></tr>

<tr><td align="center" style="padding:36px 28px 10px;">
<div style="font-size:44px;line-height:1;">🎉</div>
<div style="font-size:30px;font-weight:bold;color:#ffffff;margin-top:12px;">${e(f(tpl.headline))}</div>
${tpl.subheadline.trim() ? `<div style="font-size:16px;color:#ffa530;margin-top:8px;letter-spacing:1px;font-weight:bold;">${e(f(tpl.subheadline))}</div>` : ""}
</td></tr>

<tr><td style="padding:18px 32px 6px;color:#d9d9d9;font-size:15px;line-height:24px;">
${richHtml(tpl.body, v, 24)}
</td></tr>

${teamCard}

${
  telegram
    ? `<tr><td align="center" style="padding:24px 32px 8px;">
<div style="font-size:14px;color:#d9d9d9;margin-bottom:12px;line-height:21px;">${richHtml(tpl.telegramNote, v, 8, "color:#ffffff")}</div>
<a href="${e(telegram)}" target="_blank" style="display:inline-block;background:#ff8a00;background:linear-gradient(90deg,#ff7a00,#ffae4a);color:#1a0d00;font-weight:bold;font-size:17px;letter-spacing:1px;text-decoration:none;padding:15px 38px;border-radius:40px;">${e(f(tpl.telegramLabel))}</a>
</td></tr>`
    : ""
}

${
  site
    ? `<tr><td align="center" style="padding:20px 32px 6px;">
<a href="${e(site)}" target="_blank" style="color:#ffa530;font-size:15px;font-weight:bold;text-decoration:none;">${e(siteLabel)}</a>
${tpl.websiteCaption.trim() ? `<div style="font-size:13px;color:#a8a8a8;margin-top:6px;">${e(f(tpl.websiteCaption))}</div>` : ""}
</td></tr>`
    : ""
}

${
  helplineUrl
    ? `<tr><td align="center" style="padding:18px 32px 24px;">
<div style="border-top:1px solid #2a1a0d;padding-top:16px;font-size:14px;color:#d9d9d9;line-height:22px;">
Need help? Contact our helpline:<br>
<a href="${e(helplineUrl)}" style="color:#ffa530;font-weight:bold;text-decoration:none;">${e(helpline)}</a>
</div></td></tr>`
    : ""
}

<tr><td align="center" bgcolor="#0b0603" style="background:#0b0603;padding:18px;font-size:12px;color:#8a8a8a;line-height:20px;">
<b style="color:#ffffff;letter-spacing:2px;">INNOVATE. <span style="color:#ffa530;">CREATE.</span> COMPETE.</b><br>
Organized by the Faculty of Engineering, Comilla University<br>
Title Sponsor: Gigabyte AORUS · Powered by IT Palace
</td></tr>

</table></td></tr></table>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(subject)}</title></head>
<body style="margin:0;padding:0;background:#0b0603;font-family:Arial,Helvetica,sans-serif;">${fragment}</body></html>`;

  const text = [
    "CoU TECHNOVA 2026 · AI & TECHNOLOGY CARNIVAL",
    "",
    f(tpl.headline),
    f(tpl.subheadline),
    "",
    ...richText(tpl.body, v),
    `TEAM NAME: ${v.teamName ?? ""}`,
    ...(members.length ? ["TEAM MEMBERS:", ...members.map((m, i) => `${i + 1}. ${m}`)] : []),
    "",
    ...(telegram ? [...richText(tpl.telegramNote, v), `${f(tpl.telegramLabel)}: ${telegram}`, ""] : []),
    ...(site ? [`${siteLabel}${tpl.websiteCaption.trim() ? ` · ${f(tpl.websiteCaption)}` : ""}: ${site}`, ""] : []),
    ...(helpline ? [`Need help? Contact our helpline: ${helpline}`, ""] : []),
    "INNOVATE. CREATE. COMPETE.",
    "Organized by the Faculty of Engineering, Comilla University",
    "Title Sponsor: Gigabyte AORUS · Powered by IT Palace",
  ]
    .filter((l) => l !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { subject, html, fragment, text };
}
