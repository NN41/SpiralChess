// Built-in square-grid leapers: name -> defining [m, n] vector. An [m, n]
// leaper jumps any of the 8 squares ±m, ±n away (or ±n, ±m); see reachable().
export const PIECES = {
  knight: [2, 1],
  fers: [1, 1],
  vazir: [1, 0],
  camel: [3, 1],
  zebra: [3, 2],
  antelope: [4, 3],
  eland: [5, 3],
  satrap: [2, 0],
  aspbad: [2, 2],
  spehbed: [3, 0],
  marzban: [3, 3],
};

// The 8 squares an [m, n] leaper attacks from [x, y], under the D4 symmetry
// of the square grid (sign flips on each coordinate, plus swap of m/n).
// Duplicates are fine — callers feed these into a Set.
export function reachable([x, y], [m, n]) {
  return [
    [x + m, y + n], [x + m, y - n], [x - m, y + n], [x - m, y - n],
    [x + n, y + m], [x - n, y + m], [x + n, y - m], [x - n, y - m],
  ];
}
