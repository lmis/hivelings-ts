/* eslint-disable no-undef, @typescript-eslint/no-unused-vars */
import { loadAssets } from "canvas/assets";
import {
  RenderBuffer,
  drawImage,
  drawAxisAlignedRect,
  drawTextbox,
  initializeRenderBuffer,
  flush,
  drawCircle,
  drawWedge
} from "canvas/draw";
import { Position, sortBy, clamp, hasAll, distance } from "utils";
import { hBounds, vBounds } from "config";
import {
  applyOutput,
  makeInput,
  fadeTrails,
  simulationInputToPlayerInput
} from "hivelings/simulation";
import { loadStartingState, ScenarioName } from "hivelings/scenarios";
import {
  Entity,
  SimulationState,
  isHiveling,
  Input
} from "hivelings/types/simulation";
import { hivelingMind as demoHiveMind } from "hivelings/demoMind";
import { fromHivelingFrameOfReference, toRad } from "hivelings/transformations";
import { EntityType, Output } from "hivelings/types/common";
import { randomPrintable, shuffle } from "rng/utils";
import { loadLaggedFibo } from "rng/laggedFibo";
declare class ClipboardItem {
  constructor(data: { [mimeType: string]: Blob });
}

const { HIVELING, OBSTACLE, TRAIL } = EntityType;

const prettyPrintEntity = (e: Entity, subItem: boolean = false): string[] => {
  const commonProps: (keyof Entity)[] = ["identifier", "zIndex", "radius"];
  const props: string[] =
    e.type === HIVELING
      ? [...commonProps, "orientation"]
      : e.type === TRAIL
      ? [...commonProps, "hivelingId", "orientation", "lifetime"]
      : e.type === OBSTACLE
      ? [...commonProps, "style"]
      : commonProps;
  const res = subItem
    ? []
    : [e.type, ` x: ${e.midpoint[0]}`, ` y: ${e.midpoint[1]}`];

  props.forEach((k: string) => res.push(` ${k}: ${(e as any)[k]}`));
  if (e.type === HIVELING && e.show) res.push(` show: ${e.show}`);
  if (e.type === HIVELING && e.carriedEntity) {
    res.push(` carriedEntity: ${e.carriedEntity.type}`);
    prettyPrintEntity(e.carriedEntity, true).forEach(x => res.push(x));
  }
  return res.map(r => (subItem ? "  " + r : r));
};

export interface GameState {
  simulationState: SimulationState;
  simulationStateHistory: SimulationState[];
  cachedInput: Map<number, Input>;
  scale: number;
  cameraPosition: Position;
  speed: number;
  sidebarEntityId: number | null;
  showVision: boolean;
  showInteractions: boolean;
  showHelp: boolean;
  quitting: boolean;
  sending: boolean;
  framesSinceLastAdvance: number;
}

const drawBackground = (
  renderBuffer: RenderBuffer,
  background: any,
  scale: number,
  [x, y]: Position
) => {
  const height = background.height * scale;
  const width = background.width * scale;
  drawAxisAlignedRect({
    renderBuffer,
    fillStyle: "rgb(30,60,15)",
    top: y - height / 2,
    left: x - width / 2,
    height,
    width,
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
  if (released.has("1")) state.speed = 1;
  if (released.has("2")) state.speed = 2;
  if (released.has("3")) state.speed = 3;
  if (released.has("4")) state.speed = 4;
  if (
    released.has("Backspace") &&
    !state.sending &&
    state.simulationStateHistory.length > 0
  ) {
    state.simulationState = state.simulationStateHistory[0];
    state.simulationStateHistory = state.simulationStateHistory.slice(1);
    state.cachedInput.clear();
  }

  if (released.has(" ")) state.speed = state.speed === 0 ? 1 : -state.speed;
  if (released.has("v")) state.showVision = !state.showVision;
  if (released.has("i")) state.showInteractions = !state.showInteractions;

  if (released.has("h")) state.showHelp = !state.showHelp;
  if (!held.has("h") && held.size > 0) state.showHelp = false;
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
  HIVELING: "Hiveling_iteration2.png",
  FOOD: "Strawberry.png",
  TRAIL: "Foot_prints.png",
  HIVE_ENTRANCE: "Burrow.png",
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

  const searchParams = new URLSearchParams(window.location.search);
  const scenario = searchParams.get("scenario") ?? ScenarioName.BASE;
  const debugHiveMind = searchParams.get("debug-hive-mind") ?? false;
  const url = searchParams.get("hive-mind");
  const socket = url ? new WebSocket(decodeURIComponent(url)) : null;
  const send = async (message: string) =>
    socket
      ? new Promise<string>(resolve => {
          socket.onmessage = (event: MessageEvent<string>) => {
            socket.onmessage = () => null;

            resolve(event.data);
          };
          socket.send(message);
        })
      : JSON.stringify(demoHiveMind(JSON.parse(message)));

  let state: GameState = {
    simulationState: loadStartingState(scenario),
    simulationStateHistory: [],
    cachedInput: new Map(),
    sidebarEntityId: null,
    scale: 20,
    cameraPosition: [0, 0],
    speed: 0,
    showVision: false,
    showInteractions: false,
    showHelp: false,
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
          {
            ...state.simulationState,
            entities: state.simulationState.entities.map(e => ({
              ...e,
              midpoint: [...e.midpoint] as Position
            }))
          },
          ...state.simulationStateHistory
        ].slice(0, 100);

        const rng = loadLaggedFibo(state.simulationState.rngState);
        const shuffledHivelings = shuffle(
          rng,
          state.simulationState.entities.filter(isHiveling)
        );

        for (const currentHiveling of shuffledHivelings) {
          const randomSeed = randomPrintable(
            rng,
            rng.getState().sequence.length
          );
          /* Not using cached input here because it's not worth worrying 
             about the race-condition arising from invalidating the cache
             here (async) and recomputing it in the main loop.
           */
          const input: Input = makeInput(
            state.simulationState.entities,
            currentHiveling
          );
          const output: Output<unknown> = JSON.parse(
            await send(
              JSON.stringify(
                debugHiveMind
                  ? {
                      ...input,
                      randomSeed,
                      currentHiveling: {
                        ...currentHiveling,
                        carriedType: currentHiveling.carriedEntity?.type ?? null
                      }
                    }
                  : simulationInputToPlayerInput(input, randomSeed)
              )
            )
          );
          applyOutput(state.simulationState, currentHiveling, input, output);
          state.cachedInput.clear();
        }
        fadeTrails(state.simulationState);
        state.cachedInput.clear();
        state.simulationState.rngState = rng.getState();
        state.simulationState.roundNumber++;
        state.sending = false;
      })();

      state.framesSinceLastAdvance = 0;
    } else {
      state.framesSinceLastAdvance += 1;
    }

    if (
      (state.showInteractions || state.showVision) &&
      state.cachedInput.size === 0
    ) {
      state.simulationState.entities.filter(isHiveling).forEach(h => {
        state.cachedInput.set(
          h.identifier,
          makeInput(state.simulationState.entities, h)
        );
      });
    }

    const remainingFood = [
      ...state.simulationState.entities,
      ...state.simulationState.entities
        .filter(isHiveling)
        .map(e => e.carriedEntity)
    ].filter(e => e?.type === EntityType.FOOD).length;

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

    const infoBoxDimensions = {
      top: 0.01 * canvasHeight,
      left: 0.01 * canvasWidth,
      width: 180,
      lineHeight: 20,
      bottomPadding: 9,
      leftPadding: 4,
      zIndex: 900
    };

    let gameOverLines =
      state.simulationState.score >= 0
        ? [
            "You win!",
            ` Final Score: ${state.simulationState.score}`,
            ` Rounds: ${state.simulationState.roundNumber}`
          ]
        : [
            "You lose!",
            ` Your score was too low: ${state.simulationState.score}`,
            ` Rounds: ${state.simulationState.roundNumber}`
          ];
    const gameOverScreenProps = {
      top: 0.01 * canvasHeight,
      left: 0.3 * canvasWidth,
      width: 300,
      lineHeight: 30,
      bottomPadding: 9,
      leftPadding: 4,
      lines: gameOverLines,
      zIndex: 1000
    };

    const helpButtonDimensions = {
      top: 0.87 * canvasHeight,
      left: 0.01 * canvasWidth,
      width: 68,
      height: 78,
      lineHeight: 60,
      bottomPadding: 18,
      leftPadding: 20,
      zIndex: 900
    };

    const rules = [
      " In each iteration, this game will send one message per Hiveling to your server.",
      " The message contains the world as experienced by the Hiveling.",
      " Your server must respond with an appropriate action.",
      " For a full description of the rules and data types involved, see: github.com/lmis/hivelings-ts"
    ];
    const howToPlay = url
      ? [
          ` This game is connected to your websockets server at ${url}`,
          ...rules
        ]
      : [
          " You are currently in demo mode. You can only watch as the Hivelings do their thing.",
          ` To play the game, call this url (${window.location}) with the 'hive-mind' query-param pointing to your websockets server.`,
          ` Example: ${window.location}?hive-mind=wss%3A%2F%2Flocalhost:8080%2F`,
          "",
          ...rules
        ];
    const helpScreenLines = [
      "Keybinding:",
      ` Any key                     Close this menu`,
      ` Space                       Pause / Unpause`,
      ` Enter                       Advance one round`,
      ` Backspace                   Undo last round`,
      ` Arrow Keys                  Move camera`,
      ` Shift+Arrow Up or Numpad+   Zoom in`,
      ` Shift+Arrow Down or Numpad- Zoom out`,
      ` 1-4                         Set speed`,
      ` v                           Show vision indicator`,
      ` i                           Show interaction and move indicator`,
      ` h                           Toggle this screen`,
      "",
      "Scenario Goal:",
      ` Bring all Strawberries to the hive. ${remainingFood} remaining.`,
      "",
      "How to Play:",
      ...howToPlay
    ];

    const helpScreenProps = {
      top: 0.01 * canvasHeight,
      left: 0.01 * canvasWidth,
      width: 0.98 * canvasWidth,
      lineHeight: 18,
      bottomPadding: (1 - 0.02) * canvasHeight - 18 * helpScreenLines.length,
      leftPadding: 4,
      lines: helpScreenLines,
      zIndex: 1500
    };

    const helpScreenCancelButtonProps = {
      top: 0.02 * canvasHeight,
      left: 0.98 * canvasWidth - 68,
      width: 68,
      height: 78, // lineHeight + padding
      lineHeight: 60,
      bottomPadding: 18,
      leftPadding: 20,
      lines: ["X"],
      zIndex: 1501
    };

    const sideBarProps = {
      top: 0.01 * canvasHeight,
      left: 0.78 * canvasWidth,
      height: 0.98 * canvasHeight,
      width: (1 - 0.78 - 0.01) * canvasWidth,
      lineHeight: 18,
      leftPadding: 4,
      zIndex: 900
    };

    const sideBarCopyButtonProps = {
      top: 0.87 * canvasHeight,
      left: 0.8 * canvasWidth,
      width: sideBarProps.width - 0.04 * canvasWidth,
      height: 78,
      lineHeight: 60,
      bottomPadding: 18,
      leftPadding: 20,
      lines: ["Copy"],
      zIndex: 901
    };
    drawTextbox({
      renderBuffer,
      ...infoBoxDimensions,
      lines: [
        `Score: ${state.simulationState.score}` +
          (debugHiveMind ? " (DEBUG)" : ""),
        `Scenario: ${scenario}`,
        `Round: ${state.simulationState.roundNumber}`,
        `Remaining Food: ${remainingFood}`,
        `Hive Mind:`,
        " " + (url ?? "Demo")
      ]
    });

    if (!state.showHelp) {
      drawTextbox({
        renderBuffer,
        ...helpButtonDimensions,
        lines: ["?"]
      });
      if (mouse.released && mouse.position) {
        const [x, y] = mouse.position;
        if (
          x > helpButtonDimensions.left &&
          x < helpButtonDimensions.left + helpButtonDimensions.width &&
          y > helpButtonDimensions.top &&
          y < helpButtonDimensions.top + helpButtonDimensions.height
        ) {
          state.showHelp = true;
        }
      }
    } else {
      drawTextbox({
        renderBuffer,
        ...helpScreenProps
      });
      drawTextbox({
        renderBuffer,
        ...helpScreenCancelButtonProps
      });
      if (mouse.released && mouse.position) {
        const [x, y] = mouse.position;
        if (
          x > helpScreenCancelButtonProps.left &&
          x <
            helpScreenCancelButtonProps.left +
              helpScreenCancelButtonProps.width &&
          y > helpScreenCancelButtonProps.top &&
          y <
            helpScreenCancelButtonProps.top + helpScreenCancelButtonProps.height
        ) {
          state.showHelp = false;
        }
      }
    }

    entities.forEach(e => {
      const image = "style" in e ? assets[e.style] : assets[e.type];
      const angle = "orientation" in e ? toRad(e.orientation) : 0;
      const position = transformPositionToPixelSpace(e.midpoint);
      drawImage({
        renderBuffer,
        image,
        width: 2 * e.radius * scale,
        height: 2 * e.radius * scale,
        angle,
        position,
        zIndex: e.zIndex
      });
      if (e.identifier === state.sidebarEntityId) {
        drawCircle({
          renderBuffer,
          strokeStyle: `rgba(${"color" in e ? e.color : "255,255,255"}, 0.5)`,
          lineWidth: 0.1 * scale,
          radius: 1.1 * e.radius * scale,
          zIndex: 800,
          position
        });
      }

      if (e.type === HIVELING && e.carriedEntity) {
        const other = e.carriedEntity;
        drawImage({
          renderBuffer,
          image: "style" in other ? assets[other.style] : assets[other.type],
          width: 2 * other.radius * scale,
          height: 2 * other.radius * scale,
          angle: angle + Math.PI / 2,
          position: transformPositionToPixelSpace(
            fromHivelingFrameOfReference(e.midpoint, e.orientation, [0, 0.4])
          ),
          zIndex: e.zIndex - 0.1
        });
      }

      if (showInteractions && e.type === HIVELING) {
        const cachedInput = state.cachedInput.get(e.identifier);
        const maxMoveDistance = cachedInput?.maxMoveDistance ?? 0;
        drawCircle({
          renderBuffer,
          fillStyle: `rgba(${e.color}, 0.5)`,
          radius: 5,
          zIndex: 800,
          position: transformPositionToPixelSpace(
            fromHivelingFrameOfReference(e.midpoint, e.orientation, [
              0,
              maxMoveDistance
            ])
          )
        });
        (cachedInput?.interactableEntities ?? []).forEach(other =>
          drawCircle({
            renderBuffer,
            position: transformPositionToPixelSpace(
              fromHivelingFrameOfReference(
                e.midpoint,
                e.orientation,
                other.midpoint
              )
            ),
            radius: other.radius * scale,
            fillStyle: `rgba(${e.color}, 0.8)`,
            zIndex: 500
          })
        );
      }
      if (showVision && e.type === HIVELING) {
        const cachedInput = state.cachedInput.get(e.identifier);
        (cachedInput?.visibilityEndpoints ?? []).forEach(
          ({ dist, angleStart, angleEnd }) => {
            drawWedge({
              renderBuffer,
              start: transformPositionToPixelSpace(e.midpoint),
              radius: dist * scale,
              angleStart: toRad(angleStart),
              angleEnd: toRad(angleEnd),
              fillStyle: `rgba(${e.color},0.2)`,
              zIndex: 500
            });
          }
        );
        (cachedInput?.visibleEntities ?? []).forEach(other =>
          drawCircle({
            renderBuffer,
            position: transformPositionToPixelSpace(
              fromHivelingFrameOfReference(
                e.midpoint,
                e.orientation,
                other.midpoint
              )
            ),
            radius: other.radius * scale,
            fillStyle: `rgba(${e.color}, 0.3)`,
            zIndex: 500
          })
        );
      }
    });

    if (mouse.position) {
      const [x, y] = mouse.position;

      const mouseInSideBar =
        state.sidebarEntityId !== null &&
        x > sideBarProps.left &&
        x < sideBarProps.left + sideBarProps.width &&
        y > sideBarProps.top &&
        y < sideBarProps.top + sideBarProps.height;

      if (!mouseInSideBar) {
        const mousePosition = transformPositionToGameSpace(mouse.position);
        const entitiesWithMouseDistance = entities.map(e => ({
          ...e,
          mouseDistance: distance(e.midpoint, mousePosition)
        }));

        const highlightedEntity = entitiesWithMouseDistance
          .filter(e => e.mouseDistance < e.radius * 1.2)
          .sort((a, b) =>
            a.mouseDistance <= 0.8 && b.mouseDistance > 0.8
              ? 1
              : b.mouseDistance <= 0.8 && a.mouseDistance > 0.8
              ? -1
              : b.zIndex - a.zIndex
          )[0];
        if (mouse.released) {
          if (
            !highlightedEntity ||
            highlightedEntity.identifier === state.sidebarEntityId
          ) {
            state.sidebarEntityId = null;
          } else {
            state.sidebarEntityId = highlightedEntity.identifier;
          }
        }
        if (highlightedEntity) {
          const lines: string[] = [];
          sortBy(
            e => -e.zIndex,
            entities.filter(
              e =>
                distance(highlightedEntity.midpoint, e.midpoint) <
                highlightedEntity.radius + e.radius - 0.000001
            )
          ).forEach(e => prettyPrintEntity(e).forEach(l => lines.push(l)));
          const [x, y] = transformPositionToPixelSpace(
            highlightedEntity.midpoint
          );
          const lineHeight = 18;
          const bottomPadding = 8;
          const height = lineHeight * lines.length + bottomPadding;
          const width = 180;
          const yType =
            y + height > canvasHeight
              ? "top"
              : y - height < 0
              ? "bottom"
              : "mid";
          const xType =
            x + width / 2 >
            (state.sidebarEntityId !== null ? sideBarProps.left : canvasWidth)
              ? "right"
              : x - width / 2 < 0
              ? "left"
              : "mid";

          const top =
            (xType === "mid" && yType === "mid") || yType === "bottom"
              ? y + 0.8 * scale
              : yType === "top"
              ? y - height - 0.8 * scale
              : y - height / 2;
          const left =
            xType === "mid"
              ? x - width / 2
              : xType === "left"
              ? x + 0.8 * scale
              : x - width - 0.8 * scale;
          drawTextbox({
            renderBuffer,
            left,
            top,
            width,
            lines,
            lineHeight,
            bottomPadding,
            leftPadding: 4,
            zIndex: 1000
          });
        }
      }
    }

    const sidebarEntity = entities.find(
      e => e.identifier === state.sidebarEntityId
    );
    if (sidebarEntity) {
      const lines: string[] = [];
      const sideBarEntities = sortBy(
        e => -e.zIndex,
        entities.filter(
          e =>
            distance(sidebarEntity.midpoint, e.midpoint) <
            sidebarEntity.radius + e.radius - 0.000001
        )
      );
      sideBarEntities.forEach(e =>
        prettyPrintEntity(e).forEach(l => lines.push(l))
      );
      drawTextbox({
        renderBuffer,
        lines,
        bottomPadding:
          sideBarProps.height - sideBarProps.lineHeight * lines.length,
        ...sideBarProps
      });
      drawTextbox({
        renderBuffer,
        ...sideBarCopyButtonProps
      });
      if (mouse.released && mouse.position) {
        const [x, y] = mouse.position;
        if (
          x > sideBarCopyButtonProps.left &&
          x < sideBarCopyButtonProps.left + sideBarCopyButtonProps.width &&
          y > sideBarCopyButtonProps.top &&
          y < sideBarCopyButtonProps.top + sideBarCopyButtonProps.height
        ) {
          const text = JSON.stringify(sideBarEntities);

          (async () => {
            try {
              const type = "text/plain";
              const data = [
                new ClipboardItem({ [type]: new Blob([text], { type }) })
              ];
              await (navigator.clipboard as any)?.write(data);
            } catch (e) {
              console.log("Cannot copy to clipboard: ", text);
            }
          })();
        }
      }
    }

    if (remainingFood === 0 || state.simulationState.score < 0) {
      drawTextbox({ renderBuffer, ...gameOverScreenProps });
      state.speed = 0;
    }
    flush(ctx, renderBuffer);
    releasedKeys.clear();
    mouse.released = false;
    requestAnimationFrame(handleFrame);
  };
  handleFrame();
};

main();
