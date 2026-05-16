// Hex pieces. 1:1 port of step_dict + hex_orbit() + reachable() in
// playground/hexagonal/main.py (lines 80-109).
//
// Each piece is a canonical cube triple (a, b, c) with a + b + c = 0. The
// squares it attacks are the orbit of that triple under the hex symmetry
// group D6: every signed permutation of (|a|, |b|, |c|) that still sums to 0.
// Projected to axial offsets [a, b], that orbit is the attack pattern.
export const HEX_PIECES = {
  knight: [1, 2, -3], // 12 destinations
  vazir: [1, 0, -1],  //  6 — the adjacent hex
  fers: [1, 1, -2],   //  6 — "two-step diagonal"
  camel: [1, 3, -4],  // 12
  zebra: [2, 3, -5],  // 12
};

const PERMS3 = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
];
const SIGNS3 = [];
for (const s0 of [-1, 1])
  for (const s1 of [-1, 1])
    for (const s2 of [-1, 1]) SIGNS3.push([s0, s1, s2]);

// All signed permutations of |triple| that still sum to 0, as unique axial
// offsets [a, b] (c = -a-b is implied, so deduping on [a,b] is exact).
export function hexOrbit([a, b, c]) {
  const abs = [Math.abs(a), Math.abs(b), Math.abs(c)];
  const seen = new Set();
  const orbit = [];
  for (const [p0, p1, p2] of PERMS3) {
    const v = [abs[p0], abs[p1], abs[p2]];
    for (const [g0, g1, g2] of SIGNS3) {
      const x = g0 * v[0];
      const y = g1 * v[1];
      const z = g2 * v[2];
      if (x + y + z === 0) {
        const k = x + "," + y;
        if (!seen.has(k)) {
          seen.add(k);
          orbit.push([x, y]);
        }
      }
    }
  }
  return orbit;
}
