/* eslint-disable no-undef, @typescript-eslint/no-unused-vars */
import { drawImage, drawGrid, drawCone } from "canvas/draw";
import { Position, sortBy, clamp } from "utils";
import { gameBorders, fieldOfView } from "config";
import { advanceSimulation } from "hivelings/simulation";
import { loadStartingState, ScenarioName } from "hivelings/scenarios";
import { Entity, SimulationState } from "hivelings/types/simulation";
import { hivelingMind } from "hivelings/demoMind";
import { toDeg } from "hivelings/transformations";
import { EntityType, Input } from "hivelings/types/common";
import { loadAssets } from "canvas/assets";

const { HIVELING, NUTRITION, OBSTACLE, TRAIL, HIVE_ENTRANCE } = EntityType;

export interface GameState {
  simulationState: SimulationState;
  scale: number;
  cameraPosition: Position;
  speed: number;
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

const presses = (
  actions: { [key: string]: () => void },
  keys: Set<string>
): void => [...keys].forEach((k) => actions[k]?.());

const handleKeyPresses = (
  held: Set<string>,
  released: Set<string>,
  state: GameState
) => {
  const hBounds: [number, number] = [gameBorders.left, gameBorders.right];
  const vBounds: [number, number] = [gameBorders.bottom, gameBorders.top];
  // TODO: This cannot handle Shift-1 = +
  presses(
    {
      NumpadAdd: () => (state.scale += 0.4),
      NumpadSubtract: () => (state.scale -= 0.4),
      ArrowUp: () =>
        (state.cameraPosition[1] = clamp(
          state.cameraPosition[1] + 0.2,
          vBounds
        )),
      ArrowDown: () =>
        (state.cameraPosition[1] = clamp(
          state.cameraPosition[1] - 0.2,
          vBounds
        )),
      ArrowLeft: () =>
        (state.cameraPosition[0] = clamp(
          state.cameraPosition[0] - 0.2,
          hBounds
        )),
      ArrowRight: () =>
        (state.cameraPosition[0] = clamp(
          state.cameraPosition[0] + 0.2,
          hBounds
        )),
      Numpad1: () => (state.speed = 1),
      Numpad2: () => (state.speed = 2),
      Numpad3: () => (state.speed = 3),
      Digit1: () => (state.speed = 1),
      Digit2: () => (state.speed = 2),
      Digit3: () => (state.speed = 3)
    },
    held
  );
  presses(
    {
      Space: () => (state.speed = state.speed === 0 ? 1 : -state.speed)
    },
    released
  );
};

const getFramesPerStep = (speed: number): number | null => {
  switch (speed) {
    case 1:
      return 20;
    case 2:
      return 10;
    case 3:
      return 5;
    default:
      return null;
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

  const render = ({ scale, cameraPosition, simulationState }: GameState) => {
    const { entities } = simulationState;
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

  let state: GameState = {
    simulationState: loadStartingState(ScenarioName.BASE),
    scale: 20,
    cameraPosition: [0, 0],
    speed: 0,
    quitting: false
  };
  let frameNumber: number | null = null;
  const heldKeys = new Set<string>();
  const releasedKeys = new Set<string>();

  const onKeyDown = (e: KeyboardEvent) => heldKeys.add(e.code);
  const onKeyUp = (e: KeyboardEvent) => {
    heldKeys.delete(e.code);
    releasedKeys.add(e.code);
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  const handleFrame = async () => {
    if (state.quitting) {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      return;
    }

    handleKeyPresses(heldKeys, releasedKeys, state);
    releasedKeys.clear();

    const framesPerStep = getFramesPerStep(state.speed);
    if (framesPerStep && (frameNumber ?? 0) % framesPerStep === 0) {
      state.simulationState = await advanceSimulation(
        async (i: Input) => hivelingMind(i),
        state.simulationState
      );
    }
    render(state);

    frameNumber = requestAnimationFrame(handleFrame);
  };
  handleFrame();
};

main();
