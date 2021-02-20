import {
  Decision,
  DecisionType,
  Rotation,
  EntityType,
  HivelingMind,
  Input
} from "hivelings/types/common";
import {
  Entity,
  Hiveling,
  EntityDetailsWithPosition,
  SimulationState,
  isHiveling
} from "hivelings/types/simulation";
import {
  addRotations,
  relativePosition,
  normalizeRadian,
  toDeg,
  entityForPlayer
} from "hivelings/transformations";
import { max, maxBy, distance, Position, positionEquals } from "utils";
import { loadLaggedFibo } from "rng/laggedFibo";
import { randomPrintable, shuffle } from "rng/utils";
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

export const sees = ({ position, orientation }: Hiveling, p: Position) => {
  const [x, y] = relativePosition(position, p);
  const angle = normalizeRadian(
    Math.atan2(x, y) - (Math.PI * toDeg(orientation)) / 180
  );
  return (
    Math.abs(angle) < fieldOfView / 2 && distance(position, p) < sightDistance
  );
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

export const applyDecision = (
  originalState: SimulationState,
  [decision, hiveling]: [Decision, Hiveling]
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

export const advanceSimulation = async (
  hivelingMind: HivelingMind,
  state: SimulationState
) => {
  const { rngState, entities } = state;
  const rng = loadLaggedFibo(rngState);
  const shuffledHivelings = shuffle(rng, entities.filter(isHiveling));

  // The player code need not be able to run in parallel, so we sequence here
  // instead of Promise.all.
  const decisionsWithMetadata: [Decision, Hiveling][] = [];
  for (const hiveling of shuffledHivelings) {
    const {
      position,
      orientation,
      identifier,
      highlighted,
      ...rest
    } = hiveling;
    const input: Input = {
      closeEntities: entities
        .filter(
          (e) => e.identifier !== identifier && sees(hiveling, e.position)
        )
        .map(entityForPlayer(orientation, position)),
      currentHiveling: { ...rest, position: [0, 0] },
      randomSeed: randomPrintable(rng, rngState.sequence.length)
    };
    const decision: [Decision, Hiveling] = [
      await hivelingMind(input),
      hiveling
    ];
    decisionsWithMetadata.push(decision);
  }

  return decisionsWithMetadata.reduce(applyDecision, {
    ...state,
    entities,
    rngState: rng.getState()
  });
};
