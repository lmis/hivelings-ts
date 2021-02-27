import { Entity, CurrentHiveling } from "hivelings/types/player";

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
  TURN = "TURN",
  MOVE = "MOVE",
  PICKUP = "PICKUP",
  DROP = "DROP",
  WAIT = "WAIT"
}

export type Decision =
  | { type: DecisionType.TURN; rotation: Rotation }
  | { type: DecisionType.DROP }
  | { type: DecisionType.MOVE }
  | { type: DecisionType.PICKUP }
  | { type: DecisionType.WAIT };

export interface Input {
  visibleEntities: Entity[];
  currentHiveling: CurrentHiveling;
  randomSeed: string;
}

export interface Output {
  decision: Decision;
  memory64: String;
}

export type HivelingMind = (input: Input) => Promise<Output>;
