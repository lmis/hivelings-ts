import { interactionArea, movementArea } from "config";
import {
  Decision,
  DecisionType,
  Input,
  Output,
  EntityType
} from "hivelings/types/common";
import { makeStdLaggedFibo, Rng } from "rng/laggedFibo";
import { int32, pickRandom } from "rng/utils";
import { Box, Position, range, sortBy, takeWhile } from "utils";
import { toDeg, degreeDiff } from "./transformations";
import { Entity } from "./types/player";

const { MOVE, TURN, PICKUP, DROP, WAIT } = DecisionType;
const { HIVELING, HIVE_ENTRANCE, FOOD, OBSTACLE } = EntityType;

interface Memory {
  recentDecisions: Decision[];
  randomWalk: number;
}
const serialize = ({ recentDecisions, randomWalk }: Memory): string => {
  return (
    `R${randomWalk.toFixed(0)};` +
    recentDecisions
      .map((d) => {
        switch (d.type) {
          case TURN:
            return "T" + d.degrees.toFixed(0);
          case MOVE:
            return "M" + d.distance.toFixed(2);
          default:
            return d.type.toString().charAt(0);
        }
      })
      .join(",")
  );
};

const deserialize = (s: string): Memory => {
  if (s === "") {
    return { recentDecisions: [], randomWalk: 0 };
  }
  const parts = s.split(";");
  const randomWalk = parseFloat(parts[0].substr(1, 2));
  const recentDecisions = parts[1].split(",").map(
    (d): Decision => {
      switch (d.charAt(0)) {
        case "T":
          const degrees = parseFloat(d.substring(1, 4));
          return {
            type: TURN,
            degrees
          };
        case "M":
          const distance = parseFloat(d.substring(1, 5));
          return { type: MOVE, distance };
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
  return { recentDecisions, randomWalk };
};

const distance = ([x, y]: Position): number => Math.sqrt(x * x + y * y);

// Which way to turn to face position
const positionToRotation = ([x, y]: Position): number =>
  Math.round(toDeg(Math.atan2(x, y)));

const isInFront = (rotation: number): boolean => {
  return rotation < 10 || rotation > 350;
};

// Estimate for number of turns to reach.
const walkingCost = ([x, y]: Position) => {
  if (x === 0 && y === 0) {
    // Walk off and turn backwards
    return 2;
  }
  const initialRotationCost = positionToRotation([x, y]) <= 0.01 ? 0 : 1;
  const movementCost = Math.round(distance([x, y]) + 0.5);

  return initialRotationCost + movementCost;
};

const goTowards = (position: Position): Decision => {
  const degrees = positionToRotation(position);
  return degrees < 10 || degrees > 350
    ? {
        type: MOVE,
        distance: Math.min(1, distance(position) - 0.5)
      }
    : { type: TURN, degrees };
};

const blocks = (entityType: EntityType | undefined | null) =>
  entityType && [HIVELING, OBSTACLE].includes(entityType);

const inArea = ([x, y]: Position, { left, right, top, bottom }: Box) =>
  x > left && x < right && y > bottom && y < top;

const doRandomWalk = (
  rng: Rng,
  blockedFront: boolean,
  recentDecisions: Decision[],
  entitiesInMovementArea: Entity[]
): Decision => {
  // No target found. Random walk.
  const moveStreak = takeWhile((d) => d.type === MOVE, recentDecisions).length;
  if (!blockedFront && moveStreak <= 2) {
    return { type: MOVE, distance: 1 };
  }
  // Random rotation
  const blockedRotations = entitiesInMovementArea
    .filter((e) => blocks(e.type) && distance(e.position) <= 1)
    .map((e) => positionToRotation(e.position));
  const nonBlockedRotations = range(0, 360).filter((r) =>
    blockedRotations.every((b) => Math.abs(degreeDiff(r, b)) > 10)
  );
  // Front bias
  if (int32(rng, 0, 100) > 25) {
    const nonBlockedFrontRotation = pickRandom(
      rng,
      nonBlockedRotations.filter((r) => degreeDiff(r, 0) <= 90)
    );
    if (nonBlockedFrontRotation) {
      return { type: TURN, degrees: nonBlockedFrontRotation };
    }
  }
  const nonBlockedRotation = pickRandom(rng, nonBlockedRotations);
  if (nonBlockedRotation) {
    return { type: TURN, degrees: nonBlockedRotation };
  }
  return { type: WAIT };
};

const search = (
  soughtType: EntityType,
  visibleEntities: Entity[],
  entitiesInMovementArea: Entity[],
  blockedFront: boolean,
  recentDecisions: Decision[],
  rng: Rng
): Decision => {
  // Find reachable target.
  const reachableTarget = pickRandom(
    rng,
    visibleEntities.filter((e) => {
      if (e?.type !== soughtType) {
        return false;
      }
      const dist = distance(e.position);
      // Either right under hiveling or too far off.
      if (dist < 0.5 || dist > 2) {
        return false;
      }
      // Reachable by turning.
      if (dist <= 1) {
        return true;
      }
      // Reachable by moving
      return !blockedFront && isInFront(positionToRotation(e.position));
    })
  );
  if (reachableTarget) {
    return goTowards(reachableTarget.position);
  }

  // Find closest target.
  const closestTarget = sortBy(
    (e) => walkingCost(e.position),
    visibleEntities.filter(
      (e) =>
        e.type === soughtType &&
        !(blockedFront && isInFront(positionToRotation(e.position)))
    )
  )[0];
  if (closestTarget) {
    return goTowards(closestTarget.position);
  }

  // No target found. Random walk.
  return doRandomWalk(
    rng,
    blockedFront,
    recentDecisions,
    entitiesInMovementArea
  );
};

export const hivelingMind = (input: Input): Output => {
  const { visibleEntities, currentHiveling, randomSeed } = input;
  const { memory64, hasFood } = currentHiveling;
  const rng = makeStdLaggedFibo(randomSeed);

  const { recentDecisions, randomWalk } = deserialize(memory64);
  const takeDecision = (decision: Decision, newRandomWalk: number): Output => ({
    decision,
    memory64: serialize({
      recentDecisions: [decision, ...recentDecisions.slice(0, 5)],
      randomWalk: newRandomWalk
    })
  });

  const entitiesInInteractionArea = visibleEntities.filter((e) => {
    return inArea(e.position, interactionArea);
  });

  // Desired thing in front, interact.
  if (
    hasFood &&
    entitiesInInteractionArea.some((e) => e.type === HIVE_ENTRANCE)
  ) {
    return takeDecision({ type: DROP }, 0);
  }
  if (!hasFood && entitiesInInteractionArea.some((e) => e.type === FOOD)) {
    return takeDecision({ type: PICKUP }, 0);
  }

  const shouldResolveDeadlock =
    recentDecisions.filter((d) => [TURN, WAIT].includes(d.type)).length > 5;
  const entitiesInMovementArea = visibleEntities.filter((e) =>
    inArea(e.position, movementArea)
  );
  const blockedFront = entitiesInMovementArea.some((e) => blocks(e.type));

  if (randomWalk > 0 || shouldResolveDeadlock) {
    return takeDecision(
      doRandomWalk(rng, blockedFront, recentDecisions, entitiesInMovementArea),
      shouldResolveDeadlock ? 3 : randomWalk - 1
    );
  }

  // Go search
  return takeDecision(
    search(
      hasFood ? HIVE_ENTRANCE : FOOD,
      visibleEntities,
      entitiesInMovementArea,
      blockedFront,
      recentDecisions,
      rng
    ),
    0
  );
};
