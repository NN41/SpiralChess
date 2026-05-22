// Hexagonal lattice in axial coordinates [q, r]. Shells expand outward from
// the origin; the spiral within a shell walks counter-clockwise.

// Shell number of [q, r] = cube distance from the origin. For valid axial
// coords the sum |q| + |r| + |q+r| is even, so /2 is exact.
export function hexShell([q, r]) {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}

// Given an axial cell, return the next cell along the CCW outward hex spiral.
// First step from the origin lands east, at [1, 0]. Order matters: the six
// corners are tested before the six side conditions, because a corner cell
// also satisfies the side condition of its starting side.
export function hexStep([q, r]) {
  if (q === 0 && r === 0) return [1, 0];

  const n = hexShell([q, r]);

  // Six corners: each ends one side and starts the next. The SE corner is
  // the one that jumps outward into shell n+1.
  if (q === n && r === 0) return [q, r - 1];      // E  -> start E->NE side
  if (q === n && r === -n) return [q - 1, r];     // NE -> start NE->NW side
  if (q === 0 && r === -n) return [q - 1, r + 1]; // NW -> start NW->W side
  if (q === -n && r === 0) return [q, r + 1];     // W  -> start W->SW side
  if (q === -n && r === n) return [q + 1, r];     // SW -> start SW->SE side
  if (q === 0 && r === n) return [q + 1, r];      // SE -> east into shell n+1

  // Six sides: each side has a constant step direction.
  if (q + r === n) return [q + 1, r - 1];         // SE -> E  side
  if (q === n) return [q, r - 1];                 // E  -> NE side
  if (r === -n) return [q - 1, r];                // NE -> NW side
  if (q + r === -n) return [q - 1, r + 1];        // NW -> W  side
  if (q === -n) return [q, r + 1];                // W  -> SW side
  if (r === n) return [q + 1, r];                 // SW -> SE side

  return false; // unreachable for any cell produced by hexStep() itself
}

// Axial [q, r] -> Cartesian [x, y] for pointy-top hexes of circumradius 1.
// The first spiral step [1, 0] lands at [sqrt(3), 0] (horizontal, right).
export function hexToCartesian([q, r]) {
  return [Math.sqrt(3) * (q + r / 2), -1.5 * r];
}