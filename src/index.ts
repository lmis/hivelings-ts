/* eslint-disable no-undef, @typescript-eslint/no-unused-vars */
import { drawImage, drawGrid, drawCone } from "canvas/draw";
import { Position, sortBy } from "utils";
import { gameBorders, fieldOfView } from "config";
import {
  makeGameIteration,
  makeHivelingMindFromFunction
} from "hivelings/game";
import { loadStartingState, ScenarioName } from "hivelings/scenarios";
import { GameState, Entity } from "hivelings/types/simulation";
import { toDeg } from "hivelings/transformations";
import { hivelingMind as demoMind } from "hivelings/demoMind";
import { EntityType } from "hivelings/types/common";
import { loadAssets } from "canvas/render";
import { gameLoop } from "game/gameLoop";

const { HIVELING, NUTRITION, OBSTACLE, TRAIL, HIVE_ENTRANCE } = EntityType;

const drawBackground = (
  ctx: CanvasRenderingContext2D,
  background: { width: number; height: number },
  scale: number,
  [x, y]: Position
) => {
  ctx.save();
  ctx.fillStyle = "green";
  const width = background.width * scale;
  const height = background.height * scale;
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

const main = async () => {
  const assets = await loadAssets(assetDescriptors);
  const canvas = document.getElementById("root") as HTMLCanvasElement;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Cannot get canvas context");
  }

  const render = ({ scale, cameraPosition, entities }: GameState) => {
    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const background = { width: 40, height: 40 };
    const scalePixelsToGameSpace = ([x, y]: Position): Position => [
      x / scale,
      y / scale
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
      (x - xCanvas) * scale,
      (yCanvas - y) * scale
    ];

    drawBackground(
      ctx,
      background,
      scale,
      transformPositionToPixelSpace([0, 0])
    );

    drawGrid({
      ctx,
      width: scale,
      height: scale,
      topLeft: transformPositionToPixelSpace([
        gameBorders.left,
        gameBorders.top
      ]),
      strokeStyle: "darkgrey",
      xCells: gameBorders.right - gameBorders.left + 1,
      yCells: gameBorders.top - gameBorders.bottom + 1
    });

    sortBy((e: Entity) => e.zIndex, entities).forEach((e) => {
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
      const size = scale;
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
  };

  const gameIteration = makeGameIteration(
    makeHivelingMindFromFunction(demoMind)
  );
  const startingState = loadStartingState(ScenarioName.BASE);

  gameLoop(gameIteration, render, startingState);
};
main();
