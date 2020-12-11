import { useEffect, useRef } from "react";

export type GameIteration<S> = (state: S) => Promise<S>;
export type StateGetter<S> = { getState: () => S };

export const useGameLoop = <S>(
  gameIteration: GameIteration<S>,
  render: (state: S) => void,
  initialState: S
): StateGetter<S> => {
  const stateRef = useRef<S>(initialState);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    const handleFrame = async () => {
      stateRef.current = await gameIteration(stateRef.current);
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
