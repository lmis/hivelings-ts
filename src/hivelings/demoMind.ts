import {
  DecisionType,
  Input,
  Output,
  Rotation,
  EntityType
} from "hivelings/types/common";
import { makeStdLaggedFibo } from "rng/laggedFibo";
import { pickRandom } from "rng/utils";
import { Position, positionEquals, sortBy } from "utils";

const { MOVE, TURN, PICKUP, DROP, WAIT } = DecisionType;
const { HIVELING, HIVE_ENTRANCE, NUTRITION, OBSTACLE } = EntityType;
const { NONE, BACK, COUNTERCLOCKWISE, CLOCKWISE } = Rotation;

interface Memory {
  blockedFront: number;
  deadlockResolution: number;
}
const serialize = ({ blockedFront, deadlockResolution }: Memory): string =>
  btoa(blockedFront + "," + deadlockResolution);

const deserialize = (s: string): Memory => {
  if (s === "") {
    return { blockedFront: 0, deadlockResolution: 0 };
  }

  const [blockedFront, deadlockResolution] = atob(s)
    .split(",")
    .map((n) => +n);
  return { blockedFront, deadlockResolution };
};

// Which way to turn to face position
const positionToRotation = ([x, y]: Position): Rotation => {
  if (y >= Math.abs(x)) {
    return NONE;
  } else if (-y >= Math.abs(x)) {
    return BACK;
  } else if (x < 0) {
    return COUNTERCLOCKWISE;
  } else {
    return CLOCKWISE;
  }
};
const front: Position = [0, 1];
const back: Position = [0, -1];
const left: Position = [-1, 0];
const right: Position = [1, 0];

export const hivelingMind = (input: Input): Output => {
  const { visibleEntities, currentHiveling, randomSeed } = input;
  const { memory64, recentDecisions, hasNutrition } = currentHiveling;
  const rng = makeStdLaggedFibo(randomSeed);

  const frontEntityType = visibleEntities.find((e) =>
    positionEquals(e.position, front)
  )?.type;
  const blockedFront =
    frontEntityType && [HIVELING, OBSTACLE].includes(frontEntityType);
  const reachableEntities = visibleEntities.filter((e) => {
    if (!blockedFront && positionEquals(e.position, [0, 2])) {
      return true;
    }
    return [back, left, right].some((p) => positionEquals(e.position, p));
  });
  if (hasNutrition && frontEntityType === HIVE_ENTRANCE) {
    return { decision: { type: DROP }, memory64 };
  }
  if (!hasNutrition && frontEntityType === NUTRITION) {
    return { decision: { type: PICKUP }, memory64 };
  }

  const soughtType = hasNutrition ? HIVE_ENTRANCE : NUTRITION;
  const rotation = pickRandom(
    rng,
    reachableEntities
      .filter((e) => e.type === soughtType)
      .map((e) => positionToRotation(e.position))
  );
  if (rotation === NONE) {
    return { decision: { type: MOVE }, memory64 };
  }
  if (rotation) {
    return { decision: { type: TURN, rotation }, memory64 };
  }
  const r2 = sortBy(
    (e) =>
      (positionToRotation(e.position) === NONE ? 0 : 1) +
      Math.abs(e.position[0]) +
      Math.abs(e.position[1]),
    visibleEntities.filter(
      (e) =>
        e.type === soughtType &&
        (!blockedFront || positionToRotation(e.position) !== NONE)
    )
  ).map((e) => positionToRotation(e.position))[0];
  if (r2 === NONE) {
    return { decision: { type: MOVE }, memory64 };
  }
  if (r2) {
    return { decision: { type: TURN, rotation: r2 }, memory64 };
  }
  if (recentDecisions[0]?.type !== MOVE && !blockedFront) {
    return { decision: { type: MOVE }, memory64 };
  }
  const unblockedRotation = pickRandom(
    rng,
    [left, right, front, back]
      .filter(
        (p) =>
          !visibleEntities.some(
            (e) =>
              positionEquals(e.position, p) &&
              [HIVELING, OBSTACLE].includes(e.type)
          )
      )
      .map(positionToRotation)
  );
  if (unblockedRotation === NONE) {
    return { decision: { type: MOVE }, memory64 };
  }
  if (unblockedRotation) {
    return {
      decision: { type: TURN, rotation: unblockedRotation },
      memory64
    };
  }
  return { decision: { type: WAIT }, memory64 };
};
