import type { StoredGame } from "./import/parseGame.ts";
import { resolveMyColour, resolvePersonalResult } from "./import/players.ts";

/**
 * Recomputes myColour/myResult for stored games after the saved username
 * list changes. docs/03-IMPORT-SPEC.md section 6.
 */
export function rederiveMe(games: StoredGame[], usernames: string[]): StoredGame[] {
  return games.map((game) => {
    const myColour = resolveMyColour(game.white, game.black, usernames);
    return { ...game, myColour, myResult: resolvePersonalResult(game.result, myColour) };
  });
}
