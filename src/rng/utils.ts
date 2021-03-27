import { Rng } from "rng/laggedFibo";

export const integer = (rng: Rng, lowerIncl: number, upperExcl: number) =>
  lowerIncl + (rng.getNext() % (upperExcl - lowerIncl));

export const float = (rng: Rng, lowerIncl: number, upperExcl: number) =>
  lowerIncl +
  (rng.getNext() / rng.getState().config.m) * (upperExcl - lowerIncl);

// Fisher-Yates
export const shuffle = <T>(rng: Rng, xs: T[]): T[] => {
  const a = [...xs];
  const n = a.length;
  for (let i = 0; i < n; ++i) {
    const j = integer(rng, i, n);
    const x = a[i];
    a[i] = a[j];
    a[j] = x;
  }
  return xs;
};

export const pickRandom = <T>(rng: Rng, xs: T[]): T | null =>
  xs.length === 0 ? null : xs[integer(rng, 0, xs.length)];

export const randomPrintable = (rng: Rng, n: number): string =>
  [...Array(55)].map(_ => String.fromCharCode(integer(rng, 32, 127))).join("");
