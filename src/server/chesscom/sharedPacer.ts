import { RequestPacer } from "./pacer.ts";

/**
 * One pacer for every chess.com caller in the process (manual import, the
 * month list, auto-sync): section 3.3 requires the 1s gap to apply across
 * all of them, not per caller.
 */
export const chessComPacer = new RequestPacer(1000);
