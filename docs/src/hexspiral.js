// Hexagonal lattice in axial coordinates [q, r]. 1:1 port of step()/shell()/
// to_cartesian() in playground/hexagonal/main.py (lines 20-73).

// Shell number of [q, r]: the cube distance from the origin. Always an integer
// for valid axial coords (|q|+|r|+|q+r| is even), so the /2 is exact.
export function hexShell([q, r]) {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}

// Next cell along the CCW outward hex spiral. First step from the origin is
// east, to [1, 0]. The order of tests matters: corners before sides.
export function hexStep([q, r]) {
  if (q === 0 && r === 0) return [1, 0];

  const n = hexShell([q, r]);

  // Six corners: each ends a side and starts the next. The SE corner also
  // transitions outward into shell n+1.
  if (q === n && r === 0) return [q, r - 1];      // E  -> start E->NE side
  if (q === n && r === -n) return [q - 1, r];     // NE -> start NE->NW side
  if (q === 0 && r === -n) return [q - 1, r + 1]; // NW -> start NW->W side
  if (q === -n && r === 0) return [q, r + 1];     // W  -> start W->SW side
  if (q === -n && r === n) return [q + 1, r];     // SW -> start SW->SE side
  if (q === 0 && r === n) return [q + 1, r];      // SE -> east into shell n+1

  // Six sides: constant step direction within each.
  if (q + r === n) return [q + 1, r - 1];         // SE -> E  side
  if (q === n) return [q, r - 1];                 // E  -> NE side
  if (r === -n) return [q - 1, r];                // NE -> NW side
  if (q + r === -n) return [q - 1, r + 1];        // NW -> W  side
  if (q === -n) return [q, r + 1];                // W  -> SW side
  if (r === n) return [q + 1, r];                 // SW -> SE side

  return false; // unreachable for valid spiral positions (matches Python)
}

// Axial [q, r] -> Cartesian [x, y] for pointy-top hexes of circumradius 1.
// First spiral step [1, 0] lands at [sqrt(3), 0] (horizontal, to the right).
export function hexToCartesian([q, r]) {
  return [Math.sqrt(3) * (q + r / 2), -1.5 * r];
}
