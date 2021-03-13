/* eslint-disable no-undef, @typescript-eslint/no-unused-vars */
import { loadAssets } from "canvas/assets";
import {
  RenderBuffer,
  drawImage,
  drawRect,
  drawTextbox,
  initializeRenderBuffer,
  flush,
  drawLine,
  drawCircle
} from "canvas/draw";
import {
  Position,
  sortBy,
  clamp,
  hasAll,
  distance,
  uniqueBy,
  crossProduct,
  Box,
  rangeSteps
} from "utils";
import { gameBorders, interactionArea, sightDistance } from "config";
import {
  applyOutput,
  makeInput,
  inFieldOfVision,
  stripSimulationProps
} from "hivelings/simulation";
import { loadStartingState, ScenarioName } from "hivelings/scenarios";
import {
  Entity,
  Hiveling,
  SimulationState,
  isHiveling,
  Trail
} from "hivelings/types/simulation";
import { hivelingMind as demoHiveMind } from "hivelings/demoMind";
import {
  fromHivelingFrameOfReference,
  toHivelingFrameOfReference,
  toRad
} from "hivelings/transformations";
import { EntityType } from "hivelings/types/common";
import { shuffle } from "rng/utils";

const { HIVELING, FOOD, OBSTACLE, TRAIL, HIVE_ENTRANCE } = EntityType;
const hBounds: [number, number] = [gameBorders.left, gameBorders.right];
const vBounds: [number, number] = [gameBorders.bottom, gameBorders.top];

const prettyPrintEntity = (e: Entity): string => {
  const commonProps: (keyof Entity)[] = ["identifier", "zIndex", "radius"];
  const trailProps: (keyof Trail)[] = ["hivelingId", "orientation", "lifetime"];
  const hivelingProps: (keyof Hiveling)[] = [
    "hasFood",
    "orientation",
    "memory64"
  ];
  const position = `${e.type}\n x: ${e.midpoint[0]}\n y: ${e.midpoint[1]}`;
  const props: string[] =
    e.type === HIVELING
      ? [...commonProps, ...hivelingProps]
      : e.type === TRAIL
      ? [...commonProps, ...trailProps]
      : commonProps;
  return (
    position +
    "\n" +
    props.map((k: string) => ` ${k}: ${(e as any)[k]}`).join("\n")
  );
};

export interface GameState {
  simulationState: SimulationState;
  scale: number;
  cameraPosition: Position;
  speed: number;
  showVision: boolean;
  showInteractionArea: boolean;
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
  if (released.has("i")) state.showInteractionArea = !state.showInteractionArea;
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

  const url = new URLSearchParams(window.location.search).get("hive-mind");
  const socket = url ? new WebSocket(decodeURIComponent(url)) : null;
  const send = async (message: string) =>
    socket
      ? new Promise<string>((resolve) => {
          socket.onmessage = (event: MessageEvent<string>) => {
            socket.onmessage = () => null;

            resolve(event.data);
          };
          socket.send(message);
        })
      : JSON.stringify(demoHiveMind(JSON.parse(message)));

  let state: GameState = {
    simulationState: loadStartingState(ScenarioName.BASE),
    scale: 20,
    cameraPosition: [0, 0],
    speed: 0,
    showVision: false,
    showInteractionArea: false,
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
      const { rng, entities } = state.simulationState;
      const shuffledHivelings = shuffle(rng, entities.filter(isHiveling));

      (async () => {
        for (const h of shuffledHivelings) {
          const input = makeInput(state.simulationState, h);
          const output = JSON.parse(
            await send(JSON.stringify(stripSimulationProps(input)))
          );
          state.simulationState = applyOutput(state.simulationState, [
            input,
            output
          ]);
        }
        state.sending = false;
      })();

      state.framesSinceLastAdvance = 0;
    } else {
      state.framesSinceLastAdvance += 1;
    }

    const {
      scale,
      cameraPosition,
      simulationState: { entities },
      showVision,
      showInteractionArea
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

    entities.forEach((e) => {
      const image = (() => {
        switch (e.type) {
          case FOOD:
            return assets.nutrition;
          case HIVELING:
            return e.hasFood ? assets.hivelingWithNutrition : assets.hiveling;
          case TRAIL:
            return assets.trail;
          case HIVE_ENTRANCE:
            return assets.hiveEntrance;
          case OBSTACLE:
            return null;
        }
      })();
      const angle = "orientation" in e ? toRad(e.orientation) : 0;
      if (e.type === HIVELING && showInteractionArea) {
        const maxMoveDistance = Math.min(
          1,
          ...entities
            .map((other) => ({
              ...other,
              midpoint: toHivelingFrameOfReference(
                e.midpoint,
                e.orientation,
                other.midpoint
              )
            }))
            .filter(
              ({ identifier, radius, midpoint: [x, y], type }) =>
                e.identifier !== identifier &&
                [HIVELING, OBSTACLE].includes(type) &&
                x + radius > -e.radius &&
                x - radius < e.radius &&
                y + radius > 0
            )
            .map(
              ({ radius, midpoint: [x, y], type }) =>
                y - Math.sqrt(Math.pow(radius + e.radius, 2) - x * x)
            )
        );
        drawCircle({
          renderBuffer,
          fillStyle: "grey",
          radius: 5,
          zIndex: 800,
          position: transformPositionToPixelSpace(
            fromHivelingFrameOfReference(e.midpoint, e.orientation, [
              0,
              maxMoveDistance
            ])
          )
        });
        const topLeft: Position = fromHivelingFrameOfReference(
          e.midpoint,
          e.orientation,
          [interactionArea.left, interactionArea.top]
        );
        const topRight: Position = fromHivelingFrameOfReference(
          e.midpoint,
          e.orientation,
          [interactionArea.right, interactionArea.top]
        );
        const bottomLeft: Position = fromHivelingFrameOfReference(
          e.midpoint,
          e.orientation,
          [interactionArea.left, interactionArea.bottom]
        );
        const bottomRight: Position = fromHivelingFrameOfReference(
          e.midpoint,
          e.orientation,
          [interactionArea.right, interactionArea.bottom]
        );
        [
          [topLeft, topRight],
          [topLeft, bottomLeft],
          [topRight, bottomRight],
          [bottomLeft, bottomRight]
        ].forEach(([a, b]) => {
          drawLine(
            renderBuffer,
            transformPositionToPixelSpace(a),
            transformPositionToPixelSpace(b),
            "black",
            800
          );
        });
      }
      if (e.type === HIVELING && showVision) {
        entities
          .filter(
            (other) =>
              other.identifier !== e.identifier &&
              inFieldOfVision(e, other.midpoint)
          )
          .forEach((other) => {
            drawCircle({
              renderBuffer,
              position: transformPositionToPixelSpace(other.midpoint),
              radius: other.radius * scale,
              fillStyle: "rgba(255,255,255,0.5",
              zIndex: 500
            });
          });
        crossProduct(
          rangeSteps(
            0.5,
            e.midpoint[0] - sightDistance,
            e.midpoint[0] + sightDistance
          ),
          rangeSteps(
            0.5,
            e.midpoint[1] - sightDistance,
            e.midpoint[1] + sightDistance
          )
        )
          .filter((p) => inFieldOfVision(e, p))
          .forEach((p) => {
            drawCircle({
              renderBuffer,
              position: transformPositionToPixelSpace(p),
              radius: 0.1 * scale,
              fillStyle: "rgba(255,255,255,0.5",
              zIndex: 500
            });
          });
      }
      const [x, y] = transformPositionToPixelSpace(e.midpoint);
      if (!image) {
        drawRect({
          renderBuffer,
          position: [x, y],
          width: 2 * e.radius * scale,
          height: 2 * e.radius * scale,
          fillStyle: "black",
          zIndex: e.zIndex
        });
      } else {
        drawImage({
          renderBuffer,
          image,
          width: 2 * e.radius * scale,
          height: 2 * e.radius * scale,
          angle,
          position: [x, y],
          zIndex: e.zIndex
        });
      }
    });

    const mousePosition =
      mouse.position && transformPositionToGameSpace(mouse.position);

    if (mousePosition) {
      const underCursor = entities.filter(
        (e) => distance(e.midpoint, mousePosition) < e.radius
      );
      if (mouse.clicking) {
        if (underCursor.length === 0) {
          state.highlighted.clear();
        } else {
          underCursor.map((e) => state.highlighted.add(e.identifier));
        }
      }

      const highlightedEntities = uniqueBy((e) => e.identifier, [
        ...entities.filter((e) => state.highlighted.has(e.identifier)),
        ...underCursor
      ]);

      highlightedEntities.forEach((h, i) => {
        const lines = sortBy(
          (e) => -e.zIndex,
          entities.filter(
            (e) =>
              distance(h.midpoint, e.midpoint) < h.radius + e.radius - 0.000001
          )
        )
          .map(prettyPrintEntity)
          .join("\n")
          .split("\n");
        drawTextbox({
          renderBuffer,
          position: transformPositionToPixelSpace(h.midpoint),
          lines,
          zIndex: 1000 + i
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
