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
  toDeg,
  toHivelingFrameOfReference
} from "hivelings/transformations";
import { distance, Position, rangeSteps, sortBy } from "utils";
import { fieldOfView, interactionArea, sightDistance } from "config";

const { asin, atan2, min, max, sqrt, pow } = Math;
const { MOVE, TURN, PICKUP, DROP, WAIT } = DecisionType;
const { HIVELING, HIVE_ENTRANCE, FOOD, OBSTACLE, TRAIL } = EntityType;

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
export const fadeTrails = (s: SimulationState): SimulationState => ({
  ...s,
  entities: s.entities
    .map((e) => (e.type === TRAIL ? { ...e, lifetime: e.lifetime - 1 } : e))
    .filter((e) => !(e.type === TRAIL && e.lifetime < 0))
});

export const applyOutput = (
  originalState: SimulationState,
  { midpoint, orientation, identifier, radius, hasFood }: Hiveling,
  { interactableEntities, maxMoveDistance }: Input,
  { decision, memory, show }: Output<unknown>
): SimulationState => {
  const stateWithUpdatedMemory = updateHiveling(
    identifier,
    { memory, show },
    originalState
  );
  const { entities } = stateWithUpdatedMemory;
  const targetPosition: Position = fromHivelingFrameOfReference(
    midpoint,
    orientation,
    [0, 1]
  );

  switch (decision.type) {
    case WAIT:
      return addScore(-1, stateWithUpdatedMemory);
    case TURN:
      const degrees =
        decision.degrees < 0
          ? 360 - (-decision.degrees % 360)
          : decision.degrees % 360;
      if (degrees === 0) {
        return addScore(-2, stateWithUpdatedMemory);
      }
      return updateHiveling(
        identifier,
        { orientation: (orientation + degrees) % 360 },
        stateWithUpdatedMemory
      );
    case MOVE:
      const dist = decision.distance;
      if (dist <= 0 || dist > maxMoveDistance) {
        return addScore(-2, stateWithUpdatedMemory);
      }
      const movePosition = fromHivelingFrameOfReference(midpoint, orientation, [
        0,
        dist
      ]);
      return addEntity(
        updateHiveling(
          identifier,
          {
            midpoint: movePosition,
            zIndex: nextZIndex(entities, movePosition, radius)
          },
          stateWithUpdatedMemory
        ),
        {
          type: TRAIL,
          lifetime: 4,
          hivelingId: identifier,
          midpoint,
          radius,
          orientation
        }
      );
    case PICKUP:
      const nutrition = interactableEntities.find((e) => e.type === FOOD);
      if (nutrition && !hasFood) {
        return updateHiveling(
          identifier,
          { hasFood: true },
          {
            ...stateWithUpdatedMemory,
            entities: entities.filter(
              (e) => e.identifier !== nutrition.identifier
            )
          }
        );
      }
      return addScore(-1, stateWithUpdatedMemory);
    case DROP:
      const hiveEntrance = interactableEntities.find(
        (e) => e.type === HIVE_ENTRANCE
      );
      if (hasFood) {
        if (hiveEntrance) {
          return addScore(
            15,
            updateHiveling(
              identifier,
              { hasFood: false },
              stateWithUpdatedMemory
            )
          );
        }
        return updateHiveling(
          identifier,
          { hasFood: false },
          addEntity(stateWithUpdatedMemory, {
            midpoint: targetPosition,
            radius: 0.5,
            type: FOOD
          })
        );
      }
      return addScore(-2, stateWithUpdatedMemory);
  }
};

const toHivelingSpace = ({ midpoint, orientation }: Hiveling, e: Entity) => ({
  ...e,
  midpoint: toHivelingFrameOfReference(midpoint, orientation, e.midpoint),
  ...("orientation" in e
    ? { orientation: degreeDiff(e.orientation, orientation) }
    : {})
});

export const makeInput = (
  entities: Entity[],
  hiveling: Hiveling
): Omit<Input, "randomSeed"> => {
  const { identifier, midpoint, orientation, memory, hasFood } = hiveling;
  const otherEntities = entities.filter((e) => e.identifier !== identifier);
  const sliverWidth = 1;
  const slivers = rangeSteps(
    -fieldOfView / 2,
    sliverWidth,
    fieldOfView / 2
  ).map((sliverStart) => {
    const entitiesInSliver = sortBy(
      (e) => e.dist,
      otherEntities
        .map((e) => ({ ...e, dist: distance(midpoint, e.midpoint) }))
        .filter((e) => {
          const position = e.midpoint;
          if (e.dist <= e.radius) {
            return true;
          }

          const [x, y] = toHivelingFrameOfReference(
            midpoint,
            orientation + sliverStart,
            position
          );

          const angle = atan2(x, y);
          const alpha = asin(e.radius / e.dist);
          const left = toDeg(angle - alpha);
          const right = toDeg(angle + alpha);

          return (
            e.dist <= sightDistance + e.radius &&
            (right < sliverWidth || left < sliverWidth || left > right)
          );
        })
    );
    const occluderIndex = entitiesInSliver.findIndex((e) =>
      [OBSTACLE, HIVELING].includes(e.type)
    );
    const occluder = entitiesInSliver[occluderIndex];
    const dist = occluder ? occluder.dist - occluder.radius : sightDistance;
    return {
      visibleEntityIds: (occluder
        ? entitiesInSliver.slice(0, occluderIndex + 1)
        : entitiesInSliver
      ).map((e) => e.identifier),
      endpoint: fromHivelingFrameOfReference(
        midpoint,
        orientation + sliverStart,
        [0, dist]
      )
    };
  });
  const visibleEntityIds = new Set<number>();
  slivers.forEach((s) =>
    s.visibleEntityIds.forEach((i) => visibleEntityIds.add(i))
  );
  const visibleEntities = otherEntities
    .filter((e) => visibleEntityIds.has(e.identifier))
    .map((e) => toHivelingSpace(hiveling, e));

  const otherEntitiesInHivelingReference = otherEntities.map((e) =>
    toHivelingSpace(hiveling, e)
  );
  const interactableEntities = otherEntitiesInHivelingReference.filter(
    ({ midpoint: [x, y], radius }) =>
      x + radius > interactionArea.left &&
      x - radius < interactionArea.right &&
      y + radius > interactionArea.bottom &&
      y - radius < interactionArea.top
  );
  const entitiesInPath = otherEntitiesInHivelingReference.filter(
    ({ radius, midpoint: [x, y], type }) =>
      [HIVELING, OBSTACLE].includes(type) &&
      x + radius > -hiveling.radius &&
      x - radius < hiveling.radius &&
      y > 0
  );
  const maxMoveDistance = min(
    1,
    ...entitiesInPath.map(
      ({ radius, midpoint: [x, y] }) =>
        y - sqrt(pow(radius + hiveling.radius, 2) - x * x)
    )
  );

  return {
    visibilityEndpoints: slivers.map((s) => s.endpoint),
    maxMoveDistance,
    interactableEntities,
    visibleEntities,
    hasFood,
    memory
  };
};

const stripSimulationEntityProps = (e: Entity): PlayerEntity => {
  const base = {
    midpoint: e.midpoint,
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
export const stripSimulationProps = ({
  maxMoveDistance,
  interactableEntities,
  visibleEntities,
  randomSeed,
  hasFood,
  memory
}: Input): PlayerInput<unknown> => ({
  maxMoveDistance,
  interactableEntities: interactableEntities.map(stripSimulationEntityProps),
  visibleEntities: visibleEntities.map(stripSimulationEntityProps),
  hasFood,
  memory,
  randomSeed
});
