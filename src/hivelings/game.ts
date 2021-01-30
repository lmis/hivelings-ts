import { HivelingMind, Decision, Input } from "hivelings/types/common";
import {
  GameState,
  Entity,
  isHiveling,
  Hiveling
} from "hivelings/types/simulation";
import { entityForPlayer } from "hivelings/transformations";
import { applyDecision, sees } from "hivelings/simulation";
import { shuffle, randomPrintable } from "rng/utils";
import { loadLaggedFibo } from "rng/laggedFibo";
import { GameIteration, PressedKeys } from "game/useGameLoop";
import filter from "lodash/fp/filter";
import { clamp } from "utils";
import { gameBorders } from "config";

const takeDecision = async (
  randomSeed: string,
  entities: Entity[],
  hivelingMind: HivelingMind,
  hiveling: Hiveling
): Promise<[Decision, Hiveling]> => {
  const { position, orientation, identifier, highlighted, ...rest } = hiveling;
  const input: Input = {
    closeEntities: entities
      .filter((e) => e.identifier !== identifier && sees(hiveling, e.position))
      .map(entityForPlayer(orientation, position)),
    currentHiveling: { ...rest, position: [0, 0] },
    randomSeed
  };
  return [await hivelingMind(input), hiveling];
};

const presses = (
  actions: { [key: string]: () => void },
  keys: Set<string>
): void => [...keys].forEach((k) => actions[k]?.());

const handleKeyPresses = (keys: PressedKeys, state: GameState): GameState => {
  const newState = { ...state };
  const hBounds: [number, number] = [gameBorders.left, gameBorders.right];
  const vBounds: [number, number] = [gameBorders.bottom, gameBorders.top];
  presses(
    {
      NumpadAdd: () => (newState.scale += 0.01),
      NumpadSubtract: () => (newState.scale -= 0.01),
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

export const makeGameIteration = (
  hivelingMind: HivelingMind
): GameIteration<GameState> => async (
  frameNumber: number,
  keys: PressedKeys,
  inputState: GameState
) => {
  const state = handleKeyPresses(keys, inputState);
  const framesPerStep = getFramesPerStep(state);
  if (!framesPerStep || frameNumber % framesPerStep !== 0) {
    return state;
  }
  const { rngState, entities } = state;
  const rng = loadLaggedFibo(rngState);
  const shuffledHivelings = shuffle(rng, filter(isHiveling)(entities));

  // The player code need not be able to run in parallel, so we sequence here
  // instead of Promise.all.
  const decisionsWithMetadata: [Decision, Hiveling][] = [];
  for (const hiveling of shuffledHivelings) {
    decisionsWithMetadata.push(
      await takeDecision(
        randomPrintable(rng, rngState.sequence.length),
        entities,
        hivelingMind,
        hiveling
      )
    );
  }

  return decisionsWithMetadata.reduce(applyDecision, {
    ...state,
    entities,
    rngState: rng.getState()
  });
};

export const makeHivelingMindFromFunction = (
  f: (input: Input) => Decision
): HivelingMind => async (input: Input) => f(input);
