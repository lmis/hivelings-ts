import { Entity, Hiveling } from "hivelings/types/player";

export enum Rotation {
  NONE = "NONE",
  CLOCKWISE = "CLOCKWISE",
  BACK = "BACK",
  COUNTERCLOCKWISE = "COUNTERCLOCKWISE"
}

export enum EntityType {
  HIVELING = "HIVELING",
  NUTRITION = "NUTRITION",
  OBSTACLE = "OBSTACLE",
  TRAIL = "TRAIL",
  HIVE_ENTRANCE = "HIVE_ENTRANCE"
}

export enum DecisionType {
  REMEMBER_128_CHARACTERS = "REMEMBER_128_CHARACTERS",
  TURN = "TURN",
  MOVE = "MOVE",
  PICKUP = "PICKUP",
  DROP = "DROP",
  WAIT = "WAIT"
}
export type Decision =
  | { type: DecisionType.REMEMBER_128_CHARACTERS; message: string }
  | { type: DecisionType.TURN; rotation: Rotation }
  | { type: DecisionType.DROP }
  | { type: DecisionType.MOVE }
  | { type: DecisionType.PICKUP }
  | { type: DecisionType.WAIT };

export interface Input {
  closeEntities: Entity[];
  currentHiveling: Hiveling;
  randomSeed: string;
}

export type HivelingMind = (input: Input) => Promise<Decision>;
