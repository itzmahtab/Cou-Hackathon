/**
 * The selection email that organisers send by hand. Pure functions only, so the
 * same code fills the template on the server and in the browser.
 */

export const DEFAULT_TELEGRAM_LINK = "https://t.me/+i1nLFtZoiLkzYThl";

export interface SelectionTemplate {
  subject: string;
  body: string;
  telegramLink: string;
}

export const DEFAULT_SELECTION_TEMPLATE: SelectionTemplate = {
  subject: "Congratulations {teamName}! You are selected for the CoU AI Hackathon 2026 final",
  body: `Dear {memberNames},

Congratulations! Your team "{teamName}" (Registration ID: {registrationId}) has been selected for the final round of the CoU AI Hackathon 2026 with your idea "{ideaTitle}".

Next steps:
1. Join our official Telegram channel for all announcements: {telegramLink}
2. Confirm your place by paying the participation fee of BDT {feeBdt} through the hackathon portal by {paymentDeadline}.
3. The final takes place on {eventDate} at {venue}.

If you have any questions, reply to this email or ask in the Telegram channel.

Best regards,
CoU AI Hackathon 2026 Organising Committee
Faculty of Engineering, Comilla University`,
  telegramLink: DEFAULT_TELEGRAM_LINK,
};

export const PLACEHOLDERS = {
  teamName: "Team name",
  registrationId: "Registration ID",
  ideaTitle: "Idea title",
  leaderName: "Team leader's name",
  memberNames: "All member names",
  telegramLink: "Telegram channel link",
  feeBdt: "Participation fee",
  paymentDeadline: "Payment deadline",
  eventDate: "Final event date",
  venue: "Venue",
} as const;

export type TemplateVars = Record<keyof typeof PLACEHOLDERS, string>;

/** Replaces {placeholders}; unknown ones are left as typed so mistakes stay visible. */
export function fillTemplate(text: string, vars: Partial<TemplateVars>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => (Object.prototype.hasOwnProperty.call(vars, key) && vars[key as keyof TemplateVars] !== undefined ? String(vars[key as keyof TemplateVars]) : whole));
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

/** The same message as a Gmail compose window in the browser. */
export function gmailComposeLink(to: string[], subject: string, body: string): string {
  const p = new URLSearchParams({ view: "cm", fs: "1", to: to.join(","), su: subject, body });
  return `https://mail.google.com/mail/?${p.toString()}`;
}
