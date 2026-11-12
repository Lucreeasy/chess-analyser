/** Players, "me", result and ratings. */

export type Colour = "w" | "b";
export type Result = "1-0" | "0-1" | "1/2-1/2" | "*";
export type PersonalResult = "win" | "loss" | "draw";

/** Trimmed name, or "?" when missing/empty. */
export function playerName(tagValue: string | undefined): string {
  const trimmed = (tagValue ?? "").trim();
  return trimmed === "" ? "?" : trimmed;
}

/** Which side is "me": White if White's name matches, else Black if Black's does, else unknown. */
export function resolveMyColour(white: string, black: string, usernames: string[]): Colour | undefined {
  const list = usernames.map((u) => u.trim().toLowerCase()).filter((u) => u !== "");
  if (list.includes(white.trim().toLowerCase())) return "w";
  if (list.includes(black.trim().toLowerCase())) return "b";
  return undefined;
}

const VALID_RESULTS: Result[] = ["1-0", "0-1", "1/2-1/2", "*"];

/** The stored result: the Result tag, unless it is "*" or junk, in which case the movetext's result token is used. */
export function resolveResult(resultTag: string | undefined, resultToken: string | undefined): Result {
  const tag = resultTag?.trim();
  if (tag && VALID_RESULTS.includes(tag as Result) && tag !== "*") return tag as Result;
  if (resultToken && VALID_RESULTS.includes(resultToken as Result)) return resultToken as Result;
  return "*";
}

/** My win/loss/draw, only when my colour is known and the game is finished. */
export function resolvePersonalResult(result: Result, myColour: Colour | undefined): PersonalResult | undefined {
  if (!myColour || result === "*") return undefined;
  if (result === "1/2-1/2") return "draw";
  return (myColour === "w") === (result === "1-0") ? "win" : "loss";
}

/** A rating is kept only if it consists solely of digits. */
export function resolveRating(tagValue: string | undefined): number | undefined {
  if (tagValue === undefined || !/^\d+$/.test(tagValue)) return undefined;
  return Number(tagValue);
}
