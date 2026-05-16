import { PIECES } from "./pieces.js";
import { simulate } from "./simulation.js";
import { render } from "./render.js";

// Default per-player colors (ported from PLAYER_COLORS, main.py 146-155).
const PLAYER_COLORS = [
  "#1565C0", "#C62828", "#2E7D32", "#E65100",
  "#6A1B9A", "#00838F", "#F9A825", "#4E342E",
];

// Runtime piece table: built-ins plus any custom pieces the user adds.
const pieces = { ...PIECES };

const playersDiv = document.getElementById("players");
const kInput = document.getElementById("k");
const nInput = document.getElementById("n");
const canvas = document.getElementById("canvas");

// Build an <option> list for the current piece table.
function pieceOptions(selected) {
  return Object.keys(pieces)
    .map(
      (name) =>
        `<option value="${name}"${name === selected ? " selected" : ""}>${name}</option>`
    )
    .join("");
}

// (Re)build the per-player rows to match K, preserving existing choices.
function buildPlayerRows() {
  const K = clamp(parseInt(kInput.value, 10) || 1, 1, 8);
  kInput.value = K;
  const prev = [...playersDiv.querySelectorAll(".player-row")].map((row) => ({
    piece: row.querySelector("select").value,
    color: row.querySelector('input[type="color"]').value,
  }));

  playersDiv.innerHTML = "";
  for (let i = 0; i < K; i++) {
    const piece = prev[i] ? prev[i].piece : "knight";
    const color = prev[i] ? prev[i].color : PLAYER_COLORS[i % PLAYER_COLORS.length];
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML =
      `Player ${i + 1}: ` +
      `<select>${pieceOptions(piece)}</select> ` +
      `<input type="color" value="${color}">`;
    playersDiv.appendChild(row);
  }
}

function refreshPieceDropdowns() {
  for (const sel of playersDiv.querySelectorAll("select")) {
    const cur = sel.value;
    sel.innerHTML = pieceOptions(cur);
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function run() {
  const N = clamp(parseInt(nInput.value, 10) || 1, 1, 20000);
  nInput.value = N;
  const rows = [...playersDiv.querySelectorAll(".player-row")];
  const pieceVecs = rows.map((r) => pieces[r.querySelector("select").value]);
  const colors = rows.map((r) => r.querySelector('input[type="color"]').value);
  const histories = simulate(N, pieceVecs);
  render(canvas, histories, colors);
}

// --- wire up controls ---
document.getElementById("k").addEventListener("change", buildPlayerRows);
document.getElementById("run").addEventListener("click", run);

document.getElementById("add-piece").addEventListener("click", () => {
  const name = document.getElementById("cp-name").value.trim();
  const m = Math.abs(parseInt(document.getElementById("cp-m").value, 10));
  const n = Math.abs(parseInt(document.getElementById("cp-n").value, 10));
  if (!name) return alert("Give the piece a name.");
  if (!Number.isFinite(m) || !Number.isFinite(n)) return alert("m and n must be integers.");
  if (m === 0 && n === 0) return alert("A (0,0) piece can't move.");
  pieces[name] = [m, n];
  refreshPieceDropdowns();
  alert(`Added piece "${name}" = (${m}, ${n}).`);
});

document.getElementById("png").addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "spiral.png";
  a.click();
});

buildPlayerRows();
