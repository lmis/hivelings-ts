/* eslint-disable no-undef, @typescript-eslint/no-unused-vars */
import { useEffect } from "react";

export const useEventListener = <K extends keyof DocumentEventMap>(
  type: K,
  onEvent: (e: DocumentEventMap[K]) => void
) => {
  useEffect(() => {
    document.addEventListener(type, onEvent);
    return () => {
      document.removeEventListener(type, onEvent);
    };
  }, [type, onEvent]);
};
