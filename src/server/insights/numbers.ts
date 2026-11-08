/** The number formats of the Insights texts and screen. docs/04-INSIGHTS-SPEC.md section 0. */

/** Fixed one decimal ("3.5", "2.0"); "–" without a value. */
export function one(x: number | undefined): string {
  return x === undefined ? "–" : x.toFixed(1);
}

/** A 0..1 share as a whole percent ("25%"); "–" without a value. */
export function pct(x: number | undefined): string {
  return x === undefined ? "–" : `${Math.round(x * 100)}%`;
}

/** Whole numbers with a comma separator: "1,462". */
export function thousands(n: number): string {
  return n.toLocaleString("en-US");
}
