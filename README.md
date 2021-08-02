# What is this?
Hivelings is a game that you play by programming - in any language you choose! Control a hive mind by writing a websockets-server that receives the sensory input of each Hiveling and responds with a decision. Each individual in the hive mind acts independentaly but according to the same logic. Can you make them thrive?

# How to Play
To play the game you must implement a server that can understand and respond via websockets. In each iteration the server will receive one message per Hiveling. The following type definitions should help you understand the shape of input and expected output. Each message sent to your server will contain a string content with a JSON adhering to the `Input` type below. In turn, the game will await a response containing a JSON string adhereing to the `Output` type below.

```
export type Position = [number, number];
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
  | { type: DecisionType.PICKUP; index: number }
  | { type: DecisionType.WAIT };

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

export interface Output<T> {
  decision: Decision;
  memory: T;
  show?: string;
}
```

A simple example of a valid response would be `'{"decision":{"type":"TURN","degrees":90},"memory":""}'` where the type parameter `T` for the `memory` field is `String`.
