export type Position = [number, number];

export const distanceSquared = (
  [x1, y1]: Position,
  [x2, y2]: Position
): number => Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2);

export const distance = (a: Position, b: Position): number =>
  Math.sqrt(distanceSquared(a, b));

export const range = (lower: number, upper: number) =>
  Array.from({ length: upper - lower }, (_, i) => i + lower);

export const rangeSteps = (
  lower: number,
  stepSize: number,
  upper: number
): number[] =>
  Array.from(
    { length: (upper - lower) / stepSize },
    (_, i) => i * stepSize + lower
  );

export const crossProduct = <T, S>(xs: T[], ys: S[]): [T, S][] =>
  xs.flatMap((x) => ys.map((y) => [x, y] as [T, S]));

export const clamp = (x: number, [xMin, xMax]: [number, number]) =>
  Math.min(xMax, Math.max(xMin, x));

export const maxBy = <T>(value: (x: T) => number, xs: T[]): T | null =>
  xs.reduce(
    (acc: [T | null, number], x: T): [T | null, number] => {
      const v = value(x);
      if (acc === null || acc[1] < v) {
        return [x, v];
      }
      return acc;
    },
    [null, -Infinity]
  )?.[0] ?? null;

export const sortBy = <T>(value: (x: T) => number, xs: T[]): T[] =>
  xs
    .map((x) => [x, value(x)] as [T, number])
    .sort((a, b) => a[1] - b[1])
    .map(([x]) => x);

export const uniqueBy = <T, S>(value: (x: T) => S, xs: T[]): T[] => {
  const seen = new Set<S>();
  const res: T[] = [];
  xs.forEach((x) => {
    const prop = value(x);
    if (!seen.has(prop)) {
      res.push(x);
      seen.add(prop);
    }
  });
  return res;
};

export const hasAll = <T>(set: Set<T>, values: T[]) =>
  values.every((v) => set.has(v));

export const takeWhile = <T>(pred: (x: T) => boolean, xs: T[]): T[] => {
  const i = xs.findIndex((x) => !pred(x));
  if (i === -1) {
    return xs;
  }
  return xs.slice(0, i);
};
