import {
  Decision,
  DecisionType,
  Input,
  Output,
  Rotation,
  EntityType
} from "hivelings/types/common";
import { makeStdLaggedFibo, Rng } from "rng/laggedFibo";
import { pickRandom } from "rng/utils";
import { Position, sortBy, takeWhile } from "utils";
import { Entity } from "./types/player";

const { MOVE, TURN, PICKUP, DROP, WAIT } = DecisionType;
const { HIVELING, HIVE_ENTRANCE, NUTRITION, OBSTACLE } = EntityType;
const { NONE, BACK, COUNTERCLOCKWISE, CLOCKWISE } = Rotation;
const front: Position = [0, 1];
const back: Position = [0, -1];
const left: Position = [-1, 0];
const right: Position = [1, 0];

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

const key = ([x, y]: Position): string => x + "," + y;

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

// Estimate for number of turns to reach.
const walkingCost = ([x, y]: Position) => {
  if (x === 0 && y === 0) {
    // Walk off and turn backwards
    return 2;
  }
  const initialRotationCost = positionToRotation([x, y]) === NONE ? 0 : 1;
  const movementCost = Math.abs(x) + Math.abs(y);
  const minimalTurningCosts = x === 0 || y === 0 ? 0 : 1;
  // Heuristic accounting for costly movement along diagonals.
  const heuristicTurningCosts = minimalTurningCosts * (movementCost * 0.5);

  return (
    initialRotationCost +
    movementCost +
    minimalTurningCosts +
    heuristicTurningCosts
  );
};

const goTowards = (position: Position): Decision => {
  const rotation = positionToRotation(position);
  return rotation === NONE ? { type: MOVE } : { type: TURN, rotation };
};

const blocks = (entityType: EntityType | undefined | null) =>
  entityType && [HIVELING, OBSTACLE].includes(entityType);

const search = (
  soughtType: EntityType,
  visibleEntitiesByPosition: Map<string, Entity>,
  recentDecisions: Decision[],
  rng: Rng
): Decision => {
  const blockedFront = blocks(visibleEntitiesByPosition.get(key(front))?.type);

  // Find reachable target.
  const reachablePositions: Position[] = blockedFront
    ? [back, left, right]
    : [[0, 2], back, left, right];
  const reachableTarget = pickRandom(
    rng,
    reachablePositions
      .map((p) => visibleEntitiesByPosition.get(key(p)))
      .filter((e) => e?.type === soughtType)
  );
  if (reachableTarget) {
    return goTowards(reachableTarget.position);
  }

  // Find closest target.
  const closestTarget = sortBy(
    (e) => walkingCost(e.position),
    [...visibleEntitiesByPosition.values()].filter(
      (e) =>
        e.type === soughtType &&
        (!blockedFront || positionToRotation(e.position) !== NONE)
    )
  )[0];
  if (closestTarget) {
    return goTowards(closestTarget.position);
  }

  // No target found. Random walk.
  const moveStreak = takeWhile((d) => d.type === MOVE, recentDecisions).length;
  if (!blockedFront && moveStreak <= 3) {
    return { type: MOVE };
  }
  const unblockedPosition = pickRandom(
    rng,
    [left, right, front].filter(
      (p) => !blocks(visibleEntitiesByPosition.get(key(p))?.type)
    )
  );
  if (unblockedPosition) {
    return goTowards(unblockedPosition);
  }

  const blockedBack = blocks(visibleEntitiesByPosition.get(key(back))?.type);
  return blockedBack ? { type: WAIT } : { type: TURN, rotation: BACK };
};

export const hivelingMind = (input: Input): Output => {
  const { visibleEntities, currentHiveling, randomSeed } = input;
  const { memory64, hasNutrition } = currentHiveling;
  const rng = makeStdLaggedFibo(randomSeed);
  const visibleEntitiesByPosition = new Map<string, Entity>();
  visibleEntities.forEach((e) => {
    visibleEntitiesByPosition.set(key(e.position), e);
  });

  const { recentDecisions } = deserialize(memory64);
  const takeDecision = (decision: Decision): Output => ({
    decision,
    memory64: serialize({
      recentDecisions: [decision, ...recentDecisions.slice(0, 5)]
    })
  });

  const frontEntityType = visibleEntitiesByPosition.get(key(front))?.type;

  // Desired thing in front, interact.
  if (hasNutrition && frontEntityType === HIVE_ENTRANCE) {
    return takeDecision({ type: DROP });
  }
  if (!hasNutrition && frontEntityType === NUTRITION) {
    return takeDecision({ type: PICKUP });
  }

  // Go search
  return takeDecision(
    search(
      hasNutrition ? HIVE_ENTRANCE : NUTRITION,
      visibleEntitiesByPosition,
      recentDecisions,
      rng
    )
  );
};
