/* eslint-disable no-undef, @typescript-eslint/no-unused-vars */
import { MutableRefObject, useEffect, useState, useMemo, useRef } from "react";
declare const require: (url: string) => string;

export const useCanvas = (): [MutableRefObject<HTMLCanvasElement | null>, CanvasRenderingContext2D | null] => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  useEffect(() => {
    setCtx(canvasRef.current?.getContext("2d") ?? null);
  }, [canvasRef]);

  return [canvasRef, ctx];
};

export const useAssets = (descriptors: {
  [name: string]: string;
}): { [name: string]: HTMLImageElement } => {
  const [images, setImages] = useState<{ [name: string]: HTMLImageElement }>(
    {}
  );

  useEffect(() => {
    Object.entries(descriptors).forEach(([name, url], i) => {
      const img = new Image();
      img.onload = () => {
        setImages((xs) => ({ ...xs, [name]: img }));
      };
      img.src = require("../../../public/assets/" + url);
    });
    return () => {
      setImages({});
    };
  }, [descriptors]);
  return images;
};

export const useAsset = (name: string): HTMLImageElement | null => {
  const descriptors = useMemo(() => ({ name }), [name]);
  return useAssets(descriptors)?.name ?? null;
};
