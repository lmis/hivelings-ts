import {
  Decision,
  DecisionType,
  Input,
  Output,
  Rotation,
  EntityType
} from "hivelings/types/common";
import { Entity, CurrentHiveling } from "hivelings/types/player";
import { makeStdLaggedFibo, Rng } from "rng/laggedFibo";
import { pickRandom } from "rng/utils";
import { Position, positionEquals } from "utils";

const { MOVE, TURN, PICKUP, DROP, WAIT } = DecisionType;
const { HIVELING, HIVE_ENTRANCE, NUTRITION, OBSTACLE } = EntityType;
const { NONE, BACK, COUNTERCLOCKWISE, CLOCKWISE } = Rotation;

interface Memory {
  blockedFront: number;
  deadlockResolution: number;
}
// You could do much smarter things here to compress the info down if space is tight.
const serialize = (m: Memory): string => JSON.stringify(m);
const deserialize = (s: string): Memory =>
  s === "" ? { blockedFront: 0, deadlockResolution: 0 } : JSON.parse(s);

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

const goTowards = (
  position: Position | undefined,
  blockedPositions: Position[],
  currentHiveling: CurrentHiveling
): Output => {
  const { memory64 } = currentHiveling;
  if (!position) {
    // No position. No movement.
    return { decision: { type: WAIT }, memory64 };
  }
  const rotation = positionToRotation(position);
  if (rotation !== NONE) {
    return { decision: { type: TURN, rotation }, memory64 };
  }
  if (blockedPositions.some((p) => positionEquals(p, front))) {
    const { blockedFront } = deserialize(memory64);
    // Count up blocked turns
    return {
      decision: { type: WAIT },
      memory64: serialize(
        blockedFront < 4
          ? {
              blockedFront: blockedFront + 1,
              deadlockResolution: 0
            }
          : { blockedFront: 0, deadlockResolution: 4 }
      )
    };
  }
  // No need to turn. Move and reset blocked count
  return {
    decision: { type: MOVE },
    memory64: serialize({ blockedFront: 0, deadlockResolution: 0 })
  };
};

const search = (
  condition: (e: Entity) => boolean,
  decision: Decision,
  closeEntities: Entity[],
  currentHiveling: CurrentHiveling,
  rng: Rng
): Output => {
  const { memory64 } = currentHiveling;
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
      return { decision, memory64 };
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
      return { decision: { type: MOVE }, memory64 };
    }

    if (nonBlockedSurroundingPositions.length === 0) {
      return { decision: { type: WAIT }, memory64 };
    }

    return goTowards(
      pickRandom(rng, nonBlockedSurroundingPositions),
      blockedPositions,
      currentHiveling
    );
  }
};

export const hivelingMind = (input: Input): Output => {
  const { closeEntities, currentHiveling, randomSeed } = input;
  const { memory64 } = currentHiveling;
  const { deadlockResolution } = deserialize(memory64);
  const rng = makeStdLaggedFibo(randomSeed);
  if (deadlockResolution > 0) {
    const previousDecision = currentHiveling.recentDecisions[0]?.type;
    if (previousDecision === TURN) {
      return {
        decision: { type: MOVE },
        memory64: serialize({
          blockedFront: 0,
          deadlockResolution: deadlockResolution - 1
        })
      };
    } else {
      return {
        decision: {
          type: TURN,
          rotation: pickRandom(rng, [COUNTERCLOCKWISE, CLOCKWISE, BACK])
        },
        memory64
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
