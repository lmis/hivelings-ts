import {
  Input as PlayerInput,
  Entity as PlayerEntity
} from "hivelings/types/player";
import { DecisionType, EntityType, Output } from "hivelings/types/common";
import {
  Entity,
  Hiveling,
  SimulationState,
  EntityInsert,
  Input
} from "hivelings/types/simulation";
import {
  degreeDiff,
  fromHivelingFrameOfReference,
  toHivelingFrameOfReference
} from "hivelings/transformations";
import { distance, Position } from "utils";
import { randomPrintable } from "rng/utils";
import {
  debugHiveMind,
  fieldOfView,
  interactionArea,
  peripherialSightDistance,
  peripherialSightFieldOfView,
  sightDistance
} from "config";
import { Rng } from "rng/laggedFibo";

const { abs, atan2, min, max, sqrt, pow } = Math;
const { MOVE, TURN, PICKUP, DROP, WAIT } = DecisionType;
const { HIVELING, HIVE_ENTRANCE, FOOD, OBSTACLE, TRAIL } = EntityType;

// TODO: Take radius into account?
export const inFieldOfVision = (
  { midpoint, orientation }: Hiveling,
  p: Position
) => {
  const dist = distance(p, midpoint);
  if (dist === 0) {
    return true;
  }
  const [x, y] = toHivelingFrameOfReference(midpoint, orientation, p);

  const angle = abs(atan2(x, y));
  const inSight = angle <= fieldOfView / 2 && dist <= sightDistance;
  const inPeripheralView =
    angle <= peripherialSightFieldOfView / 2 &&
    dist <= peripherialSightDistance;
  return inSight || inPeripheralView;
};

const nextZIndex = (
  entities: Entity[],
  target: Position,
  targetRadius: number
): number =>
  max(
    0,
    ...entities
      .filter((e) => distance(e.midpoint, target) < e.radius + targetRadius)
      .map((e) => e.zIndex + 1)
  );

export const addEntity = (
  { nextId, entities, ...state }: SimulationState,
  entity: EntityInsert
): SimulationState => ({
  ...state,
  nextId: nextId + 1,
  entities: [
    ...entities,
    {
      ...entity,
      identifier: nextId,
      zIndex: nextZIndex(entities, entity.midpoint, entity.radius)
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
  [
    {
      interactableEntities,
      maxMoveDistance,
      currentHiveling,
      origin,
      orientation
    },
    { decision, memory64 }
  ]: [Input, Output]
): SimulationState => {
  const targetPosition: Position = fromHivelingFrameOfReference(
    origin,
    orientation,
    [0, 1]
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
          currentHiveling.identifier,
          { orientation: (orientation + degrees) % 360 },
          originalState
        );
      case MOVE:
        const dist = decision.distance;
        if (dist <= 0 || dist > maxMoveDistance) {
          return addScore(-2, originalState);
        }
        const movePosition = fromHivelingFrameOfReference(origin, orientation, [
          0,
          dist
        ]);
        return addEntity(
          updateHiveling(
            currentHiveling.identifier,
            {
              midpoint: movePosition,
              zIndex: nextZIndex(
                originalState.entities,
                movePosition,
                currentHiveling.radius
              )
            },
            originalState
          ),
          {
            type: TRAIL,
            lifetime: 4,
            hivelingId: currentHiveling.identifier,
            midpoint: origin,
            radius: 0.5,
            orientation
          }
        );
      case PICKUP:
        const nutrition = interactableEntities.find((e) => e.type === FOOD);
        if (nutrition && !currentHiveling.hasFood) {
          return updateHiveling(
            currentHiveling.identifier,
            { hasFood: true },
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
        const hiveEntrance = interactableEntities.find(
          (e) => e.type === HIVE_ENTRANCE
        );
        if (currentHiveling.hasFood) {
          if (hiveEntrance) {
            return addScore(
              15,
              updateHiveling(
                currentHiveling.identifier,
                { hasFood: false },
                originalState
              )
            );
          }
          return updateHiveling(
            currentHiveling.identifier,
            { hasFood: false },
            addEntity(originalState, {
              midpoint: targetPosition,
              radius: 0.5,
              type: FOOD
            })
          );
        }
        return addScore(-2, originalState);
    }
  })();

  return fadeTrails(
    currentHiveling.identifier,
    updateHiveling(
      currentHiveling.identifier,
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
  const { identifier, midpoint, orientation } = hiveling;
  const visibleEntities = entities
    .filter(
      (e) =>
        e.identifier !== identifier && inFieldOfVision(hiveling, e.midpoint)
    )
    .map((e) => ({
      ...e,
      midpoint: toHivelingFrameOfReference(midpoint, orientation, e.midpoint),
      ...("orientation" in e
        ? { orientation: degreeDiff(e.orientation, orientation) }
        : {})
    }));
  const interactableEntities = visibleEntities.filter(
    ({ midpoint: [x, y], radius }) =>
      x + radius > interactionArea.left &&
      x - radius < interactionArea.right &&
      y + radius > interactionArea.bottom &&
      y - radius < interactionArea.top
  );
  const visibleEntitesInPath = visibleEntities.filter(
    ({ radius, midpoint: [x, y], type }) =>
      [HIVELING, OBSTACLE].includes(type) &&
      x + radius > -hiveling.radius &&
      x - radius < hiveling.radius &&
      y + radius > 0
  );
  const maxMoveDistance = min(
    1,
    ...visibleEntitesInPath.map(
      ({ radius, midpoint: [x, y] }) =>
        y - sqrt(pow(radius + hiveling.radius, 2) - x * x)
    )
  );

  return {
    maxMoveDistance,
    interactableEntities,
    visibleEntities,
    currentHiveling: {
      ...hiveling,
      orientation: 0,
      midpoint: [0, 0]
    },
    randomSeed: randomPrintable(rng, rng.getState().sequence.length),
    origin: midpoint,
    orientation
  };
};

const stripSimulationEntityProps = (e: Entity): PlayerEntity => {
  const base = {
    position: e.midpoint,
    zIndex: e.zIndex
  };
  if (debugHiveMind) {
    return { ...e, ...base };
  }
  switch (e.type) {
    case HIVELING:
      return {
        ...base,
        type: e.type,
        hasFood: e.hasFood
      };
    case TRAIL:
      return {
        ...base,
        type: e.type,
        orientation: e.orientation,
        lifetime: e.lifetime
      };
    default:
      return { ...base, type: e.type };
  }
};
export const stripSimulationProps = (input: Input): PlayerInput => {
  const {
    maxMoveDistance,
    interactableEntities,
    visibleEntities,
    currentHiveling,
    randomSeed
  } = input;
  const { memory64, type, hasFood, midpoint, zIndex } = currentHiveling;
  return {
    ...(debugHiveMind ? input : {}),
    maxMoveDistance,
    interactableEntities: interactableEntities.map(stripSimulationEntityProps),
    visibleEntities: visibleEntities.map(stripSimulationEntityProps),
    currentHiveling: debugHiveMind
      ? {
          ...currentHiveling,
          position: midpoint
        }
      : {
          type,
          hasFood,
          zIndex,
          memory64,
          position: midpoint
        },
    randomSeed
  };
};
