// Draw hex placement histories on a canvas: autoscale to the data bounds in
// Cartesian space, then fill a pointy-top hexagon at each cell's center.
import { hexToCartesian } from "./hexspiral.js";

// Corners of a pointy-top hexagon of circumradius 1, centered at the origin.
// circumradius 1 matches hexToCartesian's spacing, so neighbours abut exactly.
const CORNERS = [];
for (let k = 0; k < 6; k++) {
  const a = (Math.PI / 180) * (60 * k - 30);
  CORNERS.push([Math.cos(a), Math.sin(a)]);
}

export function hexRender(canvas, histories, colors) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Work in Cartesian space (hex centers), then autoscale to the data bounds
  // with a one-hex margin.
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (const h of histories) {
    for (const p of h) {
      const [x, y] = hexToCartesian(p);
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;
    }
  }
  if (!isFinite(xmin)) return; // nothing to draw

  xmin -= 1; xmax += 1; ymin -= 1; ymax += 1;
  const spanX = xmax - xmin;
  const spanY = ymax - ymin;

  const pad = 10;
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
  const ox = (W - spanX * scale) / 2;
  const oy = (H - spanY * scale) / 2;
  const px = (x) => ox + (x - xmin) * scale;
  const py = (y) => H - (oy + (y - ymin) * scale); // flip: math up = screen up

  // At small scales a full hexagon polygon is sub-pixel and disappears; fall
  // back to a 1px dot so dense runs stay visible.
  const tiny = scale < 1.2;

  for (let i = 0; i < histories.length; i++) {
    ctx.fillStyle = colors[i];
    ctx.strokeStyle = colors[i]; // seal hairline seams between hexes
    ctx.lineWidth = 1;
    for (const p of histories[i]) {
      const [cx, cy] = hexToCartesian(p);
      const sx = px(cx);
      const sy = py(cy);
      if (tiny) {
        ctx.fillRect(sx, sy, 1, 1);
        continue;
      }
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const vx = px(cx + CORNERS[k][0]);
        const vy = py(cy + CORNERS[k][1]);
        if (k === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}
