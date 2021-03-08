import {
  Input as PlayerInput,
  Entity as PlayerEntity
} from "hivelings/types/player";
import { DecisionType, EntityType, Output } from "hivelings/types/common";
import {
  Entity,
  Hiveling,
  EntityDetailsWithPosition,
  SimulationState,
  Input
} from "hivelings/types/simulation";
import {
  degreeDiff,
  fromHivelingFrameOfReference,
  toHivelingFrameOfReference
} from "hivelings/transformations";
import { max, distance, Position, Box } from "utils";
import { randomPrintable } from "rng/utils";
import {
  debugHiveMind,
  fieldOfView,
  interactionArea,
  movementArea,
  peripherialSightDistance,
  peripherialSightFieldOfView,
  sightDistance
} from "config";

const { MOVE, TURN, PICKUP, DROP, WAIT } = DecisionType;
const { HIVELING, HIVE_ENTRANCE, FOOD, OBSTACLE, TRAIL } = EntityType;

export const inFieldOfVision = (
  { position, orientation }: Hiveling,
  p: Position
) => {
  const dist = distance(p, position);
  if (dist === 0) {
    return true;
  }
  const [x, y] = toHivelingFrameOfReference(position, orientation, p);

  const angle = Math.abs(Math.atan2(x, y));
  const inSight = angle <= fieldOfView / 2 && dist <= sightDistance;
  const inPeripheralView =
    angle <= peripherialSightFieldOfView / 2 &&
    dist <= peripherialSightDistance;
  return inSight || inPeripheralView;
};

const nextZIndex = (entities: Entity[], target: Position): number =>
  1 +
  (max(
    entities
      .filter((e) => distance(e.position, target) < 1)
      .map((e) => e.zIndex)
  ) ?? -1);

export const addEntity = (
  { nextId, entities, ...state }: SimulationState,
  entity: EntityDetailsWithPosition
): SimulationState => ({
  ...state,
  nextId: nextId + 1,
  entities: [
    ...entities,
    {
      ...entity,
      identifier: nextId,
      zIndex: nextZIndex(entities, entity.position)
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
        return addEntity(
          updateHiveling(
            currentHiveling.identifier,
            {
              position: fromHivelingFrameOfReference(origin, orientation, [
                0,
                dist
              ]).map((x) => parseFloat(x.toFixed(3))) as Position,
              zIndex: nextZIndex(originalState.entities, targetPosition)
            },
            originalState
          ),
          {
            type: TRAIL,
            lifetime: 4,
            hivelingId: currentHiveling.identifier,
            position: origin,
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
              position: targetPosition,
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

const inArea = (entity: Entity, { left, right, top, bottom }: Box) => {
  const [x, y] = entity.position;
  return x > left && x < right && y > bottom && y < top;
};

export const makeInput = (
  { rng, entities }: SimulationState,
  hiveling: Hiveling
): Input => {
  const { identifier, position, orientation } = hiveling;
  const visibleEntities = entities
    .filter(
      (e) =>
        e.identifier !== identifier && inFieldOfVision(hiveling, e.position)
    )
    .map((e) => ({
      ...e,
      position: toHivelingFrameOfReference(position, orientation, e.position),
      ...("orientation" in e
        ? { orientation: degreeDiff(e.orientation, orientation) }
        : {})
    }));
  const interactableEntities = visibleEntities.filter((e) =>
    inArea(e, interactionArea)
  );
  // TODO: Avoid bisection?
  let maxMoveDistance = 1;
  let upper = 1;
  let lower = 0;
  while (upper - lower > 0.01) {
    if (
      visibleEntities.some(
        (e) =>
          [HIVELING, OBSTACLE].includes(e.type) &&
          inArea(e, {
            ...movementArea,
            top: movementArea.top - (1 - maxMoveDistance)
          })
      )
    ) {
      upper = maxMoveDistance;
    } else {
      lower = maxMoveDistance;
    }
    maxMoveDistance = (upper - lower) / 2 + lower;
  }
  return {
    maxMoveDistance,
    interactableEntities,
    visibleEntities,
    currentHiveling: {
      ...hiveling,
      orientation: 0,
      position: [0, 0]
    },
    randomSeed: randomPrintable(rng, rng.getState().sequence.length),
    origin: position,
    orientation
  };
};

const stripSimulationEntityProps = (e: Entity): PlayerEntity => {
  const base = {
    position: e.position,
    zIndex: e.zIndex
  };
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
  if (debugHiveMind) {
    return input as any;
  }
  const {
    maxMoveDistance,
    interactableEntities,
    visibleEntities,
    currentHiveling: { position, zIndex, type, hasFood, memory64 },
    randomSeed
  } = input;
  return {
    maxMoveDistance,
    interactableEntities: interactableEntities.map(stripSimulationEntityProps),
    visibleEntities: visibleEntities.map(stripSimulationEntityProps),
    currentHiveling: { position, zIndex, type, hasFood, memory64 },
    randomSeed
  };
};
