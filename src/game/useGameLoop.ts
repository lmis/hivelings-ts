import { useEffect, useRef } from "react";

export type GameIteration<S> = (state: S) => Promise<S>;
export type StateGetter<S> = { getState: () => S };

export interface Settings {
  framesPerGameStep: number;
}
export const useGameLoop = <S>(
  gameIteration: GameIteration<S>,
  render: (state: S) => void,
  initialState: S,
  settings: Settings
): StateGetter<S> => {
  const stateRef = useRef<S>(initialState);
  const requestRef = useRef<number | null>(null);
  const settingsRef = useRef<Settings>(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const handleFrame = async () => {
      const frameNumber = requestRef.current ?? 0;
      const { framesPerGameStep } = settingsRef.current;
      if (frameNumber % framesPerGameStep === 0) {
        stateRef.current = await gameIteration(stateRef.current);
      }
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
