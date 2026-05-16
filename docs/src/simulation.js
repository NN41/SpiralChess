// Port of the main placement loop in playground/square/main.py (lines 71-103).
import { step } from "./spiral.js";
import { reachable } from "./pieces.js";

const key = (p) => p[0] + "," + p[1];

// pieceVecs: array of length K, each entry the [m,n] vector for that player.
// starts: optional array of length K, each entry the [x,y] square where that
//   player begins walking the spiral. Defaults to the origin for every player
//   (which reproduces the Python reference exactly). step() walks the spiral
//   forward from any integer square, so any [x,y] is a valid start.
// Returns histories: array of K arrays of [x,y] positions.
export function simulate(N, pieceVecs, starts) {
  const K = pieceVecs.length;
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

    const threatened = reachable(candidate, pieceVecs[index]);
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
