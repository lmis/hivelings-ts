import { EntityType } from "hivelings/types/common";
import { EntityInsert, SimulationState } from "hivelings/types/simulation";
import { addEntity } from "hivelings/simulation";
import { makeStdLaggedFibo } from "rng/laggedFibo";
import { crossProduct, Position, range } from "utils";

const { HIVELING, HIVE_ENTRANCE, FOOD, OBSTACLE } = EntityType;

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
    (position, i): EntityInsert => ({
      position,
      type: HIVELING,
      memory64: "",
      hasFood: false,
      orientation: (i * 105) % 360
    })
  ),
  ...startingEntrancePositions.map(
    (position): EntityInsert => ({
      position,
      type: HIVE_ENTRANCE
    })
  ),
  ...startingTopAndBottom.map(
    (position): EntityInsert => ({
      position,
      type: OBSTACLE
    })
  ),
  ...startingSides.map(
    (position): EntityInsert => ({ position, type: OBSTACLE })
  ),
  ...startingNutrition.map(
    (position): EntityInsert => ({
      position,
      type: FOOD
    })
  )
].reduce(addEntity, {
  entities: [],
  nextId: 0,
  score: 0,
  rng: makeStdLaggedFibo("baseScenarioSeed")
});

export const base = { startingState };
