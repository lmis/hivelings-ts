import { Rotation } from "hivelings/types/common";
import { Entity } from "hivelings/types/simulation";
import { Entity as PlayerEntity } from "hivelings/types/player";
import { Position } from "utils";

const { NONE, CLOCKWISE, BACK, COUNTERCLOCKWISE } = Rotation;
export const toDeg = (rotation: Rotation): number => {
  switch (rotation) {
    case NONE:
      return 0;
    case CLOCKWISE:
      return 90;
    case BACK:
      return 180;
    case COUNTERCLOCKWISE:
      return 270;
  }
};

export const fromDeg = (degrees: number): Rotation => {
  switch (degrees) {
    case 0:
      return NONE;
    case 90:
      return CLOCKWISE;
    case 180:
      return BACK;
    case 270:
      return COUNTERCLOCKWISE;
    default:
      throw new Error(`${degrees} is not convertable to Rotation`);
  }
};

export const addRotations = (a: Rotation, b: Rotation): Rotation => {
  return fromDeg((toDeg(a) + toDeg(b)) % 360);
};

const relativePosition = ([ox, oy]: Position, [x, y]: Position): Position => [
  x - ox,
  y - oy
];

const inverseRotatePosition = (
  rotation: Rotation,
  [x, y]: Position
): Position => {
  switch (rotation) {
    case Rotation.NONE:
      return [x, y];
    case Rotation.CLOCKWISE:
      return [-y, x];
    case Rotation.COUNTERCLOCKWISE:
      return [y, -x];
    case Rotation.BACK:
      return [-x, -y];
  }
};

export const entityForPlayer = (orientation: Rotation, origin: Position) => (
  e: Entity & { orientation?: Rotation }
): PlayerEntity => {
  const { identifier, highlighted, position, orientation: __, ...rest } = e;

  return {
    position: inverseRotatePosition(
      orientation,
      relativePosition(origin, position)
    ),
    ...rest
  };
};
