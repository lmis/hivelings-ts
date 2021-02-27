import { EntityType, Rotation } from "hivelings/types/common";
import { Position } from "utils";

export interface EntityBase {
  position: Position;
  zIndex: number;
}

export interface HivelingDetails {
  type: EntityType.HIVELING;
  hasNutrition: boolean;
}
export interface CurrentHivelingDetails extends HivelingDetails {
  memory64: string;
}

export type Hiveling = EntityBase & HivelingDetails;
export type CurrentHiveling = EntityBase & CurrentHivelingDetails;

export interface TrailDetails {
  type: EntityType.TRAIL;
  lifetime: number;
  orientation: Rotation;
}
export type Trail = EntityBase & TrailDetails;

export type Entity = EntityBase &
  (
    | Hiveling
    | Trail
    | { type: EntityType.NUTRITION }
    | { type: EntityType.HIVE_ENTRANCE }
    | { type: EntityType.OBSTACLE }
  );

export const isHiveling = (e: Entity): e is Hiveling =>
  e.type === EntityType.HIVELING;
