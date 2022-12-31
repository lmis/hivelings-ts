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
  sortBy(c => c.zIndex, renderBuffer).forEach(({ action }) => {
    action(ctx);
  });
};

export const drawImage = ({
  renderBuffer,
  image,
  width,
  height,
  angle,
  position: [x, y],
  zIndex
}: {
  renderBuffer: RenderBuffer;
  image: CanvasImageSource;
  angle: number;
  position: [number, number];
  width: number;
  height: number;
  zIndex: number;
}) => {
  renderBuffer.push({
    action: ctx => {
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

export const drawRepeatingImage = ({
  renderBuffer,
  image,
  brightness,
  position: [x, y],
  scale,
  width,
  height,
  zIndex
}: {
  renderBuffer: RenderBuffer;
  image: CanvasImageSource;
  brightness: number;
  position: [number, number];
  scale: number;
  width: number;
  height: number;
  zIndex: number;
}) => {
  renderBuffer.push({
    action: ctx => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.filter = `brightness(${brightness})`;
      ctx.fillStyle = ctx.createPattern(image, "repeat")!;
      ctx.fillRect(0 - x / scale, 0 - y / scale, width / scale, height / scale);
      ctx.restore();
    },
    zIndex
  });
};

export const drawWedge = ({
  renderBuffer,
  start: [x, y],
  angleStart,
  angleEnd,
  radius,
  fillStyle,
  zIndex
}: {
  renderBuffer: RenderBuffer;
  start: Position;
  angleStart: number;
  angleEnd: number;
  radius: number;
  fillStyle: CanvasRenderingContext2D["fillStyle"];
  zIndex: number;
}) => {
  renderBuffer.push({
    action: ctx => {
      // Translate angles such that 0 is upwards
      const startAngle = angleStart - Math.PI / 2;
      const endAngle = angleEnd - Math.PI / 2;
      ctx.save();
      ctx.fillStyle = fillStyle;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(
        x + Math.cos(startAngle) * radius,
        y + Math.sin(startAngle) * radius
      );
      ctx.arc(x, y, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
    zIndex
  });
};
export const drawLine = ({
  renderBuffer,
  start: [xStart, yStart],
  end: [xEnd, yEnd],
  strokeStyle,
  zIndex
}: {
  renderBuffer: RenderBuffer;
  start: Position;
  end: Position;
  strokeStyle: CanvasRenderingContext2D["strokeStyle"];
  zIndex: number;
}) => {
  renderBuffer.push({
    action: ctx => {
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

export const drawCircle = ({
  renderBuffer,
  radius,
  fillStyle,
  strokeStyle,
  lineWidth = 1,
  position: [x, y],
  zIndex
}: {
  renderBuffer: RenderBuffer;
  radius: number;
  fillStyle?: CanvasRenderingContext2D["fillStyle"];
  strokeStyle?: CanvasRenderingContext2D["strokeStyle"];
  lineWidth?: number;
  position: Position;
  zIndex: number;
}) => {
  renderBuffer.push({
    action: ctx => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
      }
      if (strokeStyle) {
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = strokeStyle;
        ctx.stroke();
      }
      ctx.restore();
    },
    zIndex
  });
};

export const drawAxisAlignedRect = ({
  renderBuffer,
  left,
  top,
  width,
  height,
  fillStyle,
  zIndex
}: {
  renderBuffer: RenderBuffer;
  left: number;
  top: number;
  width: number;
  height: number;
  fillStyle: CanvasRenderingContext2D["fillStyle"];
  zIndex: number;
}) => {
  renderBuffer.push({
    action: ctx => {
      ctx.save();
      ctx.fillStyle = fillStyle;
      ctx.fillRect(left, top, width, height);
      ctx.restore();
    },
    zIndex
  });
};

export const drawTextbox = ({
  renderBuffer,
  top,
  left,
  lines,
  lineHeight,
  bottomPadding,
  leftPadding,
  width,
  zIndex
}: {
  renderBuffer: RenderBuffer;
  left: number;
  top: number;
  width: number;
  lineHeight: number;
  bottomPadding: number;
  leftPadding: number;
  lines: string[];
  zIndex: number;
}) => {
  const borderThickness = 2;
  const font = `${lineHeight}px Mono`;
  const rightPadding = leftPadding;
  const height = lineHeight * lines.length + bottomPadding;

  // Border
  drawAxisAlignedRect({
    renderBuffer,
    fillStyle: "white",
    width,
    height,
    top,
    left,
    zIndex: zIndex - 0.5
  });
  // Background
  drawAxisAlignedRect({
    renderBuffer,
    fillStyle: "rgb(102,51,0)",
    width: width - borderThickness,
    height: height - borderThickness,
    top: top + borderThickness / 2,
    left: left + borderThickness / 2,
    zIndex: zIndex - 0.3
  });

  renderBuffer.push({
    action: ctx => {
      ctx.save();
      ctx.fillStyle = "white";
      ctx.font = font;
      lines.forEach((text, i) => {
        ctx.fillText(
          text,
          left + borderThickness / 2 + leftPadding,
          top + (i + 1) * lineHeight + borderThickness / 2,
          width - borderThickness / 2 - leftPadding - rightPadding
        );
      });
      ctx.restore();
    },
    zIndex
  });
};
