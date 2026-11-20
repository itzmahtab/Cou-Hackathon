/**
 * The selection email for the selected teams, in one of two designs:
 *   "technova"  CoU TECHNOVA 2026: dark card, orange accents, team card (default)
 *   "classic"   Purple: event + sponsor banner, Click-here links, three buttons, facts box
 * Pure functions only, so the same code renders it on the server (preview, outbox)
 * and in the browser (editor).
 *
 * Text fields use a tiny, safe formatting syntax:
 *   blank line        new paragraph
 *   1. / -            numbered / bulleted list item
 *   **bold**          bold
 *   [text](url)       link; the url may be a placeholder such as {telegramLink}
 * Everything typed is HTML-escaped, and only http(s), mailto and tel links are kept.
 */

export const DEFAULT_TELEGRAM_LINK = "https://t.me/+i1nLFtZoiLkzYThl";
export const DEFAULT_WEBSITE = "https://coutechnova.xyz";
export const DEFAULT_HELPLINE_EMAIL = "coutechnova2026@gmail.com";

export const SELECTION_DESIGNS = { technova: "TECHNOVA orange", classic: "Purple banner" } as const;
export type SelectionDesign = keyof typeof SELECTION_DESIGNS;

export interface SelectionTemplate {
  design: SelectionDesign;
  /** The large icon at the top of the TECHNOVA design. */
  emoji: string;
  /* TECHNOVA design */
  subject: string;
  headline: string;
  subheadline: string;
  body: string;
  telegramNote: string;
  telegramLabel: string;
  websiteCaption: string;
  /* Purple design */
  classicSubject: string;
  classicHeading: string;
  classicBody: string;
  classicTelegramLabel: string;
  classicRulebookLabel: string;
  classicWebsiteLabel: string;
  /* Shared */
  helplineEmail: string;
  telegramLink: string;
  websiteLink: string;
  rulebookLink: string;
}

export const DEFAULT_SELECTION_TEMPLATE: SelectionTemplate = {
  design: "technova",
  emoji: "🎉",
  subject: "Congratulations! You are selected | CoU TECHNOVA 2026",
  headline: "CONGRATULATIONS!",
  subheadline: "YOUR TEAM IS IN THE TOP 40 · AI HACKATHON",
  body: `Dear Participants,

We are delighted to inform you that your team has been **selected for the Final Round** of the AI Hackathon at CoU TECHNOVA 2026, after a competitive evaluation of Phase 1 submissions.`,
  telegramNote: `**Please join our official Telegram group now.**
Confirmation, payment instructions and all next steps will be shared there.`,
  telegramLabel: "✈️ JOIN TELEGRAM GROUP",
  websiteCaption: "Rules, schedule, FAQ and help",
  classicSubject: "Congratulations {teamName}! You are selected for the CoU AI Hackathon 2026 final",
  classicHeading: "You're in the final, {teamName}! 🎉",
  classicBody: `Dear {memberNames},

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
  classicTelegramLabel: "Join Telegram channel",
  classicRulebookLabel: "Read the rulebook",
  classicWebsiteLabel: "Visit website",
  helplineEmail: DEFAULT_HELPLINE_EMAIL,
  telegramLink: DEFAULT_TELEGRAM_LINK,
  websiteLink: DEFAULT_WEBSITE,
  rulebookLink: `${DEFAULT_WEBSITE}/rulebook.pdf`,
};

/** The "payment confirmed" email, sent per team by an admin once the payment is verified. */
export const DEFAULT_PAYMENT_TEMPLATE: SelectionTemplate = {
  ...DEFAULT_SELECTION_TEMPLATE,
  emoji: "✅",
  subject: "Payment confirmed: your place in the CoU AI Hackathon 2026 final | {teamName}",
  headline: "PAYMENT CONFIRMED!",
  subheadline: "YOUR PLACE IN THE FINAL IS CONFIRMED",
  body: `Dear Participants,

We have received and verified your team's participation fee of **BDT {feeBdt}**. Your place in the **Final Round** of the AI Hackathon at CoU TECHNOVA 2026 is now **confirmed**.

**See you at the final**
- Date: **{eventDate}**
- Venue: {venue}
- Bring your student ID cards and your laptops (with chargers).`,
  telegramNote: `**Stay in our official Telegram group.**
The schedule, reporting time and all final-day updates will be shared there.`,
  classicSubject: "Payment confirmed: your place in the CoU AI Hackathon 2026 final | {teamName}",
  classicHeading: "Payment confirmed, {teamName}! ✅",
  classicBody: `Dear {memberNames},

We have received and verified your team's participation fee of **BDT {feeBdt}**. Your place in the final round of the **CoU AI Hackathon 2026** is now **confirmed**.

**See you at the final**
1. Date: **{eventDate}** at {venue}.
2. Bring your student ID cards and your laptops (with chargers).
3. **[Click here]({telegramLink})** to stay in our Telegram group for the schedule and final-day updates.
4. Read the **[rulebook]({rulebookLink})** before the final.

If you have any questions, reply to this email or ask in the Telegram group.

Best regards,
**CoU AI Hackathon 2026 Organising Committee**
Faculty of Engineering, Comilla University`,
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
function inlineHtml(src: string, vars: Partial<TemplateVars>, boldStyle = BOLD_STYLE, linkStyle = LINK_STYLE): string {
  let out = "";
  let last = 0;
  for (const m of src.matchAll(INLINE)) {
    out += escapeHtml(fillTemplate(src.slice(last, m.index), vars));
    if (m[1] !== undefined) {
      const url = safeUrl(fillTemplate(m[2], vars));
      const label = inlineHtml(m[1], vars, boldStyle, linkStyle);
      out += url ? `<a href="${escapeHtml(url)}" style="${linkStyle}" target="_blank">${label}</a>` : label;
    } else {
      out += `<b style="${boldStyle}">${inlineHtml(m[3], vars, boldStyle, linkStyle)}</b>`;
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
  /** Origin that serves /email/header.jpg for the Purple design, e.g. https://coutechnova.xyz */
  assetBase?: string;
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
function richHtml(src: string, v: Partial<TemplateVars>, gapPx = 14, boldStyle = BOLD_STYLE, linkStyle = LINK_STYLE): string {
  const bs = blocks(src);
  return bs
    .map((b, i) => {
      const gap = i === bs.length - 1 ? "0" : `${gapPx}px`;
      if (b.kind === "p") return `<p style="margin:0 0 ${gap}">${b.lines.map((l) => inlineHtml(l, v, boldStyle, linkStyle)).join("<br>")}</p>`;
      return `<${b.kind} style="margin:0 0 ${gap};padding-left:22px">${b.items.map((it) => `<li style="margin:0 0 6px">${inlineHtml(it, v, boldStyle, linkStyle)}</li>`).join("")}</${b.kind}>`;
    })
    .join("");
}

function richText(src: string, v: Partial<TemplateVars>): string[] {
  return blocks(src).flatMap((b) => (b.kind === "p" ? [...b.lines.map((l) => inlineText(l, v)), ""] : [...b.items.map((it, i) => `${b.kind === "ol" ? `${i + 1}.` : "-"} ${inlineText(it, v)}`), ""]));
}

/** Renders the selection email in the template's chosen design. */
export function renderSelectionEmail(tpl: SelectionTemplate, vars: Partial<TemplateVars>, opts: RenderOptions = {}): RenderedSelectionEmail {
  return tpl.design === "classic" ? renderClassic(tpl, vars, opts) : renderTechnova(tpl, vars, opts);
}

function renderTechnova(tpl: SelectionTemplate, vars: Partial<TemplateVars>, opts: RenderOptions): RenderedSelectionEmail {
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
${tpl.emoji.trim() ? `<div style="font-size:44px;line-height:1;">${e(tpl.emoji)}</div>` : ""}
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

const CLASSIC_LINK = "color:#6d28d9;font-weight:600;text-decoration:underline";
const CLASSIC_BOLD = "color:#0f172a";

/** The Purple design: event + sponsor banner, formatted message, three buttons, facts box, dark footer. */
function renderClassic(tpl: SelectionTemplate, vars: Partial<TemplateVars>, opts: RenderOptions): RenderedSelectionEmail {
  const v: Partial<TemplateVars> = { ...vars, telegramLink: tpl.telegramLink, rulebookLink: tpl.rulebookLink, websiteLink: tpl.websiteLink };
  const e = escapeHtml;
  const f = (t: string) => fillTemplate(t, v);
  const subject = f(tpl.classicSubject);
  const heading = f(tpl.classicHeading);
  const base = (opts.assetBase ?? DEFAULT_WEBSITE).replace(/\/+$/, "");
  const site = safeUrl(tpl.websiteLink) ?? base;
  const body = richHtml(tpl.classicBody, v, 16, CLASSIC_BOLD, CLASSIC_LINK);

  const buttons = [
    { url: safeUrl(tpl.telegramLink), label: tpl.classicTelegramLabel, bg: "#229ED9" },
    { url: safeUrl(tpl.rulebookLink), label: tpl.classicRulebookLabel, bg: "#7c3aed" },
    { url: safeUrl(tpl.websiteLink), label: tpl.classicWebsiteLabel, bg: "#0f172a" },
  ].filter((b) => b.url && b.label.trim());
  const buttonRow = buttons.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 24px"><tr>${buttons
        .map(
          (b) =>
            `<td style="padding:0 8px 8px 0"><a href="${e(b.url)}" target="_blank" style="display:inline-block;background:${b.bg};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 18px;border-radius:10px">${e(f(b.label))}</a></td>`,
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

  const helpline = tpl.helplineEmail.trim();
  const footerLinks = [
    [tpl.websiteLink, "Website"],
    [tpl.telegramLink, "Telegram"],
    [tpl.rulebookLink, "Rulebook"],
    ...(helpline ? [[`mailto:${helpline}`, helpline]] : []),
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

  const text = [heading, "", ...richText(tpl.classicBody, v), ...buttons.map((b) => `${f(b.label)}: ${b.url}`), ...(helpline ? ["", `Helpline: ${helpline}`] : [])]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { subject, html, fragment, text };
}
