import { Rotation, EntityType } from "hivelings/types/common";
import {
  EntityBase as PlayerEntityBase,
  HivelingDetails as PlayerHivelingDetails,
  TrailDetails as PlayerTrailDetails
} from "hivelings/types/player";
import { RngState } from "rng/laggedFibo";
import { Position } from "utils";

export interface EntityBase extends PlayerEntityBase {
  identifier: number;
  highlighted: boolean;
}

export interface HivelingDetails extends PlayerHivelingDetails {
  // Rotation w.r.t North
  orientation: Rotation;
}
export type Hiveling = EntityBase & HivelingDetails;

export type TrailDetails = PlayerTrailDetails;
export type Trail = EntityBase & TrailDetails;

export type Entity = EntityBase &
  (
    | Hiveling
    | Trail
    | { type: EntityType.NUTRITION }
    | { type: EntityType.HIVE_ENTRANCE }
    | { type: EntityType.OBSTACLE }
  );

export type EntityDetails =
  | HivelingDetails
  | TrailDetails
  | { type: EntityType.NUTRITION }
  | { type: EntityType.HIVE_ENTRANCE }
  | { type: EntityType.OBSTACLE };

export type EntityDetailsWithPosition = EntityDetails & { position: Position };

export interface GameState {
  entities: Entity[];
  nextId: number;
  score: number;
  rngState: RngState;
}

export const isHiveling = (e: Entity): e is Hiveling =>
  e.type === EntityType.HIVELING;
