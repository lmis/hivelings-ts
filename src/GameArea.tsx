/* eslint-disable no-undef, @typescript-eslint/no-unused-vars */
import React, { FC, useRef, useCallback, useMemo } from "react";

import { useAssets, useAsset, useContext2D } from "canvas/render";
import { drawCircle, drawImage } from "canvas/draw";
import { distanceSquared, Position, roundTo } from "utils";
import { gameBorders, canvasWidth, canvasHeight } from "config";
import {
  makeGameIteration,
  makeHivelingMindFromFunction,
  startingState
} from "hivelings/game";
import { GameState } from "hivelings/types/simulation";
import { hivelingMind as demoMind } from "hivelings/demoMind";
import { useGameLoop } from "game/useGameLoop";
import { Entity } from "hivelings/types/simulation";
import { EntityType } from "hivelings/types/common";
import sortBy from "lodash/fp/sortBy";

const background = { width: 800, height: 800 };

interface Props {}
const drawBackground = (
  ctx: CanvasRenderingContext2D,
  background: { width: number; height: number },
  scale: number,
  [x, y]: Position
) => {
  ctx.save();
  ctx.fillStyle = "grey";
  ctx.fillRect(x, y, scale * background.width, scale * background.height);
  ctx.restore();
};

const drawEntity = (
  ctx: CanvasRenderingContext2D,
  { type, position }: Entity
) => {
  ctx.save();
  ctx.fillStyle = type === EntityType.HIVELING ? "black" : "red";
  ctx.fillRect(position[0], position[1], 20, 20);
  ctx.restore();
};

export const GameArea: FC<Props> = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctx = useContext2D(canvasRef);

  const draw = useCallback(
    (state: GameState) => {
      if (!ctx) {
        return;
      }

      if (background) {
        const scale = 1;
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

        const position = [0, 0];
        const [xPlayer, yPlayer] = position;

        const [xCanvas, yCanvas] = [
          xPlayer - viewWidth / 2,
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

        sortBy((e: Entity) => e.zIndex)(state.entities).forEach(
          ({ position, ...rest }) =>
            drawEntity(ctx, {
              position: transformPositionToPixelSpace(position),
              ...rest
            })
        );
      }
    },
    [ctx]
  );

  const gameIteration = useMemo(
    () => makeGameIteration(makeHivelingMindFromFunction(demoMind)),
    []
  );

  const game = useGameLoop(gameIteration, draw, startingState);

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
