/* eslint-disable no-undef, @typescript-eslint/no-unused-vars */
import React, { FC, useRef, useCallback } from "react";

import { useAssets, useAsset, useAnimation, useContext2D } from "canvas/render";
import { drawCircle, drawImage } from "canvas/draw";
import { distanceSquared, Position, roundTo } from "utils";
import {gameBorders, canvasWidth, canvasHeight} from "config"

const background = {width: 800, height: 800};

interface Props {
  hivelingMind: () => void;
}
const drawBackground = (
  ctx: CanvasRenderingContext2D,
  background: {width: number, height: number},
  scale: number,
  [x, y]: Position
) => {
  ctx.save();
  ctx.fillStyle = "black"
  ctx.fillRect(x,y, scale * background.width, scale * background.height);
ctx.restore();
}; 

export const GameArea: FC<Props> = ({
  hivelingMind
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctx = useContext2D(canvasRef);

  const draw = useCallback(
    async (frameNumber: number) => {
      if (!ctx) {
        return;
      }

      if (background) {
        const scale = 1
        const [xScale, yScale] = [
          (gameBorders.right - gameBorders.left) / (background.width * scale),
          (gameBorders.top - gameBorders.bottom) / (background.height * scale)
        ];
        const scalePixelsToGameSpace = ([x, y]: Position): Position => [
          x * xScale,
          y * yScale
        ];

        const [viewWidth, viewHeight] = scalePixelsToGameSpace([
          canvasWidth,
          canvasHeight
        ]);

        const position = [100,100]
        const [xPlayer, yPlayer] = position;

        const [xCanvas, yCanvas] = [xPlayer - viewWidth / 2,
            yPlayer + viewHeight / 2
        ];

        const transformPositionToPixelSpace = ([x, y]: Position): Position => [
          (x - xCanvas) / xScale,
          (yCanvas - y) / yScale
        ];

        drawBackground(
          ctx,
          background,
          scale,
          transformPositionToPixelSpace([gameBorders.left, gameBorders.top])
        );
      }
    },
    [
      ctx,
    ]
  );

  useAnimation(draw);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="Canvas"
        width={canvasWidth.toString()}
        height={canvasHeight.toString()}
      >
        Your browser does not support the HTML5 canvas tag.
      </canvas>
    </>
  );
};
