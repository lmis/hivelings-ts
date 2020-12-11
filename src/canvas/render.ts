/* eslint-disable no-undef, @typescript-eslint/no-unused-vars */
import { MutableRefObject, useEffect, useState, useMemo } from "react";
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
