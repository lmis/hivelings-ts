/* eslint-disable no-undef, @typescript-eslint/no-unused-vars */
import React, { FC, useCallback, useMemo } from "react";

import { useAssets, useCanvas } from "canvas/render";
import { drawImage, drawGrid, drawCone } from "canvas/draw";
import { Position } from "utils";
import { gameBorders, canvasWidth, canvasHeight, fieldOfView } from "config";
import {
  makeGameIteration,
  makeHivelingMindFromFunction
} from "hivelings/game";
import { loadStartingState, ScenarioName } from "hivelings/scenarios";
import { GameState, Entity } from "hivelings/types/simulation";
import { toDeg } from "hivelings/transformations";
import { hivelingMind as demoMind } from "hivelings/demoMind";
import { useGameLoop } from "game/useGameLoop";
import { EntityType } from "hivelings/types/common";
import sortBy from "lodash/fp/sortBy";
import { sees } from "hivelings/simulation";

const { HIVELING, NUTRITION, OBSTACLE, TRAIL, HIVE_ENTRANCE } = EntityType;

const background = { width: canvasWidth + 200, height: canvasHeight + 200 };

interface Props {}

const drawBackground = (
  ctx: CanvasRenderingContext2D,
  background: { width: number; height: number },
  scale: number,
  [x, y]: Position
) => {
  ctx.save();
  ctx.fillStyle = "green";
  const width = scale * background.width;
  const height = scale * background.height;
  ctx.fillRect(x - width / 2, y - height / 2, width, height);
  ctx.restore();
};

const assetDescriptors = {
  hiveling: "Hiveling_iteration2.png",
  hivelingWithNutrition: "Hiveling_strawberry.png",
  nutrition: "Strawberry.png",
  trail: "Foot_prints.png",
  hiveEntrance: "Burrow.png"
};

export const GameArea: FC<Props> = () => {
  const [canvasRef, ctx] = useCanvas();
  const assets = useAssets(assetDescriptors);

  const draw = useCallback(
    ({ scale, cameraPosition, entities }: GameState) => {
      if (!ctx) {
        return;
      }

      if (background && Object.values(assets).every((x) => !!x)) {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        const [xScale, yScale] = [
          (gameBorders.right - gameBorders.left) / (canvasWidth * scale),
          (gameBorders.top - gameBorders.bottom) / (canvasHeight * scale)
        ];
        const scalePixelsToGameSpace = ([x, y]: Position): Position => [
          x * xScale,
          y * yScale
        ];

        const [viewWidth, viewHeight] = scalePixelsToGameSpace([
          canvasWidth,
          canvasHeight
        ]);

        const [xCamera, yCamera] = cameraPosition;

        const [xCanvas, yCanvas] = [
          xCamera - viewWidth / 2,
          yCamera + viewHeight / 2
        ];

        const transformPositionToPixelSpace = ([x, y]: Position): Position => [
          (x - xCanvas) / xScale,
          (yCanvas - y) / yScale
        ];

        drawBackground(
          ctx,
          background,
          scale,
          transformPositionToPixelSpace([0, 0])
        );

        drawGrid({
          ctx,
          width: 1 / xScale,
          height: 1 / yScale,
          topLeft: transformPositionToPixelSpace([
            gameBorders.left,
            gameBorders.top
          ]),
          strokeStyle: "darkgrey",
          xCells: gameBorders.right - gameBorders.left + 1,
          yCells: gameBorders.top - gameBorders.bottom + 1
        });

        sortBy((e: Entity) => e.zIndex)(entities).forEach((e) => {
          const image = (() => {
            switch (e.type) {
              case NUTRITION:
                return assets.nutrition;
              case HIVELING:
                return e.hasNutrition
                  ? assets.hivelingWithNutrition
                  : assets.hiveling;
              case TRAIL:
                return assets.trail;
              case HIVE_ENTRANCE:
                return assets.hiveEntrance;
              case OBSTACLE:
                return null;
            }
          })();
          const [x, y] = transformPositionToPixelSpace(e.position);
          const size = 1 / xScale;
          const angle =
            "orientation" in e ? (toDeg(e.orientation) * Math.PI) / 180 : 0;
          if (e.type === HIVELING) {
            drawCone({
              ctx,
              origin: [x, y],
              angleStart: angle - fieldOfView / 2,
              angleEnd: angle + fieldOfView / 2,
              radius: 6 * size,
              strokeStyle: "black"
            });
          }
          if (!image) {
            ctx.save();
            ctx.fillStyle = "black";
            ctx.fillRect(x - size / 2, y - size / 2, size, size);
            ctx.restore();
          } else {
            drawImage({
              ctx,
              alpha: 1,
              flipped: false,
              image,
              width: size,
              height: size,
              angle,
              position: [x, y]
            });
          }
        });
      }
    },
    [ctx, assets]
  );

  const gameIteration = useMemo(
    () => makeGameIteration(makeHivelingMindFromFunction(demoMind)),
    []
  );

  const startingState = useMemo(() => loadStartingState(ScenarioName.BASE), []);

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
