import { test } from "node:test";
import assert from "node:assert/strict";
import { splitIntoGames, parseTagLine, extractTags, normalizeText } from "../../../src/server/import/pgnText.ts";
import { sample } from "../../fixtures/samples.ts";


test("parseTagLine: the grammar, escapes, and what is not a tag line", () => {
  assert.deepEqual(parseTagLine('[White "alice"]'), { name: "White", value: "alice" });
  assert.deepEqual(parseTagLine('  [White "alice"]  '), { name: "White", value: "alice" });
  assert.deepEqual(parseTagLine('[Site "a \\"quoted\\" word, a \\\\backslash"]'), {
    name: "Site",
    value: 'a "quoted" word, a \\backslash',
  });
  assert.equal(parseTagLine('[White "alice"] trailing text'), null);
  assert.equal(parseTagLine("1. e4"), null);
});

test("normalizeText: strips a leading BOM and normalises CRLF/CR/LF", () => {
  assert.equal(normalizeText("﻿a\r\nb\rc\nd"), "a\nb\nc\nd");
});

// The known per-file game counts of the samples.
test("loose-format.pgn: 4 games, despite sloppy layout", () => {
  const games = splitIntoGames(sample("loose-format.pgn"));
  assert.equal(games.length, 4);
});

test("crlf-bom.pgn: 3 games, byte-for-byte CRLF + BOM input", () => {
  const games = splitIntoGames(sample("crlf-bom.pgn"));
  assert.equal(games.length, 3);
});

test("duplicates.pgn: 5 games (splitting does not deduplicate)", () => {
  const games = splitIntoGames(sample("duplicates.pgn"));
  assert.equal(games.length, 5);
});

test("a tag line right after moves starts a new game with no blank line needed", () => {
  const text = '[White "a"]\n[Black "b"]\n\n1. e4 1-0\n[White "c"]\n[Black "d"]\n\n1. d4 1-0';
  assert.equal(splitIntoGames(text).length, 2);
});

test("two consecutive tag blocks with no moves are two games only when the second starts with Event", () => {
  const twoGames = '[Event "a"]\n[White "x"]\n[Event "b"]\n[White "y"]\n\n1. e4 1-0';
  assert.equal(splitIntoGames(twoGames).length, 2);
  const oneGame = '[White "x"]\n[Black "y"]\n\n1. e4 1-0';
  assert.equal(splitIntoGames(oneGame).length, 1);
});

test("a text without any tags is a single game", () => {
  assert.equal(splitIntoGames("1. e4 e5 1-0").length, 1);
});

test("empty or whitespace-only input yields zero games", () => {
  assert.deepEqual(splitIntoGames(""), []);
  assert.deepEqual(splitIntoGames("   \n\n  "), []);
});

test("a tag-looking line inside a spanning brace comment does not start a new game", () => {
  const text = '[White "a"]\n[Black "b"]\n\n1. e4 {this comment has\n[White "fake"]\nin it} e5 1-0';
  const games = splitIntoGames(text);
  assert.equal(games.length, 1);
});

test("extractTags: first occurrence wins, stops at the first movetext line", () => {
  const text = '[White "first"]\n[White "second"]\n\n1. e4 1-0';
  const tags = extractTags(text);
  assert.equal(tags.get("White"), "first");
  assert.equal(tags.size, 1);
});
