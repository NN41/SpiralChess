// Port of the main placement loop in playground/square/main.py (71-103) and
// playground/hexagonal/main.py (149-170). The loop is lattice-agnostic: the
// geometry (square or hex) enters only through `step` and the attack offsets.

const key = (p) => p[0] + "," + p[1];

// N        — rounds (pieces placed per player).
// offsets  — array of length K; offsets[i] is the list of [da,db] cells that
//            player i's piece attacks, relative to its own position.
// starts   — optional array of length K; starts[i] is the [a,b] cell where
//            player i begins walking the spiral. Defaults to the origin for
//            every player (which reproduces the Python references exactly).
// step     — spiral-step function for the chosen geometry: given a cell,
//            return the next cell along the outward spiral. It walks forward
//            from any valid cell, so any start is allowed.
// Returns histories: array of K arrays of [a,b] positions, in placement order.
export function simulate(N, offsets, starts, step) {
  const K = offsets.length;
  const candidates = Array.from({ length: K }, (_, i) =>
    starts && starts[i] ? [starts[i][0], starts[i][1]] : [0, 0]
  );
  const histories = Array.from({ length: K }, () => []);
  const verboten = Array.from({ length: K }, () => new Set());

  for (let i = 0; i < K * N; i++) {
    const index = i % K;
    let candidate = candidates[index];
    while (verboten[index].has(key(candidate))) {
      candidate = step(candidate);
    }
    candidates[index] = candidate;
    histories[index].push(candidate);

    const [ca, cb] = candidate;
    const threatened = offsets[index].map(([da, db]) => [ca + da, cb + db]);
    for (let j = 0; j < K; j++) {
      if (j === index) {
        verboten[j].add(key(candidate)); // can't stack on yourself
      } else {
        verboten[j].add(key(candidate));
        for (const t of threatened) verboten[j].add(key(t));
      }
    }
  }
  return histories;
}
