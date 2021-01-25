import { useEventListener } from "controls/useEventListener";
import { useEffect, useRef } from "react";

export type GameIteration<S> = (
  frameNumber: number,
  keys: PressedKeys,
  state: S
) => Promise<S>;
export type StateGetter<S> = { getState: () => S };

export interface PressedKeys {
  held: Set<string>;
  released: Set<string>;
}

export const useGameLoop = <S>(
  gameIteration: GameIteration<S>,
  render: (state: S) => void,
  initialState: S
): StateGetter<S> => {
  const stateRef = useRef<S>(initialState);
  const requestRef = useRef<number | null>(null);
  const keysRef = useRef<PressedKeys>({ held: new Set(), released: new Set() });

  useEventListener("keydown", (e) => {
    keysRef.current.held.add(e.code);
  });
  useEventListener("keyup", (e) => {
    const { held, released } = keysRef.current;
    held.delete(e.code);
    released.add(e.code);
  });

  useEffect(() => {
    const handleFrame = async () => {
      stateRef.current = await gameIteration(
        requestRef.current ?? 0,
        keysRef.current,
        stateRef.current
      );
      keysRef.current.released.clear();
      render(stateRef.current);
      requestRef.current = requestAnimationFrame(handleFrame);
    };
    handleFrame();
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [gameIteration, render, stateRef, requestRef]);

  return { getState: () => stateRef.current };
};
