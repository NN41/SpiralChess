// Port of step_dict + reachable() in playground/square/main.py (lines 42-63).

// Built-in pieces: name -> [m, n] leaper vector.
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

// Given a square [x,y] and a leaper vector [m,n], return the 8 squares it
// attacks. No dedupe (matches Python; a Set absorbs duplicates).
export function reachable([x, y], [m, n]) {
  return [
    [x + m, y + n], [x + m, y - n], [x - m, y + n], [x - m, y - n],
    [x + n, y + m], [x - n, y + m], [x + n, y - m], [x - n, y - m],
  ];
}
