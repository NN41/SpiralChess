// Convert placement histories into their indices along the outward spiral.
// This mirrors the `dic` mapping in playground/square/main.py (lines 119-129):
// the origin is index 0, its successor via step() is 1, and so on.
import { step } from "./spiral.js";

const key = (x, y) => x + "," + y;

// histories: array of K arrays of [x,y] squares (output of simulate()).
// Returns an array of K arrays of integers: the spiral index of each square,
// in the same order. Used only for the line chart — nothing is exported.
export function toSpiralIndices(histories) {
  // Every square we still need a number for.
  const needed = new Set();
  for (const h of histories) for (const [x, y] of h) needed.add(key(x, y));
  if (needed.size === 0) return histories.map(() => []);

  // Walk the spiral from the origin, numbering squares 0, 1, 2, ..., and stop
  // as soon as every needed square has been numbered. step() visits every
  // integer square exactly once, so this always terminates; the loop runs
  // (largest needed spiral index + 1) times.
  const indexOf = new Map();
  let p = [0, 0];
  let i = 0;
  while (indexOf.size < needed.size) {
    const k = key(p[0], p[1]);
    if (needed.has(k) && !indexOf.has(k)) indexOf.set(k, i);
    p = step(p);
    i++;
  }

  return histories.map((h) => h.map(([x, y]) => indexOf.get(key(x, y))));
}