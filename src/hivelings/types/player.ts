import { Position, Decision, EntityType } from "hivelings/types/common";

export interface Entity {
  position: Position;
  zIndex: number;
  entityType: EntityType;
}

export interface Hiveling extends Entity {
  entityType: EntityType.HIVELING;
  hasNutrition: boolean;
  spreadsPheromones: boolean;
  recentDecisions: Decision[];
  memory: String;
}

export const isHiveling = (e: Entity): e is Hiveling =>
  e.entityType === EntityType.HIVELING;
