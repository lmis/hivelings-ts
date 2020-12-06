import { Rotation, Position } from "hivelings/types/common";
import { Entity, Hiveling, isHiveling } from "hivelings/types/simulation";
import {
  Entity as PlayerEntity,
  Hiveling as PlayerHiveling
} from "hivelings/types/player";

export const addRotations = (a: Rotation, b: Rotation): Rotation => {
  return (Rotation[
    ((a as number) + (b as number)) % Object.keys(Rotation).length
  ] as unknown) as Rotation;
};
const relativePosition = ([ox, oy]: Position, [x, y]: Position): Position => [
  ox - x,
  oy - y
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

const transformPosition = (
  orientation: Rotation,
  origin: Position,
  p: Position
): Position => inverseRotatePosition(orientation, relativePosition(origin, p));

export const hivelingForPlayer = ({
  position,
  zIndex,
  entityType,
  hasNutrition,
  spreadsPheromones,
  recentDecisions,
  memory
}: Hiveling): PlayerHiveling => ({
  position,
  zIndex,
  entityType,
  hasNutrition,
  spreadsPheromones,
  recentDecisions,
  memory
});

export const entityForPlayer = (orientation: Rotation, origin: Position) => (
  e: Entity
): PlayerEntity => {
  const { position, zIndex, entityType } = e;
  const details = isHiveling(e) ? hivelingForPlayer(e) : {};
  return {
    ...details,
    position: transformPosition(orientation, origin, position),
    zIndex,
    entityType
  };
};
