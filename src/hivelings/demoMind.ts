import {
  Decision,
  DecisionType,
  Output,
  EntityType
} from "hivelings/types/common";
import { makeStdLaggedFibo, Rng } from "rng/laggedFibo";
import { integer, pickRandom } from "rng/utils";
import { maxBy, Position, range, takeWhile } from "utils";
import { toDeg } from "./transformations";
import { Entity, Input } from "./types/player";

const { MOVE, TURN, PICKUP, DROP } = DecisionType;
const { HIVE_ENTRANCE, FOOD } = EntityType;

interface Memory {
  recentDecisions: Decision[];
}

const prettyPrint = ({ recentDecisions }: Memory): string =>
  recentDecisions
    .map((d) => {
      switch (d.type) {
        case TURN:
          return "T" + d.degrees.toFixed(0);
        case MOVE:
          return "M" + (d.distance === 1 ? "" : d.distance.toFixed(2));
        default:
          return d.type.toString().charAt(0);
      }
    })
    .join("-");

const distance = ([x, y]: Position): number => Math.sqrt(x * x + y * y);

// Which way to turn to face position
const positionToRotation = ([x, y]: Position): number =>
  Math.round(toDeg(Math.atan2(x, y)));

// Estimate for number of turns to reach.
const walkingCost = ([x, y]: Position) => {
  if (x === 0 && y === 0) {
    // Walk off and turn backwards
    return 2;
  }
  const rotation = positionToRotation([x, y]);
  const initialRotationCost = rotation < 15 || rotation > 355 ? 0 : 1;
  const movementCost = Math.round(distance([x, y]) + 0.5);

  return initialRotationCost + movementCost;
};

const goTowards = (position: Position, maxMoveDistance: number): Decision => {
  const degrees = positionToRotation(position);
  return degrees < 15 || degrees > 355
    ? {
        type: MOVE,
        distance: maxMoveDistance
      }
    : { type: TURN, degrees };
};

const search = (
  soughtType: EntityType,
  visibleEntities: Entity[],
  maxMoveDistance: number,
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
      const dist = distance(e.midpoint);
      const rotation = positionToRotation(e.midpoint);
      // Reachable by moving
      if (dist < maxMoveDistance && (rotation < 75 || rotation > 295)) {
        return true;
      }
      // Reachable by turning.
      if (dist <= 1) {
        return true;
      }
      return false;
    })
  );
  if (reachableTarget) {
    return goTowards(reachableTarget.midpoint, maxMoveDistance);
  }

  // Find closest target.
  const blockedInFront = maxMoveDistance < 0.2;
  const closestTarget = maxBy(
    (e) => -walkingCost(e.midpoint),
    visibleEntities.filter((e) => {
      if (e.type !== soughtType) {
        return false;
      }
      if (!blockedInFront) {
        return true;
      }
      const rotation = positionToRotation(e.midpoint);
      return rotation < 270 && rotation > 90;
    })
  );
  if (closestTarget) {
    return goTowards(closestTarget.midpoint, maxMoveDistance);
  }

  // No target found. Random walk.
  // Minimal distance to walk before turning
  const minMoveDistance = 0.01;

  // No target found. Random walk.
  const moveStreak = takeWhile((d) => d.type === MOVE, recentDecisions).length;
  if (maxMoveDistance > minMoveDistance && moveStreak <= 2) {
    return { type: MOVE, distance: maxMoveDistance };
  }
  // Random rotation
  const availableRotations =
    maxMoveDistance > minMoveDistance
      ? // Front bias
        integer(rng, 1, 100) > 25
        ? [...range(270, 360), ...range(1, 90)]
        : range(1, 360)
      : range(90, 270);
  return { type: TURN, degrees: pickRandom(rng, availableRotations) ?? 180 };
};

export const hivelingMind = (input: Input<Memory>): Output<Memory> => {
  const {
    maxMoveDistance,
    visibleEntities,
    interactableEntities,
    hasFood,
    randomSeed
  } = input;
  const rng = makeStdLaggedFibo(randomSeed);

  const recentDecisions = input.memory?.recentDecisions ?? [];
  const takeDecision = (decision: Decision): Output<Memory> => {
    const memory = {
      recentDecisions: [decision, ...recentDecisions.slice(0, 5)]
    };
    return {
      decision,
      memory,
      show: prettyPrint(memory)
    };
  };

  // Desired thing in front, interact.
  if (hasFood && interactableEntities.some((e) => e.type === HIVE_ENTRANCE)) {
    return takeDecision({ type: DROP });
  }
  if (!hasFood && interactableEntities.some((e) => e.type === FOOD)) {
    return takeDecision({ type: PICKUP });
  }

  // Go search
  return takeDecision(
    search(
      hasFood ? HIVE_ENTRANCE : FOOD,
      visibleEntities,
      maxMoveDistance,
      recentDecisions,
      rng
    )
  );
};
