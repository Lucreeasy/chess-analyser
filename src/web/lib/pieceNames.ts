import { read } from "@lichess-org/chessground/fen";

const COLOUR = { white: "White", black: "Black" } as const;

/** Each piece's text name ("White pawn on e2") for the read-only board's labelled pieces, in read()'s order: rank 8 to 1, file a to h. */
export function pieceNames(fen: string): string[] {
  return [...read(fen)].map(([square, piece]) => `${COLOUR[piece.color]} ${piece.role} on ${square}`);
}
