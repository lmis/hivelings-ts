/* eslint-disable no-undef, @typescript-eslint/no-unused-vars */
import { MutableRefObject, useEffect, useState, useRef, useMemo } from "react";
declare const require: (url: string) => string;

export const useContext2D = (
  canvasRef: MutableRefObject<HTMLCanvasElement | null>
): CanvasRenderingContext2D | null => {
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  useEffect(() => {
    setCtx(canvasRef.current?.getContext("2d") ?? null);
  }, [canvasRef]);

  return ctx;
};

export const useAnimation = (
  onFrame: (frameNumber: number) => Promise<void>
) => {
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    const animate = async () => {
      await onFrame(requestRef.current ?? 0);
      requestRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [onFrame]);
};

export const useAssets = (names: string[]): HTMLImageElement[] | null => {
  const [images, setImages] = useState<HTMLImageElement[] | null>(null);

  useEffect(() => {
    names.forEach((name, i) => {
      const img = new Image();
      img.onload = () => {
        setImages((xs) => {
          const res = xs ? [...xs] : [];
          res[i] = img;
          return res;
        });
      };
      img.src = require("../../../public/assets/" + name);
    });
    return () => {
      setImages(null);
    };
  }, [names]);
  return images;
};

export const useAsset = (name: string): HTMLImageElement | null => {
  const names = useMemo(() => [name], [name]);
  return useAssets(names)?.[0] ?? null;
};
