import { EntityType, Rotation } from "hivelings/types/common";
import { EntityDetailsWithPosition, SimulationState } from "hivelings/types/simulation";
import { addEntity } from "hivelings/simulation";
import { makeStdLaggedFibo } from "rng/laggedFibo";
import { crossProduct, Position, range } from "utils";

const { HIVELING, HIVE_ENTRANCE, NUTRITION, OBSTACLE } = EntityType;

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
  -14,
  0,
  14,
  15
]) as Position[];
const startingState: SimulationState = [
  ...startingHivelingPositions.map(
    (position) =>
      ({
        position,
        type: HIVELING,
        memory: "",
        hasNutrition: false,
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
].reduce(addEntity, {
  entities: [],
  nextId: 0,
  score: 0,
  rngState: makeStdLaggedFibo("baseScenarioSeed").getState()
});

export const base = { startingState };
