import { EntityType } from "hivelings/types/common";
import { Rng } from "rng/laggedFibo";
import { Position } from "utils";

export interface Hiveling {
  identifier: number;
  position: Position;
  orientation: number; // Degrees w.r.t North
  zIndex: number;
  type: EntityType.HIVELING;
  hasFood: boolean;
  memory64: string;
}

export interface Trail {
  identifier: number;
  hivelingId: number;
  position: Position;
  zIndex: number;
  type: EntityType.TRAIL;
  lifetime: number;
  orientation: number;
}

export interface Food {
  identifier: number;
  position: Position;
  zIndex: number;
  type: EntityType.FOOD;
}

export interface Obstacle {
  identifier: number;
  position: Position;
  zIndex: number;
  type: EntityType.OBSTACLE;
}

export interface HiveEntrance {
  identifier: number;
  position: Position;
  zIndex: number;
  type: EntityType.HIVE_ENTRANCE;
}

export type Entity = Hiveling | Trail | Food | HiveEntrance | Obstacle;

type Insert<T> = Omit<Omit<T, "zIndex">, "identifier">;
export type EntityInsert =
  | Insert<Hiveling>
  | Insert<Trail>
  | Insert<Food>
  | Insert<HiveEntrance>
  | Insert<Obstacle>;

export interface SimulationState {
  entities: Entity[];
  nextId: number;
  score: number;
  rng: Rng;
}

export const isHiveling = (e: Entity): e is Hiveling =>
  e.type === EntityType.HIVELING;

export interface Input {
  maxMoveDistance: number;
  interactableEntities: Entity[];
  visibleEntities: Entity[];
  currentHiveling: Hiveling;
  origin: Position;
  orientation: number;
  randomSeed: string;
}
