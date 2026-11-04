const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `{day} {Mon} {year}` in local time, e.g. "15 Mar 2024". docs/06-GAMES-SPEC.md section A3. */
export function formatDate(playedAt: number): string {
  const d = new Date(playedAt);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const TIME_CLASS_LABEL: Record<string, string> = {
  bullet: "Bullet",
  blitz: "Blitz",
  rapid: "Rapid",
  daily: "Daily",
  classical: "Classical",
};

export function timeClassLabel(timeClass: string): string {
  return TIME_CLASS_LABEL[timeClass] ?? timeClass;
}

export function accuracyText(accuracy: number | undefined): string {
  return accuracy === undefined ? "–" : `${accuracy.toFixed(1)}%`;
}

export function countText(n: number | undefined): string {
  return n === undefined ? "–" : String(n);
}
