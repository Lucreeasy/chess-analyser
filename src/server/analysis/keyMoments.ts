/** docs/02-ANALYSIS-SPEC.md section 13.1: selecting a game's key moments. */

export interface SwingEntry {
  ply: number;
  /** max(0, mover Win% before - mover Win% after), unrounded, Win% points. */
  swing: number;
}

/** Up to 5 moves with swing >= 10, topped up to at least 3 with swing >= 1. Output in game order. */
export function selectKeyMoments(entries: SwingEntry[]): SwingEntry[] {
  const ranked = entries
    .filter((e) => e.swing > 0)
    .slice()
    .sort((a, b) => (b.swing !== a.swing ? b.swing - a.swing : a.ply - b.ply));

  const picked: SwingEntry[] = [];
  for (const entry of ranked) {
    if (picked.length >= 5) break;
    if (entry.swing >= 10) picked.push(entry);
  }
  for (const entry of ranked) {
    if (picked.length >= 3) break;
    if (!picked.includes(entry) && entry.swing >= 1) picked.push(entry);
  }

  return picked.sort((a, b) => a.ply - b.ply);
}
