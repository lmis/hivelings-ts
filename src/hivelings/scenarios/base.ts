import { EntityType } from "hivelings/types/common";
import { SimulationState } from "hivelings/types/simulation";
import { nextZIndex } from "hivelings/simulation";
import { makeStdLaggedFibo } from "rng/laggedFibo";
import { crossProduct, Position, range } from "utils";
import { integer } from "rng/utils";

const { HIVELING, HIVE_ENTRANCE, FOOD, OBSTACLE } = EntityType;

export const makeBaseScenario = (): SimulationState => {
  const rng = makeStdLaggedFibo("baseScenarioSeed");
  const hivelingSpec: [string, Position, number][] = [
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

  const state: SimulationState = {
    entities: [],
    nextId: 0,
    score: 100,
    rngState: rng.getState()
  };
  hivelingSpec.forEach(([color, midpoint, orientation], i) =>
    state.entities.push({
      identifier: state.nextId++,
      color,
      midpoint,
      radius: 0.5,
      type: HIVELING,
      memory: null,
      hasFood: false,
      orientation,
      zIndex: nextZIndex(state.entities, midpoint, 0.5)
    })
  );
  hivePositions.forEach((midpoint) =>
    state.entities.push({
      identifier: state.nextId++,
      midpoint,
      radius: 0.5,
      type: HIVE_ENTRANCE,
      zIndex: nextZIndex(state.entities, midpoint, 0.5)
    })
  );
  [...topAndBottom, ...sides].forEach((midpoint) =>
    state.entities.push({
      identifier: state.nextId++,
      midpoint,
      radius: 0.5,
      type: OBSTACLE,
      style: integer(rng, 0, 10) > 7 ? "treeStump" : "rocks",
      zIndex: nextZIndex(state.entities, midpoint, 0.5)
    })
  );
  foodPositions.forEach((midpoint) =>
    state.entities.push({
      identifier: state.nextId++,
      midpoint,
      radius: 0.5,
      type: FOOD,
      zIndex: nextZIndex(state.entities, midpoint, 0.5)
    })
  );
  return state;
};
