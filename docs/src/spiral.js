// Given a square [a, b] on the outward spiral, return the next square.
// The spiral starts at [0, 0] and walks anti-clockwise: right edge first,
// then top, then left, then bottom, expanding one shell at a time.
export function step([a, b]) {
  if (a === 0 && b === 0) return [1, 0];
  if (a > Math.abs(b)) return [a, b + 1];
  if (a < -Math.abs(b)) return [a, b - 1];
  if (b > Math.abs(a)) return [a - 1, b];
  if (b < -Math.abs(a)) return [a + 1, b];
  // Diagonal corners: turn 90 degrees to enter the next side.
  if (a === b && a > 0) return [a - 1, b];
  if (a === b && a < 0) return [a + 1, b];
  if (a === -b && a > 0) return [a + 1, b];
  if (a === -b && a < 0) return [a, b - 1];
  return false; // unreachable for any cell produced by step() itself
}
