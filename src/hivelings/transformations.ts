import { Position } from "utils";

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

export const rotate = (degrees: number, [x, y]: Position): Position => {
  const radians = toRad(degrees);
  return [
    x * cos(radians) + y * sin(radians),
    -x * sin(radians) + y * cos(radians)
  ];
};

export const toHivelingFrameOfReference = (
  [ox, oy]: Position,
  orientation: number,
  [x, y]: Position
): Position => rotate(-orientation, [x - ox, y - oy]);

export const fromHivelingFrameOfReference = (
  [ox, oy]: Position,
  orientation: number,
  p: Position
): Position => {
  const [x, y] = rotate(orientation, p);
  return [x + ox, y + oy];
};
