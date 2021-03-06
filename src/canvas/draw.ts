/* eslint-disable no-undef, @typescript-eslint/no-unused-vars */
import { Position } from "utils";

interface DrawImageParams {
  ctx: CanvasRenderingContext2D;
  alpha: number;
  image: CanvasImageSource;
  angle: number;
  position: [number, number];
  width: number;
  height: number;
}
export const drawImage = ({
  ctx,
  alpha,
  image,
  width,
  height,
  angle,
  position: [x, y]
}: DrawImageParams) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
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

export const drawRect = ({
  ctx,
  width,
  height,
  fillStyle,
  position: [x, y]
}: {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  fillStyle: CanvasRenderingContext2D["fillStyle"];
  position: Position;
}) => {
  ctx.save();
  ctx.fillStyle = fillStyle;
  ctx.fillRect(x - width / 2, y - height / 2, width, height);
  ctx.restore();
};

export const drawTextbox = ({
  ctx,
  position: [x, y],
  lines
}: {
  ctx: CanvasRenderingContext2D;
  position: Position;
  lines: string[];
}) => {
  const borderThickness = 2;
  const lineheight = 18;
  const font = `${lineheight}px Georgia`;
  const yPadding = 10;
  const yOffset = lineheight * lines.length;
  const height = yOffset + yPadding;
  const width =
    (lineheight / 2) * Math.min(240, Math.max(...lines.map((l) => l.length)));

  ctx.save();
  // Border
  drawRect({
    ctx,
    fillStyle: "white",
    width,
    height,
    position: [x, y - yOffset]
  });
  // Background
  drawRect({
    ctx,
    fillStyle: "black",
    width: width - borderThickness,
    height: height - borderThickness,
    position: [x, y - yOffset]
  });

  ctx.fillStyle = "white";
  ctx.font = font;
  lines.forEach((text, i) => {
    ctx.fillText(
      text,
      x - width / 2 + borderThickness,
      y - height / 2 - yOffset + (i + 1) * lineheight + borderThickness,
      width - borderThickness
    );
  });
  ctx.restore();
};
