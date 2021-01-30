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

export const crossProduct = <T, S>(xs: T[], ys: S[]): [T, S][] =>
  xs.flatMap((x) => ys.map((y) => [x, y] as [T, S]));

export const clamp = (x: number, [xMin, xMax]: [number, number]) => Math.min(xMax, Math.max(xMin, x));
