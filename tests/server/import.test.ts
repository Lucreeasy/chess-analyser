import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGame } from "../../src/server/import.ts";

test("parses headers from a PGN game", () => {
  const pgn = '[White "alice"]\n[Black "bob"]\n[Result "1-0"]\n\n1. e4 e5 1-0';
  const game = parseGame(pgn, 123);
  assert.equal(game.white, "alice");
  assert.equal(game.black, "bob");
  assert.equal(game.result, "1-0");
  assert.equal(game.importedAt, 123);
  assert.equal(game.id.length, 40); // sha1 fallback id, no Link tag
});

test("uses the Link tag as the id when present", () => {
  const pgn =
    '[White "a"]\n[Black "b"]\n[Result "1-0"]\n[Link "https://www.chess.com/game/live/123"]\n\n1. e4 1-0';
  const game = parseGame(pgn, 1);
  assert.equal(game.id, "https://www.chess.com/game/live/123");
});
