// A deliberately plain line chart (no chart library, matching the project's
// "as bland as OEIS" convention). One polyline per player: x is the placement
// number (1st, 2nd, ... piece that player dropped), y is that square's index
// along the spiral. Drawn on its own <canvas> the same way render.js draws.
export function renderChart(canvas, indexHistories, colors) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  let maxX = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const h of indexHistories) {
    if (h.length > maxX) maxX = h.length;
    for (const v of h) {
      if (v < minY) minY = v;
      if (v > maxY) maxY = v;
    }
  }
  if (maxX === 0 || !isFinite(minY)) return; // nothing to draw
  if (minY === maxY) maxY = minY + 1; // avoid a zero-height range

  // Plot area, leaving room for axis labels on the left and bottom.
  const padL = 64;
  const padR = 14;
  const padT = 14;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // i is 1-based placement number; v is a spiral index.
  const sx = (i) => padL + (maxX <= 1 ? 0 : ((i - 1) / (maxX - 1)) * plotW);
  const sy = (v) => padT + (1 - (v - minY) / (maxY - minY)) * plotH;

  // Axes.
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();

  // Axis labels: just the extreme values, plus captions.
  ctx.fillStyle = "#000000";
  ctx.font = "12px sans-serif";

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(String(maxY), padL - 6, padT);
  ctx.fillText(String(minY), padL - 6, padT + plotH);

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("1", padL, padT + plotH + 6);
  ctx.fillText(String(maxX), padL + plotW, padT + plotH + 6);
  ctx.fillText("placement number", padL + plotW / 2, padT + plotH + 18);

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("spiral index", padL + 4, padT - 2);

  // One polyline per player.
  for (let p = 0; p < indexHistories.length; p++) {
    const h = indexHistories[p];
    if (h.length === 0) continue;
    ctx.strokeStyle = colors[p];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < h.length; i++) {
      const X = sx(i + 1);
      const Y = sy(h[i]);
      if (i === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    }
    ctx.stroke();
  }
}