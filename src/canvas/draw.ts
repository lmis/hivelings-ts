/* eslint-disable no-undef, @typescript-eslint/no-unused-vars */
import { Position } from "utils";

interface CommonParams {
  ctx: CanvasRenderingContext2D;
  alpha: number;
  flipped: boolean;
  image: CanvasImageSource;
  angle: number;
  position: [number, number];
}
export const drawImage = ({
  ctx,
  alpha,
  flipped,
  image,
  width,
  height,
  angle,
  position: [x, y]
}: CommonParams & { width: number; height: number }) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (flipped) {
    ctx.scale(-1, 1);
  }
  ctx.rotate(angle);
  ctx.translate(-x, -y);
  ctx.drawImage(image, x - width / 2, y - height / 2, width, height);
  ctx.restore();
};

export const drawLine = (
  ctx: CanvasRenderingContext2D,
  [xStart, yStart]: Position,
  [xEnd, yEnd]: Position,
  strokeStyle: CanvasRenderingContext2D["strokeStyle"]
) => {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(xStart, yStart);
  ctx.lineTo(xEnd, yEnd);
  ctx.strokeStyle = strokeStyle;
  ctx.stroke();
  ctx.restore();
};

export const drawGrid = ({
  ctx,
  width,
  height,
  xCells,
  yCells,
  topLeft,
  strokeStyle
}: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  xCells: number;
  yCells: number;
  topLeft: Position;
  strokeStyle: CanvasRenderingContext2D["strokeStyle"];
}) => {
  const xMin = topLeft[0] - width / 2;
  const xMax = xMin + xCells * width;
  const yMin = topLeft[1] - width / 2;
  const yMax = yMin + yCells * height;

  for (let i = 0; i <= xCells; ++i) {
    const x = xMin + i * width;
    drawLine(ctx, [x, yMin], [x, yMax], strokeStyle);
  }
  for (let i = 0; i <= yCells; ++i) {
    const y = yMin + i * height;
    drawLine(ctx, [xMin, y], [xMax, y], strokeStyle);
  }
};