import { EntityType } from "hivelings/types/common";
import { Position } from "utils";

export interface Hiveling {
  position: Position;
  zIndex: number;
  type: EntityType.HIVELING;
  hasFood: boolean;
}

export interface Trail {
  position: Position;
  zIndex: number;
  type: EntityType.TRAIL;
  lifetime: number;
  orientation: number;
}

export interface Food {
  position: Position;
  zIndex: number;
  type: EntityType.FOOD;
}

export interface Obstacle {
  position: Position;
  zIndex: number;
  type: EntityType.OBSTACLE;
}

export interface HiveEntrance {
  position: Position;
  zIndex: number;
  type: EntityType.HIVE_ENTRANCE;
}

export type Entity = Hiveling | Trail | Food | HiveEntrance | Obstacle;

export const isHiveling = (e: Entity): e is Hiveling =>
  e.type === EntityType.HIVELING;

export interface Input<T> {
  maxMoveDistance: number;
  interactableEntities: Entity[];
  visibleEntities: Entity[];
  currentHiveling: Hiveling;
  memory: T | null;
  randomSeed: string;
}
