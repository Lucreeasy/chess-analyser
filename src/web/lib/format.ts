import { one } from "../../server/insights/numbers.ts";

export { one, pct, thousands, plural } from "../../server/insights/numbers.ts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `{day} {Mon} {year}` in local time, e.g. "15 Mar 2024". */
export function formatDate(playedAt: number): string {
  const d = new Date(playedAt);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const UK_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** British style in UTC, e.g. "3 Sept 2026". */
export function ukDate(ms: number): string {
  return UK_DATE.format(ms);
}

/** Two dates as "3 Sept 2026 – 9 Oct 2026"; equal dates once. */
export function ukRange(from: number, to: number): string {
  return ukDate(from) === ukDate(to) ? ukDate(from) : `${ukDate(from)} – ${ukDate(to)}`;
}


const TIME_CLASS_LABEL: Record<string, string> = {
  bullet: "Bullet",
  blitz: "Blitz",
  rapid: "Rapid",
  daily: "Daily",
  classical: "Classical",
};

/** "middlegame" -> "Middlegame". */
export const capitalise = (s: string) => s[0].toUpperCase() + s.slice(1);

export function timeClassLabel(timeClass: string): string {
  return TIME_CLASS_LABEL[timeClass] ?? timeClass;
}

export function accuracyText(accuracy: number | undefined): string {
  return accuracy === undefined ? "–" : `${one(accuracy)}%`;
}

export function countText(n: number | undefined): string {
  return n === undefined ? "–" : String(n);
}
