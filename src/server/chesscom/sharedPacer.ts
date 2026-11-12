import { RequestPacer } from "./pacer.ts";

/**
 * One pacer for every chess.com caller in the process (manual import, the
 * month list, auto-sync): the 1s gap between requests applies across all
 * of them, not per caller.
 */
export const chessComPacer = new RequestPacer(1000);
