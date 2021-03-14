import { EntityType } from "hivelings/types/common";
import { EntityInsert, SimulationState } from "hivelings/types/simulation";
import { addEntity } from "hivelings/simulation";
import { makeStdLaggedFibo } from "rng/laggedFibo";
import { float, integer } from "rng/utils";
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

  const hivelings: EntityInsert[] = [];
  while (hivelings.length < numberOfHivelings) {
    const midpoint = randomPosition();
    if (
      hivelings.every(
        (e) => distance(e.midpoint, midpoint) >= 2 * hivelingRadius
      )
    ) {
      hivelings.push({
        midpoint,
        radius: hivelingRadius,
        type: HIVELING,
        memory64: "",
        hasFood: integer(rng, 0, 2) === 0,
        orientation: integer(rng, 0, 359)
      });
    }
  }

  const hives: EntityInsert[] = Array.from({ length: numberOfHives }).map(
    (_) => ({
      midpoint: randomPosition(),
      radius: 0.5,
      type: HIVE_ENTRANCE
    })
  );

  const foodItems: EntityInsert[] = Array.from({
    length: numberOfFoodItems
  }).map((_) => ({
    midpoint: randomPosition(),
    radius: 0.5,
    type: FOOD
  }));

  const obstacles: EntityInsert[] = [];
  while (obstacles.length < numberOfObstacles) {
    const midpoint = randomPosition();
    if (
      [...obstacles, ...hivelings].every(
        (e) => distance(e.midpoint, midpoint) >= e.radius + obstacleRadius
      )
    ) {
      obstacles.push({
        midpoint: randomPosition(),
        radius: obstacleRadius,
        type: OBSTACLE,
        style: integer(rng, 0, 10) > 3 ? "treeStump" : "rocks"
      });
    }
  }

  const topAndBottom = crossProduct(range(-16, 16), [-16, 16]) as Position[];
  const sides = crossProduct([-16, 16], range(-16, 17)) as Position[];
  return [
    ...hivelings,
    ...hives,
    ...foodItems,
    ...obstacles,
    ...[...topAndBottom, ...sides].map(
      (position): EntityInsert => ({
        midpoint: position,
        radius: 0.5,
        type: OBSTACLE,
        style: integer(rng, 0, 10) > 7 ? "treeStump" : "rocks"
      })
    )
  ].reduce(addEntity, {
    entities: [],
    nextId: 0,
    score: 0,
    rngState: rng.getState()
  });
};
