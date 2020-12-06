import { Rotation, EntityType } from "hivelings/types/common";
import {
  Entity as PlayerEntity,
  Hiveling as PlayerHiveling
} from "hivelings/types/player";
import { State } from "seedrandom";

export interface Entity extends PlayerEntity {
  identifier: number;
  highlighted: boolean;
}

export type Hiveling = PlayerHiveling &
  Entity & {
    // Rotation w.r.t North
    orientation: Rotation;
  };

export interface GameState {
  entities: Entity[];
  nextId: number;
  score: number;
  rngState: State;
}

export const isHiveling = (e: Entity): e is Hiveling =>
  e.entityType === EntityType.HIVELING;
