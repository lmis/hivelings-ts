import {
  Decision,
  DecisionType,
  Input,
  Rotation,
  EntityType
} from "hivelings/types/common";
import { Entity, Hiveling } from "hivelings/types/player";
import { makeStdLaggedFibo, Rng } from "rng/laggedFibo";
import { pickRandom } from "rng/utils";
import { Position, positionEquals } from "utils";

const {
  MOVE,
  TURN,
  PICKUP,
  DROP,
  WAIT,
  REMEMBER_128_CHARACTERS
} = DecisionType;
const { HIVELING, HIVE_ENTRANCE, NUTRITION, OBSTACLE } = EntityType;
const { NONE, BACK, COUNTERCLOCKWISE, CLOCKWISE } = Rotation;

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
const origin: Position = [0, 0];
const front: Position = [0, 1];
const back: Position = [0, -1];
const left: Position = [-1, 0];
const right: Position = [1, 0];
const BLOCKED_FRONT = "BLOCKED_FRONT";
const RESOLVE_DEADLOCK = "RESOLVE_DEADLOCK";

const goTowards = (
  position: Position | undefined,
  blockedPositions: Position[],
  currentHiveling: Hiveling
): Decision => {
  if (!position) {
    // No position. No movement.
    return { type: WAIT };
  }
  const rotation = positionToRotation(position);
  if (rotation === NONE) {
    if (blockedPositions.some((p) => positionEquals(p, front))) {
      const numberOfBlocked = +(
        /^BLOCKED_FRONT(\d+)/.exec(currentHiveling.memory)?.[1] ?? 0
      );
      // Count up blocked turns
      if (numberOfBlocked < 4) {
        return {
          type: REMEMBER_128_CHARACTERS,
          message: BLOCKED_FRONT + (numberOfBlocked + 1)
        };
      }
      return {
        type: REMEMBER_128_CHARACTERS,
        message: RESOLVE_DEADLOCK + 4
      };
    }
    // No need to turn. Move.
    return { type: MOVE };
  }

  return { type: TURN, rotation };
};

const search = (
  condition: (e: Entity) => boolean,
  decision: Decision,
  closeEntities: Entity[],
  currentHiveling: Hiveling,
  rng: Rng
): Decision => {
  const surroundingPoitions = [front, back, left, right];
  const targets = closeEntities.filter(condition).map((e) => e.position);
  const targetsAround = targets.filter((p) =>
    surroundingPoitions.some((s) => positionEquals(p, s))
  );
  const targetsUnderneath = targets.filter((p) => positionEquals(p, origin));
  const blockedPositions = closeEntities
    .filter((e) => [HIVELING, OBSTACLE].includes(e.type))
    .map((e) => e.position);
  const nonBlockedSurroundingPositions = surroundingPoitions.filter(
    (p: Position) => !blockedPositions.some((bp) => positionEquals(bp, p))
  );

  if (targetsAround.length) {
    if (targetsAround.some((p) => positionEquals(p, front))) {
      // Target right in front. Interact!
      return decision;
    }
    return goTowards(targetsAround[0], blockedPositions, currentHiveling);
  } else if (targetsUnderneath.length) {
    return goTowards(
      nonBlockedSurroundingPositions[0],
      blockedPositions,
      currentHiveling
    );
  } else if (targets.length) {
    // Prefer a target in front. Fall back to any other instead.
    const position =
      targets.find((p) => positionEquals(p, front)) ?? targets[0];
    return goTowards(position, blockedPositions, currentHiveling);
  } else {
    // No targets. Continue searching.
    if (
      !blockedPositions.includes(front) &&
      currentHiveling.recentDecisions[0]?.type === TURN
    ) {
      // Just turned. Move forward.
      return { type: MOVE };
    }

    if (nonBlockedSurroundingPositions.length === 0) {
      return { type: WAIT };
    }

    return goTowards(
      pickRandom(rng, nonBlockedSurroundingPositions),
      blockedPositions,
      currentHiveling
    );
  }
};

export const hivelingMind = (input: Input): Decision => {
  const { closeEntities, currentHiveling, randomSeed } = input;
  const rng = makeStdLaggedFibo(randomSeed);
  const deadlockResolutionCount = /^RESOLVE_DEADLOCK(\d+)/.exec(
    currentHiveling.memory
  )?.[1];
  if (deadlockResolutionCount) {
    const previousDecision = currentHiveling.recentDecisions[0]?.type;
    if (previousDecision === REMEMBER_128_CHARACTERS) {
      return {
        type: TURN,
        rotation: pickRandom(rng, [COUNTERCLOCKWISE, CLOCKWISE, BACK])
      };
    }
    if (previousDecision === TURN) {
      return { type: MOVE };
    }
    if (previousDecision === MOVE) {
      return {
        type: REMEMBER_128_CHARACTERS,
        message: RESOLVE_DEADLOCK + (+deadlockResolutionCount - 1)
      };
    }
  }
  if (currentHiveling.hasNutrition) {
    // Bring food home.
    return search(
      (e) => e.type === HIVE_ENTRANCE,
      { type: DROP },
      closeEntities,
      currentHiveling,
      rng
    );
  } else {
    // Search for food.
    return search(
      (e) => e.type === NUTRITION,
      { type: PICKUP },
      closeEntities,
      currentHiveling,
      rng
    );
  }
};
