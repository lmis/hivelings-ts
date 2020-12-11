import {
  HivelingMind,
  Decision,
  Input,
  EntityType,
  Rotation
} from "hivelings/types/common";
import {
  GameState,
  Entity,
  isHiveling,
  Hiveling,
  EntityDetailsWithPosition
} from "hivelings/types/simulation";
import { entityForPlayer } from "hivelings/transformations";
import { addEntity, applyDecision, sees } from "hivelings/simulation";
import { fromSeed, load, shuffle } from "rng/utils";
import { GameIteration } from "game/useGameLoop";
import filter from "lodash/fp/filter";
import { range } from "lodash";
import { crossProduct, Position } from "utils";

const { HIVELING, HIVE_ENTRANCE, NUTRITION, OBSTACLE } = EntityType;

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

export const emptyState: GameState = {
  entities: [],
  nextId: 0,
  score: 0,
  rngState: fromSeed("emptyState").state()
};

const startingHivelingPositions = [
  [1, 4],
  [-3, 12],
  [0, -6],
  [2, 2]
] as Position[];

const startingEntrancePositions = crossProduct([-5, 5], [-5, 5]) as Position[];
const startingTopAndBottom = crossProduct(range(-9, 10), [
  -16,
  16
]) as Position[];
const startingSides = crossProduct([-10, 10], range(-16, 17)) as Position[];
const startingNutrition = crossProduct(range(-5, 6), [
  -15,
  14,
  0,
  14,
  15
]) as Position[];
export const startingState = [
  ...startingHivelingPositions.map(
    (position) =>
      ({
        position,
        type: HIVELING,
        memory: "",
        hasNutrition: false,
        spreadsPheromones: false,
        recentDecisions: [],
        orientation: Rotation.NONE
      } as EntityDetailsWithPosition)
  ),
  ...startingEntrancePositions.map(
    (position) =>
      ({
        position,
        type: HIVE_ENTRANCE
      } as EntityDetailsWithPosition)
  ),
  ...startingTopAndBottom.map(
    (position) =>
      ({
        position,
        type: OBSTACLE
      } as EntityDetailsWithPosition)
  ),
  ...startingSides.map(
    (position) => ({ position, type: OBSTACLE } as EntityDetailsWithPosition)
  ),
  ...startingNutrition.map(
    (position) =>
      ({
        position,
        type: NUTRITION
      } as EntityDetailsWithPosition)
  )
].reduce(addEntity, emptyState);

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
        await takeDecision(rng.int32(), entities, hivelingMind, hiveling)
      );
    }

    return decisionsWithMetadata.reduce(applyDecision, {
      ...state,
      entities,
      rngState: rng.state()
    });
  };
};

export const makeHivelingMindFromFunction = (
  f: (input: Input) => Decision
): HivelingMind => async (input: Input) => f(input);
