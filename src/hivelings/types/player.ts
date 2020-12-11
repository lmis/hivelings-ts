import { Decision, EntityType } from "hivelings/types/common";
import { Position } from "utils";

export interface EntityBase {
  position: Position;
  zIndex: number;
}

export interface HivelingDetails {
  type: EntityType.HIVELING;
  hasNutrition: boolean;
  spreadsPheromones: boolean;
  recentDecisions: Decision[];
  memory: String;
}
export type Hiveling = EntityBase & HivelingDetails;

export type Entity = EntityBase &
  (
    | Hiveling
    | { type: EntityType.NUTRITION }
    | { type: EntityType.HIVE_ENTRANCE }
    | { type: EntityType.PHEROMONE }
    | { type: EntityType.OBSTACLE }
  );

export const isHiveling = (e: Entity): e is Hiveling =>
  e.type === EntityType.HIVELING;
