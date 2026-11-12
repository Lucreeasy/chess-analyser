/** About four round tick values from min to max for a chart axis: steps of 1, 2, 2.5 or 5 times a power of ten. */
export function niceTicks(min: number, max: number): number[] {
  const raw = (max - min) / 4 || 1;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw * 0.75)!;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) ticks.push(+t.toFixed(6));
  return ticks;
}
