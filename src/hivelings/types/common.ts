export enum EntityType {
  HIVELING = "HIVELING",
  FOOD = "FOOD",
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
  | { type: DecisionType.TURN; degrees: number }
  | { type: DecisionType.DROP }
  | { type: DecisionType.MOVE; distance: number }
  | { type: DecisionType.PICKUP }
  | { type: DecisionType.WAIT };

export interface Output<T> {
  decision: Decision;
  memory: T;
  show?: string;
}
