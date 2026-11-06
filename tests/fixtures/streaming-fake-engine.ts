#!/usr/bin/env node
/**
 * A scripted fake UCI engine for exploreSearch tests: unlike fake-engine.ts
 * (one instant canned response), this one emits a deepening series of info
 * lines a few milliseconds apart and only answers "bestmove" once asked to
 * "stop" or once it reaches depth 30 - so cancellation and the hard-cap
 * timeout are actually exercisable.
 */
import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin });
let searching = false;
let depth = 0;
let timer: NodeJS.Timeout | undefined;

function step(): void {
  depth++;
  console.log(`info depth ${depth} multipv 1 score cp ${30 + depth} pv e2e4 e7e5`);
  console.log(`info depth ${depth} multipv 2 score cp ${25 + depth} pv d2d4 d7d5`);
  if (depth >= 30) finish();
  else timer = setTimeout(step, 5);
}

function finish(): void {
  if (!searching) return;
  searching = false;
  clearTimeout(timer);
  console.log("bestmove e2e4");
}

rl.on("line", (line) => {
  const command = line.trim();
  if (command === "uci") {
    console.log("id name StreamingFakeEngine");
    console.log("uciok");
  } else if (command === "isready") {
    console.log("readyok");
  } else if (command.startsWith("go ")) {
    searching = true;
    depth = 0;
    step();
  } else if (command === "stop") {
    finish();
  } else if (command === "quit") {
    process.exit(0);
  }
});
