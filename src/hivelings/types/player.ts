import { EntityType } from "hivelings/types/common";
import { Position } from "utils";

export interface Hiveling {
  midpoint: Position;
  zIndex: number;
  type: EntityType.HIVELING;
  carriedType: EntityType | null;
}

export interface Trail {
  midpoint: Position;
  zIndex: number;
  type: EntityType.TRAIL;
  lifetime: number;
  orientation: number;
}

export interface Food {
  midpoint: Position;
  zIndex: number;
  type: EntityType.FOOD;
}

export interface Obstacle {
  midpoint: Position;
  zIndex: number;
  type: EntityType.OBSTACLE;
}

export interface HiveEntrance {
  midpoint: Position;
  zIndex: number;
  type: EntityType.HIVE_ENTRANCE;
}

export type Entity = Hiveling | Trail | Food | HiveEntrance | Obstacle;

export interface Input<T> {
  maxMoveDistance: number;
  interactableEntities: Entity[];
  visibleEntities: Entity[];
  carriedType: EntityType | null;
  memory: T | null;
  randomSeed: string;
}
