// Draw the placement histories on a canvas. Autoscale to the data bounds
// with a 1-cell margin (mirrors the matplotlib bounds logic, main.py 160-161).
export function render(canvas, histories, colors) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (const h of histories) {
    for (const [x, y] of h) {
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;
    }
  }
  if (!isFinite(xmin)) return; // nothing to draw

  xmin -= 1; xmax += 1; ymin -= 1; ymax += 1;
  const spanX = xmax - xmin + 1;
  const spanY = ymax - ymin + 1;

  const pad = 10;
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
  const ox = (W - spanX * scale) / 2;
  const oy = (H - spanY * scale) / 2;
  const px = (x) => ox + (x - xmin + 0.5) * scale;
  const py = (y) => H - (oy + (y - ymin + 0.5) * scale); // flip: math up = screen up

  // Faint grid, only when cells are big enough to be useful.
  if (scale > 4) {
    ctx.strokeStyle = "#dddddd";
    ctx.lineWidth = 0.5;
    for (let gx = xmin; gx <= xmax + 1; gx++) {
      ctx.beginPath();
      ctx.moveTo(px(gx - 0.5), py(ymin - 0.5));
      ctx.lineTo(px(gx - 0.5), py(ymax + 0.5));
      ctx.stroke();
    }
    for (let gy = ymin; gy <= ymax + 1; gy++) {
      ctx.beginPath();
      ctx.moveTo(px(xmin - 0.5), py(gy - 0.5));
      ctx.lineTo(px(xmax + 0.5), py(gy - 0.5));
      ctx.stroke();
    }
  }

  const r = Math.max(1.5, Math.min(6, scale * 0.35));
  for (let i = 0; i < histories.length; i++) {
    ctx.fillStyle = colors[i];
    for (const [x, y] of histories[i]) {
      ctx.beginPath();
      ctx.arc(px(x), py(y), r, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}
