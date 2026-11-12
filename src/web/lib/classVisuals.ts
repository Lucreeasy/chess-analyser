import type { MoveClass } from "../../server/analysis/classification.ts";

/** Shape, in-badge glyph and ink per classification. */
export interface ClassVisual {
  shape: "roundedSquare" | "burst" | "circle" | "star" | "diamond" | "triangle" | "hexagon" | "octagon";
  glyph: "book" | "upArrow" | "tick" | "cross" | "none" | "!!" | "!" | "?!" | "?" | "??";
  ink: "dark" | "white";
  cssVar: string;
}

export const CLASS_VISUALS: Record<MoveClass, ClassVisual> = {
  book: { shape: "roundedSquare", glyph: "book", ink: "dark", cssVar: "--class-book" },
  brilliant: { shape: "burst", glyph: "!!", ink: "dark", cssVar: "--class-brilliant" },
  great: { shape: "circle", glyph: "!", ink: "white", cssVar: "--class-great" },
  best: { shape: "star", glyph: "none", ink: "dark", cssVar: "--class-best" },
  excellent: { shape: "circle", glyph: "upArrow", ink: "dark", cssVar: "--class-excellent" },
  good: { shape: "circle", glyph: "tick", ink: "dark", cssVar: "--class-good" },
  inaccuracy: { shape: "diamond", glyph: "?!", ink: "dark", cssVar: "--class-inaccuracy" },
  mistake: { shape: "triangle", glyph: "?", ink: "dark", cssVar: "--class-mistake" },
  miss: { shape: "hexagon", glyph: "cross", ink: "white", cssVar: "--class-miss" },
  blunder: { shape: "octagon", glyph: "??", ink: "white", cssVar: "--class-blunder" },
};
