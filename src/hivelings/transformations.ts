import { EntityType } from "hivelings/types/common";
import { Entity, Hiveling } from "hivelings/types/simulation";
import { Entity as PlayerEntity } from "hivelings/types/player";
import { Position } from "utils";

const { HIVELING, TRAIL } = EntityType;
const { cos, sin } = Math;

export const toDeg = (radians: number): number =>
  (radians >= 0 ? (radians / Math.PI) * 180 : 360 - toDeg(-radians)) % 360;
export const toRad = (degrees: number): number =>
  (degrees >= 0 ? (degrees / 180) * Math.PI : 2 * Math.PI - toRad(-degrees)) %
  360;

export const degreeDiff = (a: number, b: number) => {
  const d1 = a - b;
  if (d1 > 180) {
    return 360 - d1;
  } else if (d1 < -180) {
    return -(d1 + 360);
  } else {
    return d1;
  }
};

export const relativePosition = (
  [ox, oy]: Position,
  [x, y]: Position
): Position => [x - ox, y - oy];

export const rotate = (degrees: number, [x, y]: Position): Position => {
  const radians = toRad(degrees);
  return [
    x * cos(radians) + y * sin(radians),
    -x * sin(radians) + y * cos(radians)
  ];
};

export const toHivelingFrameOfReference = (
  hiveling: Hiveling,
  p: Position
): Position =>
  rotate(-hiveling.orientation, relativePosition(hiveling.position, p));

export const fromHivelingFrameOfReference = (
  hiveling: Hiveling,
  p: Position
): Position => {
  const [x, y] = rotate(hiveling.orientation, p);
  return [x + hiveling.position[0], y + hiveling.position[1]];
};

export const stripSimulationProperties = (e: Entity): PlayerEntity => {
  const base = {
    position: e.position,
    zIndex: e.zIndex
  };

  switch (e.type) {
    case HIVELING:
      return {
        ...base,
        type: e.type,
        hasFood: e.hasFood
      };
    case TRAIL:
      return {
        ...base,
        type: e.type,
        lifetime: e.lifetime,
        orientation: e.orientation
      };
    default:
      return { ...base, type: e.type };
  }
};
export const entityForPlayer = (
  hiveling: Hiveling,
  e: Entity
): PlayerEntity => {
  const playerEntity = stripSimulationProperties(e);
  if ("position" in playerEntity) {
    playerEntity.position = toHivelingFrameOfReference(
      hiveling,
      playerEntity.position
    );
  }
  if ("orientation" in playerEntity) {
    playerEntity.orientation = degreeDiff(
      playerEntity.orientation,
      hiveling.orientation
    );
  }
  return playerEntity;
};
