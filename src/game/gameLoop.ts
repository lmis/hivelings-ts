export type GameIteration<S> = (
  frameNumber: number,
  keys: PressedKeys,
  state: S
) => Promise<S>;

export interface PressedKeys {
  held: Set<string>;
  released: Set<string>;
}

export const gameLoop = <S>(
  gameIteration: GameIteration<S>,
  render: (state: S) => void,
  initialState: S
): (() => void) => {
  let state = initialState;
  let frameNumber: number | null = null;
  const keys: PressedKeys = { held: new Set(), released: new Set() };

  const onKeyDown = (e: KeyboardEvent) => keys.held.add(e.code);
  const onKeyUp = (e: KeyboardEvent) => {
    keys.held.delete(e.code);
    keys.released.add(e.code);
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const handleFrame = async () => {
    state = await gameIteration(frameNumber ?? 0, keys, state);
    keys.released.clear();
    render(state);
    frameNumber = requestAnimationFrame(handleFrame);
  };
  handleFrame();

  return () => {
    if (frameNumber !== null) {
      cancelAnimationFrame(frameNumber);
    }
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
};
