import { interactionArea, movementArea } from "config";
import {
  Decision,
  DecisionType,
  Input,
  Output,
  EntityType
} from "hivelings/types/common";
import { makeStdLaggedFibo, Rng } from "rng/laggedFibo";
import { pickRandom } from "rng/utils";
import { Box, Position, range, sortBy, takeWhile } from "utils";
import { toDeg } from "./transformations";
import { Entity } from "./types/player";

const { MOVE, TURN, PICKUP, DROP, WAIT } = DecisionType;
const { HIVELING, HIVE_ENTRANCE, NUTRITION, OBSTACLE } = EntityType;

interface Memory {
  recentDecisions: Decision[];
}
const serialize = ({ recentDecisions }: Memory): string => {
  return recentDecisions
    .map((d) => {
      switch (d.type) {
        case TURN:
          return "T" + d.degrees.toString().substring(0, 4);
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
          const degrees = parseFloat(d.substring(1, 5));
          return {
            type: TURN,
            degrees
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

const distance = ([x, y]: Position): number => Math.sqrt(x * x + y * y);
const degreeDiff = (a: number, b: number) => {
  const d1 = a - b;
  if (d1 > 180) {
    return 360 - d1;
  } else if (d1 < -180) {
    return d1 + 360;
  } else {
    return d1;
  }
};

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
    ? { type: MOVE }
    : { type: TURN, degrees };
};

const blocks = (entityType: EntityType | undefined | null) =>
  entityType && [HIVELING, OBSTACLE].includes(entityType);

const inArea = ([x, y]: Position, { left, right, top, bottom }: Box) =>
  x > left && x < right && y > bottom && y < top;

const search = (
  soughtType: EntityType,
  visibleEntities: Entity[],
  recentDecisions: Decision[],
  rng: Rng
): Decision => {
  const entitiesInMovementArea = visibleEntities.filter((e) =>
    inArea(e.position, movementArea)
  );
  const blockedFront = entitiesInMovementArea.some((e) => blocks(e.type));

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
  const moveStreak = takeWhile((d) => d.type === MOVE, recentDecisions).length;
  if (!blockedFront && moveStreak <= 3) {
    return { type: MOVE };
  }
  // Random rotation
  const blockedRotations = entitiesInMovementArea
    .filter((e) => blocks(e.type) && distance(e.position) <= 1)
    .map((e) => positionToRotation(e.position));
  const nonBlockedRotation = pickRandom(
    rng,
    range(0, 360).filter((r) =>
      blockedRotations.every((b) => Math.abs(degreeDiff(r, b)) > 10)
    )
  );
  if (nonBlockedRotation) {
    return { type: TURN, degrees: nonBlockedRotation };
  }
  return { type: WAIT };
};

export const hivelingMind = (input: Input): Output => {
  const { visibleEntities, currentHiveling, randomSeed } = input;
  const { memory64, hasNutrition } = currentHiveling;
  const rng = makeStdLaggedFibo(randomSeed);

  const { recentDecisions } = deserialize(memory64);
  const takeDecision = (decision: Decision): Output => ({
    decision,
    memory64: serialize({
      recentDecisions: [decision, ...recentDecisions.slice(0, 5)]
    })
  });

  const entitiesInInteractionArea = visibleEntities.filter((e) => {
    return inArea(e.position, interactionArea);
  });

  // Desired thing in front, interact.
  if (
    hasNutrition &&
    entitiesInInteractionArea.some((e) => e.type === HIVE_ENTRANCE)
  ) {
    return takeDecision({ type: DROP });
  }
  if (
    !hasNutrition &&
    entitiesInInteractionArea.some((e) => e.type === NUTRITION)
  ) {
    return takeDecision({ type: PICKUP });
  }

  // Go search
  return takeDecision(
    search(
      hasNutrition ? HIVE_ENTRANCE : NUTRITION,
      visibleEntities,
      recentDecisions,
      rng
    )
  );
};
