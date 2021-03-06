/* eslint-disable no-undef, @typescript-eslint/no-unused-vars */
import { loadAssets } from "canvas/assets";
import {
  RenderBuffer,
  drawImage,
  drawGrid,
  drawRect,
  drawTextbox,
  initializeRenderBuffer,
  flush
} from "canvas/draw";
import {
  Position,
  sortBy,
  clamp,
  hasAll,
  distance,
  uniqueBy,
  positionEquals,
  zip,
  crossProduct,
  range
} from "utils";
import { gameBorders, sightDistance } from "config";
import { applyOutput, makeInput, sees } from "hivelings/simulation";
import { loadStartingState, ScenarioName } from "hivelings/scenarios";
import {
  Entity,
  Hiveling,
  SimulationState,
  isHiveling,
  Trail
} from "hivelings/types/simulation";
import { hivelingMind as demoHiveMind } from "hivelings/demoMind";
import { toDeg } from "hivelings/transformations";
import { EntityType, Input, Output } from "hivelings/types/common";
import { shuffle } from "rng/utils";

const { HIVELING, NUTRITION, OBSTACLE, TRAIL, HIVE_ENTRANCE } = EntityType;
const hBounds: [number, number] = [gameBorders.left, gameBorders.right];
const vBounds: [number, number] = [gameBorders.bottom, gameBorders.top];

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
  sending: boolean;
  framesSinceLastAdvance: number;
}

const drawBackground = (
  renderBuffer: RenderBuffer,
  background: { width: number; height: number },
  scale: number,
  position: Position
) => {
  drawRect({
    renderBuffer,
    fillStyle: "green",
    width: background.width * scale,
    height: background.height * scale,
    position,
    zIndex: -10
  });
};

const handleKeyPresses = (
  held: Set<string>,
  released: Set<string>,
  state: GameState
) => {
  if (held.has("Add") || hasAll(held, ["Shift", "ArrowUp"]))
    state.scale = Math.min(state.scale + 0.4, 80);
  if (held.has("Subtract") || hasAll(held, ["Shift", "ArrowDown"]))
    state.scale = Math.max(state.scale - 0.4, 1);
  if (held.has("ArrowUp") && !held.has("Shift"))
    state.cameraPosition[1] = clamp(state.cameraPosition[1] + 0.2, vBounds);
  if (held.has("ArrowDown") && !held.has("Shift"))
    state.cameraPosition[1] = clamp(state.cameraPosition[1] - 0.2, vBounds);
  if (held.has("ArrowLeft"))
    state.cameraPosition[0] = clamp(state.cameraPosition[0] - 0.2, hBounds);
  if (held.has("ArrowRight"))
    state.cameraPosition[0] = clamp(state.cameraPosition[0] + 0.2, hBounds);
  if (held.has("1")) state.speed = 1;
  if (held.has("2")) state.speed = 2;
  if (held.has("3")) state.speed = 3;
  if (held.has("4")) state.speed = 4;
  if (released.has(" ")) state.speed = state.speed === 0 ? 1 : -state.speed;
  if (released.has("v")) state.showVision = !state.showVision;
  if (released.has("g")) state.showGrid = !state.showGrid;
};

const shouldAdvance = (
  speed: number,
  framesSinceLastAdvance: number
): boolean => {
  switch (speed) {
    case 1:
      return framesSinceLastAdvance >= 50;
    case 2:
      return framesSinceLastAdvance >= 20;
    case 3:
      return framesSinceLastAdvance >= 10;
    case 4:
      return true;
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

  const demoSocket = {
    onmessage: (_: MessageEvent<string>) => null,
    send: (data: string) => {
      const inputs = JSON.parse(data);
      const outputs = JSON.stringify(inputs.map(demoHiveMind));
      demoSocket.onmessage({ data: outputs } as any);
    }
  };
  const url = new URLSearchParams(window.location.search).get("hive-mind");
  const socket = url ? new WebSocket(decodeURIComponent(url)) : demoSocket;

  let state: GameState = {
    simulationState: loadStartingState(ScenarioName.BASE),
    scale: 20,
    cameraPosition: [0, 0],
    speed: 0,
    showVision: false,
    showGrid: true,
    highlighted: new Set(),
    quitting: false,
    sending: false,
    framesSinceLastAdvance: 0
  };
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
      !state.sending &&
      (releasedKeys.has("Enter") ||
        shouldAdvance(state.speed, state.framesSinceLastAdvance))
    ) {
      state.sending = true;
      const { simulationState } = state;
      const { rng, entities } = simulationState;
      const shuffledHivelings = shuffle(rng, entities.filter(isHiveling));

      const inputs: Input[] = shuffledHivelings.map((h) =>
        makeInput(rng, entities, h)
      );

      socket.onmessage = (event: MessageEvent<string>) => {
        socket.onmessage = () => null;

        const outputs: Output[] = JSON.parse(event.data);
        state.simulationState = zip(outputs, shuffledHivelings).reduce(
          applyOutput,
          simulationState
        );
        state.sending = false;
      };
      socket.send(JSON.stringify(inputs));
      state.framesSinceLastAdvance = 0;
    } else {
      state.framesSinceLastAdvance += 1;
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

    const renderBuffer = initializeRenderBuffer();

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
      renderBuffer,
      background,
      scale,
      transformPositionToPixelSpace([0, 0])
    );

    if (showGrid) {
      drawGrid({
        renderBuffer,
        width: scale,
        height: scale,
        topLeft: transformPositionToPixelSpace([
          gameBorders.left,
          gameBorders.top
        ]),
        strokeStyle: "darkgrey",
        xCells: gameBorders.right - gameBorders.left + 1,
        yCells: gameBorders.top - gameBorders.bottom + 1,
        zIndex: 0
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
      const size = scale;
      const angle =
        "orientation" in e ? (toDeg(e.orientation) * Math.PI) / 180 : 0;
      if (e.type === HIVELING && showVision) {
        crossProduct(
          range(e.position[0] - sightDistance, e.position[0] + sightDistance),
          range(e.position[1] - sightDistance, e.position[1] + sightDistance)
        )
          .filter((p) => sees(e, p))
          .forEach((p) => {
            drawRect({
              renderBuffer,
              position: transformPositionToPixelSpace(p),
              width: size,
              height: size,
              fillStyle: "rgba(255,255,255,0.5",
              zIndex: 5
            });
          });
      }
      const [x, y] = transformPositionToPixelSpace(e.position);
      if (!image) {
        drawRect({
          renderBuffer,
          position: [x, y],
          width: size,
          height: size,
          fillStyle: "black",
          zIndex: 1
        });
      } else {
        drawImage({
          renderBuffer,
          image,
          width: size,
          height: size,
          angle,
          position: [x, y],
          zIndex: 1
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
        const lines = sortBy(
          (e) => -e.zIndex,
          entities.filter((e) => positionEquals(e.position, position))
        )
          .map(prettyPrintEntity)
          .join("\n")
          .split("\n");
        drawTextbox({
          renderBuffer,
          position: transformPositionToPixelSpace(position),
          lines,
          zIndex: 10
        });
      });
    }

    flush(ctx, renderBuffer);
    releasedKeys.clear();
    mouse.released = false;
    requestAnimationFrame(handleFrame);
  };
  handleFrame();
};

main();
