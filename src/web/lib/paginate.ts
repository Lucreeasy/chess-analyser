/** Paging the Games list. docs/06-GAMES-SPEC.md section A4: fixed page size 50. */

export const PAGE_SIZE = 50;

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

/** Clamps `page` to the last existing page (for example after items were deleted). */
export function clampPage(page: number, total: number): number {
  return Math.min(Math.max(1, page), pageCount(total));
}

export function paginate<T>(items: T[], page: number): T[] {
  const clamped = clampPage(page, items.length);
  return items.slice((clamped - 1) * PAGE_SIZE, clamped * PAGE_SIZE);
}
