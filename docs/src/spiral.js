// Direct 1:1 port of step(t) in playground/square/main.py (lines 17-38).
// Given a square [a,b], return the next square along the outward spiral.
export function step([a, b]) {
  if (a === 0 && b === 0) return [1, 0];
  if (a > Math.abs(b)) return [a, b + 1];
  if (a < -Math.abs(b)) return [a, b - 1];
  if (b > Math.abs(a)) return [a - 1, b];
  if (b < -Math.abs(a)) return [a + 1, b];
  if (a === b && a > 0) return [a - 1, b];
  if (a === b && a < 0) return [a + 1, b];
  if (a === -b && a > 0) return [a + 1, b];
  if (a === -b && a < 0) return [a, b - 1];
  return false; // unreachable for valid spiral positions (matches Python)
}
