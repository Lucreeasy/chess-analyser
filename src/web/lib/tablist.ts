/** ArrowLeft/Right/Home/End cycling for a roving-tabindex tablist, wrapping at the ends. */
export function tabArrowKey<T extends string>(e: KeyboardEvent, ids: readonly T[], active: T): T | undefined {
  const i = ids.indexOf(active);
  let next = i;
  if (e.key === "ArrowLeft") next = (i - 1 + ids.length) % ids.length;
  else if (e.key === "ArrowRight") next = (i + 1) % ids.length;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = ids.length - 1;
  else return undefined;
  e.preventDefault();
  return ids[next];
}
