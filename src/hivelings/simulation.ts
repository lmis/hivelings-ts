import {
  DecisionType,
  Rotation,
  EntityType,
  Input,
  Output
} from "hivelings/types/common";
import {
  Entity,
  Hiveling,
  EntityDetailsWithPosition,
  SimulationState
} from "hivelings/types/simulation";
import {
  addRotations,
  relativePosition,
  inverseRotatePosition,
  entityForPlayer
} from "hivelings/transformations";
import { max, maxBy, distance, Position, positionEquals } from "utils";
import { Rng } from "rng/laggedFibo";
import { randomPrintable } from "rng/utils";
import {
  fieldOfView,
  peripherialSightDistance,
  peripherialSightFieldOfView,
  sightDistance
} from "config";

const { MOVE, TURN, PICKUP, DROP, WAIT } = DecisionType;
const { HIVELING, HIVE_ENTRANCE, NUTRITION, OBSTACLE, TRAIL } = EntityType;
const { NONE, BACK, COUNTERCLOCKWISE, CLOCKWISE } = Rotation;

export const sees = ({ position, orientation }: Hiveling, p: Position) => {
  if (positionEquals(p, position)) {
    return true;
  }
  const [x, y] = inverseRotatePosition(
    orientation,
    relativePosition(position, p)
  );

  const angle = Math.abs(Math.atan2(x, y));
  const dist = distance(position, p);
  const inSight = angle <= fieldOfView / 2 && dist <= sightDistance;
  const inPeripheralView =
    angle <= peripherialSightFieldOfView / 2 &&
    dist <= peripherialSightDistance;
  return inSight || inPeripheralView;
};

export const addEntity = (
  { nextId, entities, ...state }: SimulationState,
  entity: EntityDetailsWithPosition,
  zMax: number = Infinity
): SimulationState => ({
  ...state,
  nextId: nextId + 1,
  entities: [
    ...entities,
    {
      ...entity,
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
  s: SimulationState
): SimulationState => ({
  ...s,
  entities: s.entities.map((e) =>
    e.identifier === id && e.type === HIVELING ? { ...e, ...u } : e
  )
});
const addScore = (x: number, s: SimulationState): SimulationState => ({
  ...s,
  score: s.score + x
});
const fadeTrails = (
  hivelingId: number,
  s: SimulationState
): SimulationState => ({
  ...s,
  entities: s.entities
    .map((e) =>
      e.type === TRAIL && e.hivelingId === hivelingId
        ? { ...e, lifetime: e.lifetime - 1 }
        : e
    )
    .filter((e) => !(e.type === TRAIL && e.lifetime < 0))
});

export const applyOutput = (
  originalState: SimulationState,
  [{ decision, memory64 }, hiveling]: [Output, Hiveling]
): SimulationState => {
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
        memory64: memory64.substring(0, 64)
      },
      stateAfterDecision
    )
  );
};

export const makeInput = (
  rng: Rng,
  entities: Entity[],
  hiveling: Hiveling
): Input => {
  const {
    position,
    orientation,
    identifier,
    zIndex,
    type,
    hasNutrition,
    memory64
  } = hiveling;
  return {
    visibleEntities: entities
      .filter((e) => e.identifier !== identifier && sees(hiveling, e.position))
      .map(entityForPlayer(orientation, position)),
    currentHiveling: {
      position: [0, 0],
      zIndex,
      type,
      hasNutrition,
      memory64
    },
    randomSeed: randomPrintable(rng, rng.getState().sequence.length)
  };
};
