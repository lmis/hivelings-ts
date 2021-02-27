/* eslint-disable no-undef, @typescript-eslint/no-unused-vars */
import { drawImage, drawGrid, drawCone } from "canvas/draw";
import {
  Position,
  sortBy,
  clamp,
  hasAll,
  distance,
  uniqueBy,
  positionEquals
} from "utils";
import {
  gameBorders,
  fieldOfView,
  peripherialSightFieldOfView,
  sightDistance,
  peripherialSightDistance
} from "config";
import { advanceSimulation } from "hivelings/simulation";
import { loadStartingState, ScenarioName } from "hivelings/scenarios";
import { Entity, Hiveling, SimulationState } from "hivelings/types/simulation";
import { hivelingMind } from "hivelings/demoMind";
import { toDeg } from "hivelings/transformations";
import {
  EntityType,
  Input,
  Decision,
  DecisionType
} from "hivelings/types/common";
import { loadAssets } from "canvas/assets";
import { Trail } from "hivelings/types/player";

const { HIVELING, NUTRITION, OBSTACLE, TRAIL, HIVE_ENTRANCE } = EntityType;
const hBounds: [number, number] = [gameBorders.left, gameBorders.right];
const vBounds: [number, number] = [gameBorders.bottom, gameBorders.top];

const prettyPrintDecision = (d: Decision) => {
  switch (d.type) {
    case DecisionType.TURN:
      return `${d.type}(${d.rotation})`;
    default:
      return d.type;
  }
};

const prettyPrintEntity = (e: Entity): string => {
  const common = `${e.type}[${e.position[0]},${e.position[1]}]\n  identifier: ${e.identifier}\n  zIndex: ${e.zIndex}`;
  switch (e.type) {
    case HIVELING:
      const hivelingProps: (keyof Hiveling)[] = [
        "hasNutrition",
        "orientation",
        "memory64"
      ];
      return (
        common + "\n" + hivelingProps.map((k) => `  ${k}: ${e[k]}`).join("\n")
      );
    case TRAIL:
      const trailProps: (keyof Trail)[] = ["orientation", "lifetime"];
      return (
        common + "\n" + trailProps.map((k) => `  ${k}: ${e[k]}`).join("\n")
      );
    default:
      return common;
  }
};

export interface GameState {
  simulationState: SimulationState;
  scale: number;
  cameraPosition: Position;
  speed: number;
  showVision: boolean;
  showGrid: boolean;
  highlighted: Set<number>;
  quitting: boolean;
}

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

const handleKeyPresses = (
  held: Set<string>,
  released: Set<string>,
  state: GameState
) => {
  if (held.has("Add") || hasAll(held, ["Shift", "ArrowUp"])) state.scale += 0.4;
  if (held.has("Subtract") || hasAll(held, ["Shift", "ArrowDown"]))
    state.scale -= 0.4;
  if (held.has("ArrowUp"))
    state.cameraPosition[1] = clamp(state.cameraPosition[1] + 0.2, vBounds);
  if (held.has("ArrowDown"))
    state.cameraPosition[1] = clamp(state.cameraPosition[1] - 0.2, vBounds);
  if (held.has("ArrowLeft"))
    state.cameraPosition[0] = clamp(state.cameraPosition[0] - 0.2, hBounds);
  if (held.has("ArrowRight"))
    state.cameraPosition[0] = clamp(state.cameraPosition[0] + 0.2, hBounds);
  if (held.has("1")) state.speed = 1;
  if (held.has("2")) state.speed = 2;
  if (held.has("3")) state.speed = 3;
  if (released.has(" ")) state.speed = state.speed === 0 ? 1 : -state.speed;
  if (released.has("v")) state.showVision = !state.showVision;
  if (released.has("g")) state.showGrid = !state.showGrid;
};

const shouldAdvance = (speed: number, frameNumber: number): boolean => {
  switch (speed) {
    case 1:
      return frameNumber % 20 === 0;
    case 2:
      return frameNumber % 10 === 0;
    case 3:
      return frameNumber % 5 === 0;
    default:
      return false;
  }
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

  let state: GameState = {
    simulationState: loadStartingState(ScenarioName.BASE),
    scale: 20,
    cameraPosition: [0, 0],
    speed: 0,
    showVision: false,
    showGrid: true,
    highlighted: new Set(),
    quitting: false
  };
  let frameNumber: number | null = null;
  const heldKeys = new Set<string>();
  const releasedKeys = new Set<string>();
  const onKeyDown = (e: KeyboardEvent) => heldKeys.add(e.key);
  const onKeyUp = (e: KeyboardEvent) => {
    heldKeys.delete(e.key);
    releasedKeys.add(e.key);
  };

  const mouse = {
    position: null as Position | null,
    clicking: false,
    released: false
  };
  const onMouseDown = (e: MouseEvent) => {
    mouse.clicking = true;
  };
  const onMouseUp = (e: MouseEvent) => {
    mouse.clicking = false;
    mouse.released = true;
  };
  const onMouseMove = (e: MouseEvent) => {
    mouse.position = [e.clientX, e.clientY];
  };

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);

  const handleFrame = async () => {
    if (state.quitting) {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      return;
    }

    handleKeyPresses(heldKeys, releasedKeys, state);

    if (
      releasedKeys.has("Enter") ||
      shouldAdvance(state.speed, frameNumber ?? 0)
    ) {
      state.simulationState = await advanceSimulation(
        async (i: Input) => hivelingMind(i),
        state.simulationState
      );
    }

    const {
      scale,
      cameraPosition,
      simulationState: { entities },
      showVision,
      showGrid
    } = state;
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
    const transformPositionToGameSpace = ([x, y]: Position): Position => [
      x / scale + xCanvas,
      -y / scale + yCanvas
    ];

    drawBackground(
      ctx,
      background,
      scale,
      transformPositionToPixelSpace([0, 0])
    );

    if (showGrid) {
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
    }

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
      if (e.type === HIVELING && showVision) {
        drawCone({
          ctx,
          origin: [x, y],
          angleStart: angle - peripherialSightFieldOfView / 2,
          angleEnd: angle + peripherialSightFieldOfView / 2,
          radius: peripherialSightDistance * scale,
          strokeStyle: "black"
        });
        drawCone({
          ctx,
          origin: [x, y],
          angleStart: angle - fieldOfView / 2,
          angleEnd: angle + fieldOfView / 2,
          radius: sightDistance * scale,
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

    const mousePosition =
      mouse.position && transformPositionToGameSpace(mouse.position);

    if (mousePosition) {
      const underCursor = entities.filter(
        (e) => distance(e.position, mousePosition) < 0.5
      );
      if (mouse.clicking) {
        if (underCursor.length === 0) {
          state.highlighted.clear();
        } else {
          underCursor.map((e) => state.highlighted.add(e.identifier));
        }
      }

      const highlighedPositions = uniqueBy(
        (p) => p.join(","),
        [
          ...underCursor,
          ...entities.filter((e) => state.highlighted.has(e.identifier))
        ].map((e) => e.position)
      );

      highlighedPositions.forEach((position) => {
        const [x, y] = transformPositionToPixelSpace(position);
        const lines = sortBy(
          (e) => -e.zIndex,
          entities.filter((e) => positionEquals(e.position, position))
        )
          .map(prettyPrintEntity)
          .join("\n")
          .split("\n");
        const lineheight = 18;
        const font = `${lineheight}px Georgia`;
        const yPadding = 10;
        const yOffset = lineheight * lines.length;
        const height = yOffset + yPadding;
        const width =
          (lineheight / 2) *
          Math.min(240, Math.max(...lines.map((l) => l.length)));

        ctx.fillStyle = "black";
        ctx.fillRect(x - width / 2, y - height / 2 - yOffset, width, height);
        ctx.save();
        ctx.fillStyle = "white";
        ctx.font = font;
        lines.forEach((text, i) => {
          ctx.fillText(
            text,
            x - width / 2,
            y - height / 2 - yOffset + (i + 1) * lineheight,
            width
          );
        });
        ctx.restore();
      });
    }

    releasedKeys.clear();
    mouse.released = false;
    frameNumber = requestAnimationFrame(handleFrame);
  };
  handleFrame();
};

main();
