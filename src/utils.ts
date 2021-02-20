export type Position = [number, number];
export const inexhaustive = (_: never): void => {};

export const wait = (millis: number) =>
  new Promise((resolve) => setTimeout(resolve, millis));

export const fuzzyEqual = (a: number, b: number, tol: number) =>
  Math.abs(a - b) < tol;

export const roundTo = (a: number, precision: number) =>
  precision === 0 ? a : Math.round(a / precision) * precision;
export const positionFuzzyEqual = (
  [xa, ya]: Position,
  [xb, yb]: Position,
  tol: number
) => fuzzyEqual(xa, xb, tol) && fuzzyEqual(ya, yb, tol);

export const distanceSquared = (
  [x1, y1]: Position,
  [x2, y2]: Position
): number => Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2);

export const distance = (a: Position, b: Position): number =>
  Math.sqrt(distanceSquared(a, b));

export const positionEquals = ([xa, xb]: Position, [ya, yb]: Position) =>
  xa === ya && xb === yb;

export const range = (lower: number, upper: number) =>
  Array.from({ length: upper - lower }, (_, i) => i + lower);

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

export const max = (xs: number[]): number | null => maxBy((x) => x, xs);

export const sortBy = <T>(value: (x: T) => number, xs: T[]): any[] =>
  xs
    .map((x) => [x, value(x)] as [T, number])
    .sort((a, b) => a[1] - b[1])
    .map(([x]) => x);

export const hasAll = <T>(set: Set<T>, values: T[]) =>
  values.every((v) => set.has(v));
