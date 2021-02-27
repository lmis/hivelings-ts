import {
  Decision,
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
  recentDecisions: Decision[];
}
const serialize = ({ recentDecisions }: Memory): string => {
  return recentDecisions
    .map((d) => {
      switch (d.type) {
        case TURN:
          return "T" + d.rotation.toString().substring(0, 2);
        default:
          return d.type.toString().charAt(0);
      }
    })
    .join(",");
};

const deserialize = (s: string): Memory => {
  if (s === "") {
    return { recentDecisions: [] };
  }

  const recentDecisions = s.split(",").map(
    (d): Decision => {
      switch (d.charAt(0)) {
        case "T":
          const rotation = [NONE, BACK, COUNTERCLOCKWISE, CLOCKWISE].find(
            (r) => r.substring(0, 2) === d.substring(1, 3)
          );

          if (!rotation) {
            throw new Error("Unable to parse decision: " + d);
          }
          return {
            type: TURN,
            rotation
          };
        case "M":
          return { type: MOVE };
        case "P":
          return { type: PICKUP };
        case "D":
          return { type: DROP };
        case "W":
          return { type: WAIT };
        default:
          throw new Error("Unable to parse decision: " + d);
      }
    }
  );
  return { recentDecisions };
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
  const { memory64, hasNutrition } = currentHiveling;
  const { recentDecisions } = deserialize(memory64);
  const rng = makeStdLaggedFibo(randomSeed);

  const takeDecision = (decision: Decision): Output => ({
    decision,
    memory64: serialize({
      recentDecisions: [decision, ...recentDecisions.slice(0, 5)]
    })
  });

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
    return takeDecision({ type: DROP });
  }
  if (!hasNutrition && frontEntityType === NUTRITION) {
    return takeDecision({ type: PICKUP });
  }

  const soughtType = hasNutrition ? HIVE_ENTRANCE : NUTRITION;
  const rotation = pickRandom(
    rng,
    reachableEntities
      .filter((e) => e.type === soughtType)
      .map((e) => positionToRotation(e.position))
  );
  if (rotation === NONE) {
    return takeDecision({ type: MOVE });
  }
  if (rotation) {
    return takeDecision({ type: TURN, rotation });
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
    return takeDecision({ type: MOVE });
  }
  if (r2) {
    return takeDecision({ type: TURN, rotation: r2 });
  }
  if (!blockedFront && recentDecisions.findIndex((d) => d.type !== MOVE) <= 3) {
    return takeDecision({ type: MOVE });
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
    return takeDecision({ type: MOVE });
  }
  if (unblockedRotation) {
    return takeDecision({ type: TURN, rotation: unblockedRotation });
  }
  return takeDecision({ type: WAIT });
};
