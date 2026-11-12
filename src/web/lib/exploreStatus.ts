/** The Explore panel's status line and "Your line" text. */

export type ExploreStatus =
  | { kind: "finished"; gameOver: "checkmate" | "stalemate" | "draw"; winner?: "w" | "b" }
  | { kind: "disconnected" }
  | { kind: "error"; message: string }
  | { kind: "waiting" }
  | { kind: "result"; scoreText: string; depth: number; done: boolean };

export function exploreStatusText(status: ExploreStatus): string {
  switch (status.kind) {
    case "finished":
      if (status.gameOver === "checkmate") return status.winner === "w" ? "Checkmate. White wins." : "Checkmate. Black wins.";
      if (status.gameOver === "stalemate") return "Stalemate: a draw.";
      return "Drawn position.";
    case "disconnected":
      return "Connecting to the engine…";
    case "error":
      return `Engine error: ${status.message}`;
    case "waiting":
      return "Searching…";
    case "result":
      return `${status.scoreText} · depth ${status.depth}${status.done ? "" : " (searching…)"}`;
  }
}

/** "{n}. {san}" / "{n}... {san}" numbering, continuing from `startFen`'s own side-to-move and move number. */
export function yourLineText(startFen: string, sans: string[]): string | undefined {
  if (sans.length === 0) return undefined;
  const fields = startFen.split(" ");
  let moveNumber = Number(fields[5]);
  let turn = fields[1];
  const parts: string[] = [];
  for (const san of sans) {
    if (turn === "w") parts.push(`${moveNumber}.`);
    else if (parts.length === 0) parts.push(`${moveNumber}...`);
    parts.push(san);
    if (turn === "b") moveNumber++;
    turn = turn === "w" ? "b" : "w";
  }
  return `Your line: ${parts.join(" ")}`;
}
