import { EntityType } from "hivelings/types/common";
import { RngState } from "rng/laggedFibo";
import { Position } from "utils";

export interface Hiveling {
  identifier: number;
  midpoint: Position;
  radius: number;
  orientation: number; // Degrees w.r.t North
  zIndex: number;
  type: EntityType.HIVELING;
  hasFood: boolean;
  memory: unknown | null;
  show?: string;
}

export interface Trail {
  identifier: number;
  hivelingId: number;
  midpoint: Position;
  radius: number;
  zIndex: number;
  type: EntityType.TRAIL;
  lifetime: number;
  orientation: number;
}

export interface Food {
  identifier: number;
  midpoint: Position;
  radius: number;
  zIndex: number;
  type: EntityType.FOOD;
}

export interface Obstacle {
  identifier: number;
  midpoint: Position;
  style: "treeStump" | "rocks";
  radius: number;
  zIndex: number;
  type: EntityType.OBSTACLE;
}

export interface HiveEntrance {
  identifier: number;
  midpoint: Position;
  radius: number;
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
  rngState: RngState;
}

export const isHiveling = (e: Entity): e is Hiveling =>
  e.type === EntityType.HIVELING;

export interface Input {
  visibilityEndpoints: Position[];
  maxMoveDistance: number;
  interactableEntities: Entity[];
  visibleEntities: Entity[];
  memory: unknown | null;
  hasFood: boolean;
  randomSeed: string;
}
