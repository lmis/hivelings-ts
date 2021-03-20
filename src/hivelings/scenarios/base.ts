import { EntityType } from "hivelings/types/common";
import { EntityInsert, SimulationState } from "hivelings/types/simulation";
import { addEntity } from "hivelings/simulation";
import { makeStdLaggedFibo } from "rng/laggedFibo";
import { crossProduct, Position, range } from "utils";
import { integer } from "rng/utils";

const { HIVELING, HIVE_ENTRANCE, FOOD, OBSTACLE } = EntityType;

export const makeBaseScenario = (): SimulationState => {
  const rng = makeStdLaggedFibo("baseScenarioSeed");
  const hivelinPositions: [string, Position, number][] = [
    ["255,0,0", [1, 4], 260],
    ["0,255,0", [-3, 12], 35],
    ["0,0,255", [0, -6], 70],
    ["255,255,0", [2, 2], 0],
    ["255,0,255", [6, 0], 0]
  ];
  const foodPositions: Position[] = crossProduct(range(-5, 6), [
    -15,
    -14,
    0,
    14,
    15
  ]);

  const hivePositions: Position[] = crossProduct([-5, 5], [-5, 5]);
  const topAndBottom: Position[] = crossProduct(range(-9, 10), [-16, 16]);
  const sides: Position[] = crossProduct([-10, 10], range(-16, 17));

  return [
    ...hivelinPositions.map(
      ([color, midpoint, orientation], i): EntityInsert => ({
        color,
        midpoint,
        radius: 0.5,
        type: HIVELING,
        memory: null,
        hasFood: false,
        orientation
      })
    ),
    ...hivePositions.map(
      (midpoint): EntityInsert => ({
        midpoint,
        radius: 0.5,
        type: HIVE_ENTRANCE
      })
    ),
    ...[...topAndBottom, ...sides].map(
      (midpoint): EntityInsert => ({
        midpoint,
        radius: 0.5,
        type: OBSTACLE,
        style: integer(rng, 0, 10) > 7 ? "treeStump" : "rocks"
      })
    ),
    ...[...foodPositions].map(
      (midpoint): EntityInsert => ({
        midpoint,
        radius: 0.5,
        type: FOOD
      })
    )
  ].reduce(addEntity, {
    entities: [],
    nextId: 0,
    score: 0,
    rngState: rng.getState()
  });
};
