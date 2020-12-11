import {
  Decision,
  DecisionType,
  Input,
  Rotation,
  EntityType
} from "hivelings/types/common";
import { Entity, Hiveling } from "hivelings/types/player";
import { fromSeed, pickRandom } from "rng/utils";
import { Position, positionEquals } from "utils";
import { prng } from "seedrandom";

const { MOVE, TURN, PICKUP, DROP, WAIT } = DecisionType;
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

const goTowards = (position: Position | undefined): Decision => {
  if (!position) {
    // No position. No movement.
    return { type: WAIT };
  }
  const rotation = positionToRotation(position);
  if (rotation === NONE) {
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
  rng: prng
): Decision => {
  const front: Position = [0, 1];
  const back: Position = [0, -1];
  const left: Position = [-1, 0];
  const right: Position = [1, 0];

  const surroundingPoitions = [front, back, left, right];
  const targets = closeEntities.filter(condition).map((e) => e.position);
  const targetsAround = targets.filter((p) =>
    surroundingPoitions.some((s) => positionEquals(p, s))
  );
  const targetsUnderneath = targets.filter((p) => positionEquals(p, [0, 0]));
  const nonBlockedSurroundingPositions = surroundingPoitions.filter(
    (p) =>
      !closeEntities.some(
        (e) =>
          positionEquals(e.position, p) && [HIVELING, OBSTACLE].includes(e.type)
      )
  );

  if (targetsAround.length) {
    if (targetsAround.some((p) => positionEquals(p, front))) {
      // Target right in front. Interact!
      return decision;
    }
    return goTowards(targetsAround[0]);
  } else if (targetsUnderneath.length) {
    return goTowards(nonBlockedSurroundingPositions[0]);
  } else if (targets.length) {
    // Prefer a target in front. Fall back to any other instead.
    const position =
      targets.find((p) => positionEquals(p, front)) ?? targets[0];
    return goTowards(position);
  } else {
    // No targets. Continue searching.
    if (
      nonBlockedSurroundingPositions.includes(front) &&
      currentHiveling.recentDecisions[0]?.type === TURN
    ) {
      // Just turned. Move forward.
      return { type: MOVE };
    }

    if (nonBlockedSurroundingPositions.length === 0) {
      return { type: WAIT };
    }

    return goTowards(pickRandom(rng, nonBlockedSurroundingPositions));
  }
};

export const hivelingMind = (input: Input): Decision => {
  const { closeEntities, currentHiveling, randomSeed } = input;
  const rng = fromSeed(randomSeed);
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
