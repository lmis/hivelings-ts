import { EntityType } from "hivelings/types/common";
import { Position } from "utils";

export interface EntityBase {
  position: Position;
  zIndex: number;
}

export interface HivelingDetails {
  type: EntityType.HIVELING;
  hasFood: boolean;
}
export interface CurrentHivelingDetails extends HivelingDetails {
  memory64: string;
}

export type Hiveling = EntityBase & HivelingDetails;
export type CurrentHiveling = EntityBase & CurrentHivelingDetails;

export interface TrailDetails {
  type: EntityType.TRAIL;
  lifetime: number;
  orientation: number;
}
export type Trail = EntityBase & TrailDetails;

export type Entity = EntityBase &
  (
    | Hiveling
    | Trail
    | { type: EntityType.FOOD }
    | { type: EntityType.HIVE_ENTRANCE }
    | { type: EntityType.OBSTACLE }
  );

export const isHiveling = (e: Entity): e is Hiveling =>
  e.type === EntityType.HIVELING;
