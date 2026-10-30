# Instructions for Claude

> This file is a placeholder. The engineer replaces it (first version in phase P1, kept accurate whenever the structure or the commands change, final in P9) with the real instructions for someone who forks this project and works on it with Claude Code. Keep it under 100 lines, concrete, and true. It must stand alone: it describes this repository only. Replace every bracketed part; delete this paragraph.

[One or two sentences: what the program is.]

## Commands

Exact commands, copy-paste ready, run from the repository root:

- Install dependencies: `[...]`
- Run the program as the Docker image: `docker compose up --build`
- Start the program for development on the machine (without Docker): `[...]`
- Run all tests: `[...]`
- Lint / format / type check (if any): `[...]`
- Build the image on its own: `docker build -t chess-analyser .`
- Smoke test of the image (start, health, import a sample game, list games): `[...]`

## Structure

A map of the top-level directories and the one file to read first in each (details in `docs/ARCHITECTURE.md`):

- `[dir]` – [what it holds]

## Conventions

- [Language and style rules that are not obvious from the code, naming, where tests live, how test data is made.]
- [How the chess engine is found and driven, and how tests run without it.]

## Domain rules that must not drift

Where the formulas and rules live (Win% and accuracy, move classes and tags, insights definitions, puzzle schedule), which tests pin them, and what to do before changing one: [...]

## How to work on this project

- Make small changes: one logical change per commit, with a message that says what and why.
- Before adding code, look at the whole project for a simpler way: reuse what exists, delete or merge before adding, prefer the standard library and platform over a new dependency.
- Run what you build; for UI changes, look at the result on a phone-sized and a desktop-sized screen, light and dark.
- Keep `README.md`, `docs/ARCHITECTURE.md` and this file in step with the code.
- Record decisions that shape the project in `docs/DECISIONS.md`.
