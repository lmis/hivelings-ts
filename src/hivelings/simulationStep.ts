import {
  HivelingMind,
  Decision,
  DecisionType,
  Input,
  Rotation,
  Position,
  EntityType
} from "hivelings/types/common";
import {
  GameState,
  Entity,
  isHiveling,
  Hiveling
} from "hivelings/types/simulation";
import { load, shuffle } from "rng/utils";
import filter from "lodash/fp/filter";
import {
  entityForPlayer,
  hivelingForPlayer,
  addRotations
} from "hivelings/transformations";
import maxBy from "lodash/fp/maxBy";
import max from "lodash/fp/max";

const sees = (_: any, __: any) => true;
const addEntity = (
  entityType: EntityType,
  position: Position,
  { nextId, entities, ...state }: GameState
): GameState => ({
  ...state,
  nextId: nextId + 1,
  entities: [
    ...entities,
    {
      entityType,
      position,
      highlighted: false,
      identifier: nextId,
      zIndex:
        (max(
          entities.filter((e) => e.position === position).map((e) => e.zIndex)
        ) ?? -1) + 1
    }
  ]
});

const takeDecision = async (
  randomSeed: number,
  entities: Entity[],
  hivelingMind: HivelingMind,
  hiveling: Hiveling
): Promise<[Decision, Hiveling]> => {
  const input: Input = {
    closeEntities: entities
      .filter(
        (e) =>
          e.identifier !== hiveling.identifier && sees(hiveling, e.position)
      )
      .map(entityForPlayer(hiveling.orientation, hiveling.position)),
    currentHiveling: hivelingForPlayer(hiveling),
    randomSeed
  };
  return [await hivelingMind(input), hiveling];
};

const applyDecision = (
  originalState: GameState,
  [decision, hiveling]: [Decision, Hiveling]
): GameState => {
  const addScore = (x: number, s: GameState): GameState => ({
    ...s,
    score: s.score + x
  });
  const updateHiveling = (u: Partial<Hiveling>, s: GameState): GameState => ({
    ...s,
    entities: [
      ...s.entities.filter((e) => e.identifier !== hiveling.identifier),
      {
        ...hiveling,
        ...u
      }
    ]
  });
  const targetPos = ((): Position => {
    const [x, y] = hiveling.position;
    switch (hiveling.orientation) {
      case Rotation.NONE:
        return [x, y + 1];
      case Rotation.CLOCKWISE:
        return [x + 1, y];
      case Rotation.BACK:
        return [x, y - 1];
      case Rotation.COUNTERCLOCKWISE:
        return [x - 1, y];
    }
  })();

  const topEntityAtTarget =
    maxBy((e: Entity) => e.zIndex)(
      originalState.entities.filter(
        (e) => e.position === targetPos && e.identifier !== hiveling.identifier
      )
    ) ?? null;
  const stateAfterDecision = (() => {
    switch (decision.type) {
      case DecisionType.REMEMBER_128_CHARACTERS:
        return updateHiveling(
          { memory: decision.message },
          addScore(-Math.round(decision.message.length / 20), originalState)
        );
      case DecisionType.TURN:
        if (decision.rotation === Rotation.NONE) {
          return addScore(-1, originalState);
        }
        return updateHiveling(
          {
            orientation: addRotations(hiveling.orientation, decision.rotation)
          },
          originalState
        );
      case DecisionType.MOVE:
        switch (topEntityAtTarget?.entityType) {
          case EntityType.OBSTACLE:
            return addScore(-2, originalState);
          case EntityType.HIVELING:
            return originalState;
          default:
            return updateHiveling(
              {
                position: targetPos,
                zIndex: topEntityAtTarget ? topEntityAtTarget.zIndex + 1 : 0
              },
              originalState
            );
        }
      case DecisionType.PICKUP:
        if (
          topEntityAtTarget?.entityType === EntityType.NUTRITION &&
          !hiveling.hasNutrition
        ) {
          return updateHiveling(
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
      case DecisionType.DROP:
        if (hiveling.hasNutrition) {
          if (topEntityAtTarget?.entityType === EntityType.HIVE_ENTRANCE) {
            return addScore(
              15,
              updateHiveling({ hasNutrition: false }, originalState)
            );
          }
          return updateHiveling(
            { hasNutrition: false },
            addEntity(EntityType.NUTRITION, targetPos, originalState)
          );
        }
        return originalState;
    }
  })();

  const stateWithRecentDecision = updateHiveling(
    { recentDecisions: [decision, ...hiveling.recentDecisions.slice(0, 2)] },
    stateAfterDecision
  );

  return hiveling.spreadsPheromones
    ? addEntity(
        EntityType.PHEROMONE,
        hiveling.position,
        stateWithRecentDecision
      )
    : stateWithRecentDecision;
};

export const doGameStep = async (
  hivelingMind: HivelingMind,
  { entities, rngState, ...state }: GameState
): Promise<GameState> => {
  const rng = load(rngState);
  const shuffledHivelings = shuffle(rng, filter(isHiveling)(entities));

  // The player code need not be able to run in parallel, so we sequence here
  // instead of Promise.all.
  const decisionsWithMetadata: [Decision, Hiveling][] = [];
  for (const hiveling of shuffledHivelings) {
    decisionsWithMetadata.push(
      await takeDecision(rng.int32(), entities, hivelingMind, hiveling)
    );
  }

  return decisionsWithMetadata.reduce(applyDecision, {
    ...state,
    entities,
    rngState: rng.state()
  });
};
