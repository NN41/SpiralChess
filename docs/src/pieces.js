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

// Short familiar-name notes for the pieces that have one. Everything in PIECES
// is an (m,n)-leaper (a generalization of the chess knight); these are just
// the well-known special cases.
const PIECE_NOTES = {
  knight: "the standard chess knight",
  fers: "one step diagonally",
  vazir: "one step orthogonally (the wazir)",
  satrap: "the dabbaba — leaps two squares orthogonally",
  aspbad: "the alfil — leaps two squares diagonally",
  marzban: "the tripper — leaps three squares diagonally",
};

// One-line description of how a named piece moves. Every piece is an
// (m,n)-leaper: from (x,y) it jumps directly (over anything in between) to the
// up-to-8 squares (x±m, y±n) and (x±n, y±m).
export function describePiece(name) {
  const [m, n] = PIECES[name];
  const note = PIECE_NOTES[name] ? ` — ${PIECE_NOTES[name]}` : "";
  return `(${m},${n})-leaper: jumps to (x±${m}, y±${n}) and (x±${n}, y±${m})${note}.`;
}
