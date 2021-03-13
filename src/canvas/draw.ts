/* eslint-disable no-undef, @typescript-eslint/no-unused-vars */
import { Position, sortBy } from "utils";

interface RenderCommand {
  action: (ctx: CanvasRenderingContext2D) => void;
  zIndex: number;
}
export type RenderBuffer = RenderCommand[];
export const initializeRenderBuffer = (): RenderBuffer => [];
export const flush = (
  ctx: CanvasRenderingContext2D,
  renderBuffer: RenderBuffer
) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  sortBy((c) => c.zIndex, renderBuffer).forEach(({ action }) => {
    action(ctx);
  });
};

interface DrawImageParams {
  renderBuffer: RenderBuffer;
  image: CanvasImageSource;
  angle: number;
  position: [number, number];
  width: number;
  height: number;
  zIndex: number;
}
export const drawImage = ({
  renderBuffer,
  image,
  width,
  height,
  angle,
  position: [x, y],
  zIndex
}: DrawImageParams) => {
  renderBuffer.push({
    action: (ctx) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.translate(-x, -y);
      ctx.drawImage(image, x - width / 2, y - height / 2, width, height);
      ctx.restore();
    },
    zIndex
  });
};

export const drawLine = (
  renderBuffer: RenderBuffer,
  [xStart, yStart]: Position,
  [xEnd, yEnd]: Position,
  strokeStyle: CanvasRenderingContext2D["strokeStyle"],
  zIndex: number
) => {
  renderBuffer.push({
    action: (ctx) => {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(xStart, yStart);
      ctx.lineTo(xEnd, yEnd);
      ctx.strokeStyle = strokeStyle;
      ctx.stroke();
      ctx.restore();
    },
    zIndex
  });
};

export const drawGrid = ({
  renderBuffer,
  width,
  height,
  xCells,
  yCells,
  topLeft,
  strokeStyle,
  zIndex
}: {
  renderBuffer: RenderBuffer;
  width: number;
  height: number;
  xCells: number;
  yCells: number;
  topLeft: Position;
  strokeStyle: CanvasRenderingContext2D["strokeStyle"];
  zIndex: number;
}) => {
  const xMin = topLeft[0] - width / 2;
  const xMax = xMin + xCells * width;
  const yMin = topLeft[1] - width / 2;
  const yMax = yMin + yCells * height;

  for (let i = 0; i <= xCells; ++i) {
    const x = xMin + i * width;
    drawLine(renderBuffer, [x, yMin], [x, yMax], strokeStyle, zIndex);
  }
  for (let i = 0; i <= yCells; ++i) {
    const y = yMin + i * height;
    drawLine(renderBuffer, [xMin, y], [xMax, y], strokeStyle, zIndex);
  }
};

export const drawRect = ({
  renderBuffer,
  width,
  height,
  fillStyle,
  position: [x, y],
  zIndex
}: {
  renderBuffer: RenderBuffer;
  width: number;
  height: number;
  fillStyle: CanvasRenderingContext2D["fillStyle"];
  position: Position;
  zIndex: number;
}) => {
  renderBuffer.push({
    action: (ctx) => {
      ctx.save();
      ctx.fillStyle = fillStyle;
      ctx.fillRect(x - width / 2, y - height / 2, width, height);
      ctx.restore();
    },
    zIndex
  });
};

export const drawCircle = ({
  renderBuffer,
  radius,
  fillStyle,
  position: [x, y],
  zIndex
}: {
  renderBuffer: RenderBuffer;
  radius: number;
  fillStyle: CanvasRenderingContext2D["fillStyle"];
  position: Position;
  zIndex: number;
}) => {
  renderBuffer.push({
    action: (ctx) => {
      ctx.save();
      ctx.fillStyle = fillStyle;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    },
    zIndex
  });
};

export const drawTextbox = ({
  renderBuffer,
  position: [x, y],
  lines,
  zIndex
}: {
  renderBuffer: RenderBuffer;
  position: Position;
  lines: string[];
  zIndex: number;
}) => {
  const borderThickness = 2;
  const lineheight = 18;
  const font = `${lineheight}px Georgia`;
  const yPadding = 10;
  const yOffset = 25 + 0.5 * lines.length * lineheight;
  const height = lineheight * lines.length + yPadding;
  const width =
    (lineheight / 2) * Math.min(240, Math.max(...lines.map((l) => l.length)));

  // Border
  drawRect({
    renderBuffer,
    fillStyle: "white",
    width,
    height,
    position: [x, y - yOffset],
    zIndex: zIndex - 0.5
  });
  // Background
  drawRect({
    renderBuffer,
    fillStyle: "black",
    width: width - borderThickness,
    height: height - borderThickness,
    position: [x, y - yOffset],
    zIndex: zIndex - 0.3
  });

  renderBuffer.push({
    action: (ctx) => {
      ctx.save();
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
    },
    zIndex
  });
};
