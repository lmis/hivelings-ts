import {
  Decision,
  DecisionType,
  Rotation,
  EntityType
} from "hivelings/types/common";
import {
  GameState,
  Entity,
  Hiveling,
  EntityDetailsWithPosition
} from "hivelings/types/simulation";
import {
  addRotations,
  relativePosition,
  toDeg
} from "hivelings/transformations";
import { distance, Position, positionEquals } from "utils";
import { max, maxBy } from "utils";
import { fieldOfView, sightDistance } from "config";

const {
  MOVE,
  TURN,
  PICKUP,
  DROP,
  WAIT,
  REMEMBER_128_CHARACTERS
} = DecisionType;
const { HIVELING, HIVE_ENTRANCE, NUTRITION, OBSTACLE, TRAIL } = EntityType;
const { NONE, BACK, COUNTERCLOCKWISE, CLOCKWISE } = Rotation;

// normalize angle to (-PI, PI]
const normalizedRadian = (radian: number) => {
  const positive = (2 * Math.PI + radian) % (2 * Math.PI);
  return positive > Math.PI ? 2 * Math.PI - positive : positive;
};

export const sees = ({ position, orientation }: Hiveling, p: Position) => {
  const [x, y] = relativePosition(position, p);
  const angle = normalizedRadian(
    Math.atan2(x, y) - (Math.PI * toDeg(orientation)) / 180
  );
  // return distance(position, p) < sightDistance;
  return (
    Math.abs(angle) < fieldOfView / 2 && distance(position, p) < sightDistance
  );
};

export const addEntity = (
  { nextId, entities, ...state }: GameState,
  entity: EntityDetailsWithPosition,
  zMax: number = Infinity
): GameState => ({
  ...state,
  nextId: nextId + 1,
  entities: [
    ...entities,
    {
      ...entity,
      highlighted: false,
      identifier: nextId,
      zIndex: Math.min(
        zMax,
        1 +
          (max(
            entities
              .filter((e) => positionEquals(e.position, entity.position))
              .map((e) => e.zIndex)
          ) ?? -1)
      )
    }
  ]
});
const updateHiveling = (
  id: number,
  u: Partial<Hiveling>,
  s: GameState
): GameState => ({
  ...s,
  entities: s.entities.map((e) =>
    e.identifier === id && e.type === HIVELING ? { ...e, ...u } : e
  )
});
const addScore = (x: number, s: GameState): GameState => ({
  ...s,
  score: s.score + x
});
const fadeTrails = (hivelingId: number, s: GameState): GameState => ({
  ...s,
  entities: s.entities
    .map((e) =>
      e.type === TRAIL && e.hivelingId === hivelingId
        ? { ...e, lifetime: e.lifetime - 1 }
        : e
    )
    .filter((e) => !(e.type === TRAIL && e.lifetime < 0))
});

export const applyDecision = (
  originalState: GameState,
  [decision, hiveling]: [Decision, Hiveling]
): GameState => {
  const targetPos = ((): Position => {
    const [x, y] = hiveling.position;
    switch (hiveling.orientation) {
      case NONE:
        return [x, y + 1];
      case CLOCKWISE:
        return [x + 1, y];
      case BACK:
        return [x, y - 1];
      case COUNTERCLOCKWISE:
        return [x - 1, y];
    }
  })();

  const topEntityAtTarget = maxBy(
    (e: Entity) => e.zIndex,
    originalState.entities.filter(
      (e) =>
        positionEquals(e.position, targetPos) &&
        e.identifier !== hiveling.identifier
    )
  );
  const stateAfterDecision = (() => {
    switch (decision.type) {
      case WAIT:
        return addScore(-1, originalState);
      case REMEMBER_128_CHARACTERS:
        return updateHiveling(
          hiveling.identifier,
          { memory: decision.message.substring(0, 128) },
          addScore(-Math.round(decision.message.length / 20), originalState)
        );
      case TURN:
        if (decision.rotation === NONE) {
          return addScore(-2, originalState);
        }
        return updateHiveling(
          hiveling.identifier,
          {
            orientation: addRotations(hiveling.orientation, decision.rotation)
          },
          originalState
        );
      case MOVE:
        switch (topEntityAtTarget?.type) {
          case OBSTACLE:
            return addScore(-2, originalState);
          case HIVELING:
            return originalState;
          default:
            return addEntity(
              updateHiveling(
                hiveling.identifier,
                {
                  position: targetPos,
                  zIndex: topEntityAtTarget ? topEntityAtTarget.zIndex + 1 : 0
                },
                originalState
              ),
              {
                type: TRAIL,
                lifetime: 4,
                position: hiveling.position,
                orientation: hiveling.orientation,
                hivelingId: hiveling.identifier
              },
              hiveling.zIndex - 1
            );
        }
      case PICKUP:
        if (topEntityAtTarget?.type === NUTRITION && !hiveling.hasNutrition) {
          return updateHiveling(
            hiveling.identifier,
            { hasNutrition: true },
            {
              ...originalState,
              entities: originalState.entities.filter(
                (e) => e.identifier !== topEntityAtTarget.identifier
              )
            }
          );
        }
        return originalState;
      case DROP:
        if (hiveling.hasNutrition) {
          if (topEntityAtTarget?.type === HIVE_ENTRANCE) {
            return addScore(
              15,
              updateHiveling(
                hiveling.identifier,
                { hasNutrition: false },
                originalState
              )
            );
          }
          return updateHiveling(
            hiveling.identifier,
            { hasNutrition: false },
            addEntity(originalState, {
              position: targetPos,
              type: NUTRITION
            })
          );
        }
        return originalState;
    }
  })();

  return fadeTrails(
    hiveling.identifier,
    updateHiveling(
      hiveling.identifier,
      {
        recentDecisions: [decision, ...hiveling.recentDecisions.slice(0, 2)]
      },
      stateAfterDecision
    )
  );
};
