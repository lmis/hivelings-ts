interface Config {
  j: number;
  k: number;
  m: number;
  defaultSeed: string;
}

export interface RngState {
  config: Config;
  sequence: number[];
}

export interface Rng {
  getState: () => RngState;
  getNext: () => number;
}

export const loadLaggedFibo = (state: RngState): Rng => {
  const { config } = state;
  let { sequence } = state;
  const { j, k, m } = config;

  return {
    getState: () => ({ sequence, config }),
    getNext: () => {
      const next = (sequence[j - 1] + sequence[k - 1]) % m;
      sequence = [next, ...sequence].slice(0, k);
      return next;
    }
  };
};
export const makeLaggedFibo = (config: Config) => (
  seed: string | number
): Rng => {
  const { defaultSeed, k } = config;
  const initialState = {
    sequence: [...seed.toString(), ...defaultSeed]
      .slice(0, k)
      .map((c) => c.charCodeAt(0)),
    config
  };

  const rng = loadLaggedFibo(initialState);
  // Discard the first couple random numbers
  for (let i = 0; i < 5000; ++i) {
    rng.getNext();
  }

  return rng;
};

export const makeStdLaggedFibo = makeLaggedFibo({
  j: 24,
  k: 55,
  defaultSeed: '!"j%BfBWsq&<c$_4)m78%qZw,y`x\\G79sJA;8"}|~zUETg|5v?^%0-/',
  m: Math.pow(2, 32)
});
