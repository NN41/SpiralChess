// Built-in hex-grid leapers. Each piece is identified by a canonical cube
// triple (a, b, c) with a + b + c = 0. The cells it attacks are the orbit of
// that triple under the hex symmetry group D6 — every signed permutation of
// (|a|, |b|, |c|) that still sums to zero. Projected to axial coordinates
// [a, b] (c = -a-b is implied), that orbit is the piece's attack pattern.
export const HEX_PIECES = {
  knight: [1, 2, -3], // 12 destinations
  vazir: [1, 0, -1],  //  6 — adjacent hex
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

// Compute the D6 orbit of a cube triple as a deduped list of axial offsets
// [a, b]. We iterate every permutation × sign combination of the absolute
// values, keep those that still sum to zero, and dedupe on (a, b) since
// c = -a-b is fully determined by them.
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
