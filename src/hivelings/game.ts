import { HivelingMind, Decision, Input } from "hivelings/types/common";
import { GameState, isHiveling, Hiveling } from "hivelings/types/simulation";
import { entityForPlayer } from "hivelings/transformations";
import { applyDecision, sees } from "hivelings/simulation";
import { hivelingMind } from "hivelings/demoMind";
import { shuffle, randomPrintable } from "rng/utils";
import { loadLaggedFibo } from "rng/laggedFibo";
import { PressedKeys } from "game/gameLoop";
import { clamp } from "utils";
import { gameBorders } from "config";

const presses = (
  actions: { [key: string]: () => void },
  keys: Set<string>
): void => [...keys].forEach((k) => actions[k]?.());

const handleKeyPresses = (keys: PressedKeys, state: GameState): GameState => {
  const newState = { ...state };
  const hBounds: [number, number] = [gameBorders.left, gameBorders.right];
  const vBounds: [number, number] = [gameBorders.bottom, gameBorders.top];
  // TODO: This cannot handle Shift-1 = +
  presses(
    {
      NumpadAdd: () => (newState.scale += 0.4),
      NumpadSubtract: () => (newState.scale -= 0.4),
      ArrowUp: () =>
        (newState.cameraPosition[1] = clamp(
          newState.cameraPosition[1] + 0.2,
          vBounds
        )),
      ArrowDown: () =>
        (newState.cameraPosition[1] = clamp(
          newState.cameraPosition[1] - 0.2,
          vBounds
        )),
      ArrowLeft: () =>
        (newState.cameraPosition[0] = clamp(
          newState.cameraPosition[0] - 0.2,
          hBounds
        )),
      ArrowRight: () =>
        (newState.cameraPosition[0] = clamp(
          newState.cameraPosition[0] + 0.2,
          hBounds
        )),
      Numpad1: () => (newState.speed = 1),
      Numpad2: () => (newState.speed = 2),
      Numpad3: () => (newState.speed = 3),
      Digit1: () => (newState.speed = 1),
      Digit2: () => (newState.speed = 2),
      Digit3: () => (newState.speed = 3)
    },
    keys.held
  );
  presses(
    {
      Space: () => (newState.speed = newState.speed === 0 ? 1 : -newState.speed)
    },
    keys.released
  );

  return newState;
};

const getFramesPerStep = ({ speed }: GameState): number | null => {
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

export const advanceSimulation = async (
  hivelingMind: HivelingMind,
  state: GameState
) => {
  const { rngState, entities } = state;
  const rng = loadLaggedFibo(rngState);
  const shuffledHivelings = shuffle(rng, entities.filter(isHiveling));

  // The player code need not be able to run in parallel, so we sequence here
  // instead of Promise.all.
  const decisionsWithMetadata: [Decision, Hiveling][] = [];
  for (const hiveling of shuffledHivelings) {
    const {
      position,
      orientation,
      identifier,
      highlighted,
      ...rest
    } = hiveling;
    const input: Input = {
      closeEntities: entities
        .filter(
          (e) => e.identifier !== identifier && sees(hiveling, e.position)
        )
        .map(entityForPlayer(orientation, position)),
      currentHiveling: { ...rest, position: [0, 0] },
      randomSeed: randomPrintable(rng, rngState.sequence.length)
    };
    const decision: [Decision, Hiveling] = [
      await hivelingMind(input),
      hiveling
    ];
    decisionsWithMetadata.push(decision);
  }

  return decisionsWithMetadata.reduce(applyDecision, {
    ...state,
    entities,
    rngState: rng.getState()
  });
};

export const gameIteration = async (
  frameNumber: number,
  keys: PressedKeys,
  inputState: GameState
) => {
  const state = handleKeyPresses(keys, inputState);
  const framesPerStep = getFramesPerStep(state);
  if (!framesPerStep || frameNumber % framesPerStep !== 0) {
    return state;
  }
  return advanceSimulation(async (i: Input) => hivelingMind(i), state);
};
