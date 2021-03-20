import {
  Input as PlayerInput,
  Entity as PlayerEntity
} from "hivelings/types/player";
import { DecisionType, EntityType, Output } from "hivelings/types/common";
import {
  Entity,
  EntityInsert,
  Hiveling,
  SimulationState,
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

export const insert = (state: SimulationState, e: EntityInsert): void => {
  const identifier = state.nextId++;
  const zIndex = nextZIndex(state.entities, e.midpoint, e.radius);

  state.entities.push({ identifier, zIndex, ...e });
};

export const fadeTrails = (s: SimulationState): SimulationState => ({
  ...s,
  entities: s.entities
    .map((e) => (e.type === TRAIL ? { ...e, lifetime: e.lifetime - 1 } : e))
    .filter((e) => !(e.type === TRAIL && --e.lifetime < 0))
});

export const applyOutput = (
  originalState: SimulationState,
  { midpoint, orientation, identifier, radius, hasFood }: Hiveling,
  { interactableEntities, maxMoveDistance }: Input,
  { decision, memory, show }: Output<unknown>
): SimulationState => {
  const state = {
    ...originalState,
    entities: originalState.entities.map((e) => ({
      ...e,
      midpoint: [...e.midpoint] as Position
    }))
  };

  const currentHiveling = state.entities.find(
    (e): e is Hiveling => e.identifier === identifier
  )!;
  currentHiveling.memory = memory;
  currentHiveling.show = show;

  switch (decision.type) {
    case WAIT:
      state.score -= 1;
      return state;
    case TURN:
      const degrees =
        decision.degrees < 0
          ? 360 - (-decision.degrees % 360)
          : decision.degrees % 360;
      if (degrees === 0) {
        state.score -= 2;
        return state;
      }
      currentHiveling.orientation = orientation + (degrees % 360);
      return state;
    case MOVE:
      const dist = decision.distance;
      if (dist <= 0 || dist > maxMoveDistance) {
        state.score -= 2;
        return state;
      }
      const movePosition = fromHivelingFrameOfReference(midpoint, orientation, [
        0,
        dist
      ]);
      insert(state, {
        type: TRAIL,
        lifetime: 4,
        hivelingId: identifier,
        midpoint,
        radius,
        orientation
      });
      currentHiveling.midpoint = movePosition;
      currentHiveling.zIndex = nextZIndex(state.entities, movePosition, radius);
      return state;
    case PICKUP:
      const nutrition = interactableEntities.find((e) => e.type === FOOD);
      if (nutrition && !hasFood) {
        currentHiveling.hasFood = true;
        state.entities = state.entities.filter(
          (e) => e.identifier !== nutrition.identifier
        );
      } else {
        state.score -= 1;
      }
      return state;
    case DROP:
      const hiveEntrance = interactableEntities.find(
        (e) => e.type === HIVE_ENTRANCE
      );
      if (hasFood) {
        currentHiveling.hasFood = false;
        if (hiveEntrance) {
          state.score += 15;
        } else {
          const targetPosition: Position = fromHivelingFrameOfReference(
            midpoint,
            orientation,
            [0, 1]
          );

          insert(state, {
            type: FOOD,
            midpoint: targetPosition,
            radius: 0.5
          });
        }
      } else {
        state.score -= 2;
      }
      return state;
  }
};

const toHivelingSpace = ({ midpoint, orientation }: Hiveling, e: Entity) => ({
  ...e,
  midpoint: toHivelingFrameOfReference(midpoint, orientation, e.midpoint),
  ...("orientation" in e
    ? { orientation: degreeDiff(e.orientation, orientation) }
    : {})
});

export const makeInput = (entities: Entity[], hiveling: Hiveling): Input => {
  const { identifier, midpoint, orientation, memory, hasFood } = hiveling;
  const otherEntities = entities
    .filter((e) => e.identifier !== identifier)
    .map((e) => ({ ...e, dist: distance(midpoint, e.midpoint) }));
  const sliverWidth = fieldOfView / 50;
  const slivers = rangeSteps(
    -fieldOfView / 2,
    sliverWidth,
    fieldOfView / 2
  ).map((sliverStart) => {
    const entitiesInSliver = sortBy(
      (e) => e.dist,
      otherEntities.filter((e) => {
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
    return {
      visibleEntityIds: (occluderIndex === -1
        ? entitiesInSliver
        : entitiesInSliver.slice(0, occluderIndex + 1)
      ).map((e) => e.identifier),
      dist: min(
        entitiesInSliver[occluderIndex]?.dist ?? Infinity,
        sightDistance
      ),
      angleStart: orientation + sliverStart,
      angleEnd: orientation + sliverStart + sliverWidth
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
    visibilityEndpoints: slivers.map(({ angleStart, angleEnd, dist }) => ({
      dist,
      angleStart,
      angleEnd
    })),
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
export const simulationInputToPlayerInput = (
  {
    maxMoveDistance,
    interactableEntities,
    visibleEntities,
    hasFood,
    memory
  }: Input,
  randomSeed: string
): PlayerInput<unknown> => ({
  maxMoveDistance,
  interactableEntities: interactableEntities.map(stripSimulationEntityProps),
  visibleEntities: visibleEntities.map(stripSimulationEntityProps),
  hasFood,
  memory,
  randomSeed
});
