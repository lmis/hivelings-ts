import {
  DecisionType,
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
  entityForPlayer,
  fromHivelingFrameOfReference,
  toHivelingFrameOfReference
} from "hivelings/transformations";
import { max, distance, Position, sortBy, Box, roundTo } from "utils";
import { Rng } from "rng/laggedFibo";
import { randomPrintable } from "rng/utils";
import {
  fieldOfView,
  interactionArea,
  movementArea,
  peripherialSightDistance,
  peripherialSightFieldOfView,
  sightDistance
} from "config";

const { MOVE, TURN, PICKUP, DROP, WAIT } = DecisionType;
const { HIVELING, HIVE_ENTRANCE, NUTRITION, OBSTACLE, TRAIL } = EntityType;

export const sees = (hiveling: Hiveling, p: Position) => {
  const dist = distance(p, hiveling.position);
  if (dist === 0) {
    return true;
  }
  const [x, y] = toHivelingFrameOfReference(hiveling, p);

  const angle = Math.abs(Math.atan2(x, y));
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
              .filter((e) => distance(e.position, entity.position) < 1)
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

const inArea = (
  hiveling: Hiveling,
  entity: Entity,
  { left, right, top, bottom }: Box
) => {
  const [x, y] = toHivelingFrameOfReference(hiveling, entity.position);
  return x > left && x < right && y > bottom && y < top;
};

export const applyOutput = (
  originalState: SimulationState,
  [{ decision, memory64 }, hiveling]: [Output, Hiveling]
): SimulationState => {
  const targetPosition: Position = fromHivelingFrameOfReference(hiveling, [
    0,
    1
  ]);
  const entitiesInInteractionArea = sortBy(
    (e) => -e.zIndex,
    originalState.entities.filter((e) => inArea(hiveling, e, interactionArea))
  );
  const entitiesInMovementArea = originalState.entities.filter((e) =>
    inArea(hiveling, e, movementArea)
  );

  const stateAfterDecision = (() => {
    switch (decision.type) {
      case WAIT:
        return addScore(-1, originalState);
      case TURN:
        const degrees =
          decision.degrees < 0
            ? 360 - (-decision.degrees % 360)
            : decision.degrees % 360;
        if (degrees === 0) {
          return addScore(-2, originalState);
        }
        return updateHiveling(
          hiveling.identifier,
          { orientation: (hiveling.orientation + degrees) % 360 },
          originalState
        );
      case MOVE:
        if (entitiesInMovementArea.some((e) => e.type === OBSTACLE)) {
          return addScore(-2, originalState);
        }
        if (entitiesInMovementArea.some((e) => e.type === HIVELING)) {
          return originalState;
        }
        return addEntity(
          updateHiveling(
            hiveling.identifier,
            {
              position: targetPosition.map((x) =>
                roundTo(x, 0.001)
              ) as Position,
              zIndex: (entitiesInMovementArea[0]?.zIndex ?? -1) + 1
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
      case PICKUP:
        const nutrition = entitiesInInteractionArea.find(
          (e) => e.type === NUTRITION
        );
        if (nutrition && !hiveling.hasNutrition) {
          return updateHiveling(
            hiveling.identifier,
            { hasNutrition: true },
            {
              ...originalState,
              entities: originalState.entities.filter(
                (e) => e.identifier !== nutrition.identifier
              )
            }
          );
        }
        return addScore(-1, originalState);
      case DROP:
        const hiveEntrance = entitiesInInteractionArea.find(
          (e) => e.type === HIVE_ENTRANCE
        );
        if (hiveling.hasNutrition) {
          if (hiveEntrance) {
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
              position: targetPosition,
              type: NUTRITION
            })
          );
        }
        return addScore(-2, originalState);
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
  const { identifier, zIndex, type, hasNutrition, memory64 } = hiveling;
  return {
    visibleEntities: entities
      .filter((e) => e.identifier !== identifier && sees(hiveling, e.position))
      .map((e) => entityForPlayer(hiveling, e)),
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
