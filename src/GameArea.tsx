/* eslint-disable no-undef, @typescript-eslint/no-unused-vars */
import React, { FC, useCallback, useMemo } from "react";

import { useAssets, useCanvas } from "canvas/render";
import { drawImage, drawLine } from "canvas/draw";
import { Position } from "utils";
import { gameBorders, canvasWidth, canvasHeight } from "config";
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

const { HIVELING, NUTRITION, OBSTACLE, TRAIL, HIVE_ENTRANCE } = EntityType;

const background = { width: 800, height: 800 };

interface Props {}

const drawBackground = (
  ctx: CanvasRenderingContext2D,
  background: { width: number; height: number },
  scale: number,
  [x, y]: Position
) => {
  ctx.save();
  ctx.fillStyle = "green";
  ctx.fillRect(x, y, scale * background.width, scale * background.height);
  ctx.restore();
};

const drawEntity = ({
  ctx,
  position,
  angle,
  size,
  image
}: {
  ctx: CanvasRenderingContext2D;
  position: Position;
  angle: number;
  size: number;
  image: HTMLImageElement | null;
}) => {
  if (!image) {
    ctx.save();
    ctx.fillStyle = "black";
    ctx.fillRect(position[0] - size / 2, position[1] - size / 2, size, size);
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
      position
    });
  }
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
          transformPositionToPixelSpace([gameBorders.left, gameBorders.top])
        );

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
          drawEntity({
            ctx,
            position: transformPositionToPixelSpace(e.position),
            angle:
              "orientation" in e ? (toDeg(e.orientation) * Math.PI) / 180 : 0,
            size: 1 / xScale,
            image
          });
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
