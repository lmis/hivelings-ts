import { Entity, Hiveling } from "hivelings/types/player";
export type Position = [number, number];

export enum Rotation {
  NONE,
  CLOCKWISE,
  BACK,
  COUNTERCLOCKWISE
}

export enum EntityType {
  HIVELING,
  NUTRITION,
  OBSTACLE,
  PHEROMONE,
  HIVE_ENTRANCE
}

export enum DecisionType {
  REMEMBER_128_CHARACTERS,
  TURN,
  MOVE,
  PICKUP,
  DROP
}
export type Decision =
  | { type: DecisionType.REMEMBER_128_CHARACTERS; message: string }
  | { type: DecisionType.TURN; rotation: Rotation }
  | { type: DecisionType.DROP }
  | { type: DecisionType.MOVE }
  | { type: DecisionType.PICKUP };

export interface Input {
  closeEntities: Entity[];
  currentHiveling: Hiveling;
  randomSeed: number;
}

export type HivelingMind = (input: Input) => Promise<Decision>;
