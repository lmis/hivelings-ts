import { HivelingMind, Decision, Input } from "hivelings/types/common";
import {
  GameState,
  Entity,
  isHiveling,
  Hiveling
} from "hivelings/types/simulation";
import { entityForPlayer } from "hivelings/transformations";
import { applyDecision, sees } from "hivelings/simulation";
import { load, shuffle } from "rng/utils";
import { GameIteration } from "game/useGameLoop";
import filter from "lodash/fp/filter";

const takeDecision = async (
  randomSeed: number,
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

export const makeGameIteration = (
  hivelingMind: HivelingMind
): GameIteration<GameState> => {
  console.log("makeGameIteration");
  return async ({ rngState, entities, ...state }: GameState) => {
    const rng = load(rngState);
    const shuffledHivelings = shuffle(rng, filter(isHiveling)(entities));

    // The player code need not be able to run in parallel, so we sequence here
    // instead of Promise.all.
    const decisionsWithMetadata: [Decision, Hiveling][] = [];
    for (const hiveling of shuffledHivelings) {
      decisionsWithMetadata.push(
        await takeDecision(rng.getNext(), entities, hivelingMind, hiveling)
      );
    }

    return decisionsWithMetadata.reduce(applyDecision, {
      ...state,
      entities,
      rngState: rng.getState()
    });
  };
};

export const makeHivelingMindFromFunction = (
  f: (input: Input) => Decision
): HivelingMind => async (input: Input) => f(input);
