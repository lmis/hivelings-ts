import rng, { prng, State } from "seedrandom";

export const load = (state: State): prng => rng("", { state });
export const fromSeed = (x: string | number): prng =>
  rng(x.toString(), { state: true });

export const int32 = (rng: prng, lowerIncl: number, upperExcl: number) =>
  lowerIncl + (rng.int32() % (upperExcl - lowerIncl));

// Fisher-Yates
export const shuffle = <T>(rng: prng, xs: T[]): T[] => {
  const a = [...xs];
  const n = a.length;
  for (let i = 0; i < n; ++i) {
    const j = int32(rng, i, n);
    const x = a[i];
    a[i] = a[j];
    a[j] = x;
  }
  return xs;
};

export const pickRandom = <T>(rng: prng, xs: T[]): T =>
  xs[int32(rng, 0, xs.length)];
