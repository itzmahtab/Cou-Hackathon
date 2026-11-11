export const DHAKA = "Asia/Dhaka";

export function formatDhaka(ms: number | string | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }): string {
  if (ms === null || ms === undefined || ms === "") return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone: DHAKA, ...opts }).format(d);
}

export const formatDhakaDate = (ms: number | string) => formatDhaka(ms, { day: "numeric", month: "long", year: "numeric" });

export type WindowState = "before" | "open" | "closed";

/** Both bounds are inclusive ISO timestamps. */
export function windowState(now: number, openAt: string, closeAt: string): WindowState {
  if (now < Date.parse(openAt)) return "before";
  if (now > Date.parse(closeAt)) return "closed";
  return "open";
}
