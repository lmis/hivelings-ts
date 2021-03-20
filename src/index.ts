/* eslint-disable no-undef, @typescript-eslint/no-unused-vars */
import { loadAssets } from "canvas/assets";
import {
  RenderBuffer,
  drawImage,
  drawRect,
  drawTextbox,
  initializeRenderBuffer,
  flush,
  drawCircle,
  drawLine
} from "canvas/draw";
import { Position, sortBy, clamp, hasAll, distance, uniqueBy } from "utils";
import { hBounds, vBounds, debugHiveMind } from "config";
import {
  applyOutput,
  makeInput,
  stripSimulationProps,
  fadeTrails
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
import { fromHivelingFrameOfReference, toRad } from "hivelings/transformations";
import { EntityType, Output } from "hivelings/types/common";
import { randomPrintable, shuffle } from "rng/utils";
import { loadLaggedFibo } from "rng/laggedFibo";

const { HIVELING, FOOD, OBSTACLE, TRAIL, HIVE_ENTRANCE } = EntityType;

const prettyPrintEntity = (e: Entity): string => {
  const commonProps: (keyof Entity)[] = ["identifier", "zIndex", "radius"];
  const trailProps: (keyof Trail)[] = ["hivelingId", "orientation", "lifetime"];
  const hivelingProps: (keyof Hiveling)[] = ["hasFood", "orientation"];
  const position = `${e.type}\n x: ${e.midpoint[0]}\n y: ${e.midpoint[1]}`;
  const props: string[] =
    e.type === HIVELING
      ? [...commonProps, ...hivelingProps]
      : e.type === TRAIL
      ? [...commonProps, ...trailProps]
      : e.type === OBSTACLE
      ? [...commonProps, "style"]
      : commonProps;
  return (
    position +
    "\n" +
    props.map((k: string) => ` ${k}: ${(e as any)[k]}`).join("\n") +
    (e.type === HIVELING && e.show ? `\n show: ${e.show}` : "")
  );
};

interface Metadata {
  maxMoveDistanceByHivelingId: Map<number, number>;
  interactableEntityIds: Set<Number>;
  visibleEntityIds: Set<number>;
  visibilityEndpointsByHivelingId: Map<number, Position[]>;
  outdated: boolean;
}

export interface GameState {
  simulationState: SimulationState;
  simulationStateHistory: SimulationState[];
  metadata: Metadata;
  scale: number;
  cameraPosition: Position;
  speed: number;
  showVision: boolean;
  showInteractions: boolean;
  highlighted: Set<number>;
  quitting: boolean;
  sending: boolean;
  framesSinceLastAdvance: number;
}

const drawBackground = (
  renderBuffer: RenderBuffer,
  background: any,
  scale: number,
  position: Position
) => {
  drawRect({
    renderBuffer,
    width: background.width * scale,
    height: background.height * scale,
    fillStyle: "rgb(30,60,15)",
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
  if (
    released.has("Backspace") &&
    !state.sending &&
    state.simulationStateHistory.length > 0
  ) {
    state.simulationState = state.simulationStateHistory[0];
    state.simulationStateHistory = state.simulationStateHistory.slice(1);
    state.metadata.outdated = true;
  }

  if (released.has(" ")) state.speed = state.speed === 0 ? 1 : -state.speed;
  if (released.has("v")) state.showVision = !state.showVision;
  if (released.has("i")) state.showInteractions = !state.showInteractions;
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
  hivelingWithFood: "Hiveling_strawberry.png",
  food: "Strawberry.png",
  trail: "Foot_prints.png",
  hiveEntrance: "Burrow.png",
  background: "autumn_leaves_green_hue.png",
  treeStump: "tree_stump.png",
  rocks: "Boulders.png"
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
    simulationStateHistory: [],
    metadata: {
      maxMoveDistanceByHivelingId: new Map(),
      interactableEntityIds: new Set(),
      visibleEntityIds: new Set(),
      visibilityEndpointsByHivelingId: new Map(),
      outdated: true
    },
    scale: 20,
    cameraPosition: [0, 0],
    speed: 0,
    showVision: false,
    showInteractions: false,
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
      (async () => {
        state.sending = true;
        state.simulationStateHistory = [
          state.simulationState,
          ...state.simulationStateHistory
        ].slice(0, 100);

        const rng = loadLaggedFibo(state.simulationState.rngState);
        const shuffledHivelings = shuffle(
          rng,
          state.simulationState.entities.filter(isHiveling)
        );

        for (const currentHiveling of shuffledHivelings) {
          const input = {
            ...makeInput(state.simulationState.entities, currentHiveling),
            randomSeed: randomPrintable(rng, rng.getState().sequence.length)
          };
          const output: Output<unknown> = JSON.parse(
            await send(
              JSON.stringify(
                debugHiveMind
                  ? { ...input, currentHiveling }
                  : stripSimulationProps(input)
              )
            )
          );
          state.simulationState = applyOutput(
            state.simulationState,
            currentHiveling,
            input,
            output
          );
          state.metadata.outdated = true;
        }
        state.simulationState = fadeTrails(state.simulationState);
        state.metadata.outdated = true;
        state.simulationState.rngState = rng.getState();
        state.sending = false;
      })();

      state.framesSinceLastAdvance = 0;
    } else {
      state.framesSinceLastAdvance += 1;
    }

    if (
      (state.showInteractions || state.showVision) &&
      state.metadata.outdated
    ) {
      const {
        visibleEntityIds,
        interactableEntityIds,
        maxMoveDistanceByHivelingId,
        visibilityEndpointsByHivelingId
      } = state.metadata;
      visibleEntityIds.clear();
      interactableEntityIds.clear();
      maxMoveDistanceByHivelingId.clear();
      visibilityEndpointsByHivelingId.clear();

      state.simulationState.entities.filter(isHiveling).forEach((h) => {
        const {
          maxMoveDistance,
          visibleEntities,
          visibilityEndpoints,
          interactableEntities
        } = makeInput(state.simulationState.entities, h);
        interactableEntities.forEach((e) =>
          interactableEntityIds.add(e.identifier)
        );
        visibleEntities.forEach((e) => visibleEntityIds.add(e.identifier));
        visibilityEndpointsByHivelingId.set(h.identifier, visibilityEndpoints);
        maxMoveDistanceByHivelingId.set(h.identifier, maxMoveDistance);
      });
      state.metadata.outdated = false;
    }
    const {
      scale,
      cameraPosition,
      simulationState: { entities },
      showVision,
      showInteractions
    } = state;
    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const renderBuffer = initializeRenderBuffer();

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
      assets.background,
      scale,
      transformPositionToPixelSpace([0, 0])
    );

    drawTextbox({
      renderBuffer,
      position: [canvasWidth / 2, (9 * canvasHeight) / 100],
      lines: [` Score: ${state.simulationState.score}`],
      zIndex: 900
    });

    entities.forEach((e) => {
      const image = (() => {
        switch (e.type) {
          case FOOD:
            return assets.food;
          case HIVELING:
            return e.hasFood ? assets.hivelingWithFood : assets.hiveling;
          case TRAIL:
            return assets.trail;
          case HIVE_ENTRANCE:
            return assets.hiveEntrance;
          case OBSTACLE:
            return assets[e.style];
        }
      })();
      const angle = "orientation" in e ? toRad(e.orientation) : 0;
      const [x, y] = transformPositionToPixelSpace(e.midpoint);
      drawImage({
        renderBuffer,
        image,
        width: 2 * e.radius * scale,
        height: 2 * e.radius * scale,
        angle,
        position: [x, y],
        zIndex: e.zIndex
      });

      if (showInteractions && e.type === HIVELING) {
        const maxMoveDistance =
          state.metadata.maxMoveDistanceByHivelingId.get(e.identifier) ?? 0;
        drawCircle({
          renderBuffer,
          fillStyle: "blue",
          radius: 5,
          zIndex: 800,
          position: transformPositionToPixelSpace(
            fromHivelingFrameOfReference(e.midpoint, e.orientation, [
              0,
              maxMoveDistance
            ])
          )
        });
      }
      if (showVision && e.type === HIVELING) {
        (
          state.metadata.visibilityEndpointsByHivelingId.get(e.identifier) ?? []
        ).forEach((p) => {
          drawLine({
            renderBuffer,
            start: transformPositionToPixelSpace(e.midpoint),
            end: transformPositionToPixelSpace(p),
            strokeStyle: "rgba(255,255,255,0.1",
            zIndex: 500
          });
        });
      }
      if (showVision && state.metadata.visibleEntityIds.has(e.identifier)) {
        drawCircle({
          renderBuffer,
          position: transformPositionToPixelSpace(e.midpoint),
          radius: e.radius * scale,
          fillStyle: "rgba(255,255,255,0.3",
          zIndex: 500
        });
      }

      if (
        showInteractions &&
        state.metadata.interactableEntityIds.has(e.identifier)
      ) {
        drawCircle({
          renderBuffer,
          position: transformPositionToPixelSpace(e.midpoint),
          radius: e.radius * scale,
          fillStyle: "rgba(0,0,0,0.8",
          zIndex: 500
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
