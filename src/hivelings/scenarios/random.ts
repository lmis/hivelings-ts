import { EntityType } from "hivelings/types/common";
import { SimulationState } from "hivelings/types/simulation";
import { insert } from "hivelings/simulation";
import { makeStdLaggedFibo } from "rng/laggedFibo";
import { float, integer, pickRandom } from "rng/utils";
import { crossProduct, distance, Position, range } from "utils";

const { HIVELING, HIVE_ENTRANCE, FOOD, OBSTACLE } = EntityType;

export const makeRandomScenario = (): SimulationState => {
  const rng = makeStdLaggedFibo("randomScenarioSeed");
  const hivelingRadius = 0.5;
  const obstacleRadius = 0.5;
  const numberOfHivelings = 10;
  const numberOfHives = 2;
  const numberOfFoodItems = 50;
  const numberOfObstacles = 35;
  const randomPosition = (): Position => [
    float(rng, -15, 15),
    float(rng, -15, 15)
  ];
  const randomColor = () =>
    pickRandom(rng, ["255,0,0", "0,0,255", "0,255,255", "255,255,0"]) ??
    "255,0,0";

  const state: SimulationState = {
    score: 0,
    nextId: 0,
    entities: [],
    rngState: rng.getState()
  };
  let hivelingsAdded = 0;
  while (hivelingsAdded < numberOfHivelings) {
    const midpoint = randomPosition();
    if (
      state.entities.every(
        (e) => distance(e.midpoint, midpoint) >= 2 * hivelingRadius
      )
    ) {
      insert(state, {
        midpoint,
        color: randomColor(),
        radius: hivelingRadius,
        type: HIVELING,
        memory: null,
        hasFood: integer(rng, 0, 2) === 0,
        orientation: integer(rng, 0, 359)
      });
      hivelingsAdded++;
    }
  }

  for (let hive = 0; hive < numberOfHives; ++hive) {
    const midpoint = randomPosition();
    const radius = 0.5;
    insert(state, {
      midpoint,
      radius,
      type: HIVE_ENTRANCE
    });
  }

  for (let foodItem = 0; foodItem < numberOfFoodItems; ++foodItem) {
    const midpoint = randomPosition();
    const radius = 0.5;
    insert(state, {
      midpoint,
      radius,
      type: FOOD
    });
  }

  let obstaclesAdded = 0;
  while (obstaclesAdded < numberOfObstacles) {
    const midpoint = randomPosition();
    if (
      state.entities.every(
        (e) => distance(e.midpoint, midpoint) >= e.radius + obstacleRadius
      )
    ) {
      insert(state, {
        midpoint,
        radius: obstacleRadius,
        type: OBSTACLE,
        style: integer(rng, 0, 10) > 3 ? "treeStump" : "rocks"
      });
      obstaclesAdded++;
    }
  }

  const topAndBottom = crossProduct(range(-16, 16), [-16, 16]) as Position[];
  const sides = crossProduct([-16, 16], range(-16, 17)) as Position[];
  [...topAndBottom, ...sides].forEach((midpoint) =>
    insert(state, {
      midpoint,
      radius: obstacleRadius,
      type: OBSTACLE,
      style: integer(rng, 0, 10) > 7 ? "treeStump" : "rocks"
    })
  );
  state.rngState = rng.getState();
  return state;
};
