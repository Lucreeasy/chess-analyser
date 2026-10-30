#!/usr/bin/env node
/**
 * A scripted fake UCI engine for tests (NFR-5): no real chess, just the
 * handshake and canned output for whatever position it is asked about.
 */
import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin });

rl.on("line", (line) => {
  const command = line.trim();
  if (command === "uci") {
    console.log("id name FakeEngine");
    console.log("uciok");
  } else if (command === "isready") {
    console.log("readyok");
  } else if (command.startsWith("go ")) {
    console.log("info depth 10 multipv 1 score cp 30 pv e2e4 e7e5");
    console.log("info depth 10 multipv 2 score cp 25 pv d2d4 d7d5");
    console.log("bestmove e2e4");
  } else if (command === "quit") {
    process.exit(0);
  }
});
