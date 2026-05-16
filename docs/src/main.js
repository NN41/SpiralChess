import { PIECES, reachable } from "./pieces.js";
import { step as squareStep } from "./spiral.js";
import { render } from "./render.js";
import { HEX_PIECES, hexOrbit } from "./hexpieces.js";
import { hexStep } from "./hexspiral.js";
import { hexRender } from "./hexrender.js";
import { simulate } from "./simulation.js";

// Default per-player colors (ported from PLAYER_COLORS, main.py 146-155).
const PLAYER_COLORS = [
  "#1565C0", "#C62828", "#2E7D32", "#E65100",
  "#6A1B9A", "#00838F", "#F9A825", "#4E342E",
];

// A "geometry" bundles everything that differs between the square and hex
// lattices. The placement loop (simulate) and the rest of the UI are shared.
const GEOMETRIES = {
  square: {
    pieces: PIECES,
    step: squareStep,
    render,
    // 8 squares an [m,n]-leaper attacks, as offsets from its own cell.
    offsetsFor: (name) => reachable([0, 0], PIECES[name]),
  },
  hex: {
    pieces: HEX_PIECES,
    step: hexStep,
    render: hexRender,
    // D6 orbit of the piece's cube triple, as axial offsets.
    offsetsFor: (name) => hexOrbit(HEX_PIECES[name]),
  },
};

const playersDiv = document.getElementById("players");
const geomInput = document.getElementById("geom");
const kInput = document.getElementById("k");
const nInput = document.getElementById("n");
const canvas = document.getElementById("canvas");

let lastRun = null; // { histories, colors, render } from the most recent Run

function geom() {
  return GEOMETRIES[geomInput.value] || GEOMETRIES.square;
}

// Build the <option> list for the current lattice's piece table.
function pieceOptions(pieces, selected) {
  return Object.keys(pieces)
    .map(
      (name) =>
        `<option value="${name}"${name === selected ? " selected" : ""}>${name}</option>`
    )
    .join("");
}

// (Re)build the per-player rows to match K, preserving existing choices. The
// piece list and coordinate labels follow the selected lattice; a piece that
// doesn't exist on the new lattice falls back to "knight" (in both tables).
function buildPlayerRows() {
  const g = geom();
  const K = clamp(parseInt(kInput.value, 10) || 1, 1, 8);
  kInput.value = K;
  const prev = [...playersDiv.querySelectorAll(".player-row")].map((row) => ({
    piece: row.querySelector("select").value,
    color: row.querySelector('input[type="color"]').value,
    startIndex: row.querySelector(".start-index").value,
  }));

  playersDiv.innerHTML = "";
  for (let i = 0; i < K; i++) {
    let piece = prev[i] ? prev[i].piece : "knight";
    if (!(piece in g.pieces)) piece = "knight";
    const color = prev[i] ? prev[i].color : PLAYER_COLORS[i % PLAYER_COLORS.length];
    const startIndex = prev[i] ? prev[i].startIndex : "0";
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML =
      `Player ${i + 1}: ` +
      `<select>${pieceOptions(g.pieces, piece)}</select> ` +
      `<input type="color" value="${color}"> ` +
      `&nbsp; starting position: ` +
      `<input type="number" class="start-index" value="${startIndex}" min="0" size="6">`;
    playersDiv.appendChild(row);
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Read a starting-index input: a non-negative integer, empty/NaN/negative -> 0.
function readIndex(input) {
  const v = Math.round(parseFloat(input.value));
  return Number.isFinite(v) && v > 0 ? v : 0;
}

// The cell at position `index` along this lattice's spiral (origin = 0).
function cellAtIndex(step, index) {
  let p = [0, 0];
  for (let i = 0; i < index; i++) p = step(p);
  return p;
}

function run() {
  const g = geom();
  const N = clamp(parseInt(nInput.value, 10) || 1, 1, 1000000);
  nInput.value = N;
  const rows = [...playersDiv.querySelectorAll(".player-row")];
  const offsets = rows.map((r) => g.offsetsFor(r.querySelector("select").value));
  const colors = rows.map((r) => r.querySelector('input[type="color"]').value);
  const starts = rows.map((r) =>
    cellAtIndex(g.step, readIndex(r.querySelector(".start-index")))
  );

  const histories = simulate(N, offsets, starts, g.step);
  lastRun = { histories, colors, render: g.render };
  g.render(canvas, histories, colors);
}

// Re-render the last run to a large offscreen canvas for a crisp, zoomable
// image. The renderers read the canvas's own size, so nothing else changes.
const FULL_SIZE = 3000;
function fullImageURL() {
  const off = document.createElement("canvas");
  off.width = FULL_SIZE;
  off.height = FULL_SIZE;
  lastRun.render(off, lastRun.histories, lastRun.colors);
  return off.toDataURL("image/png");
}

// --- wire up controls ---
geomInput.addEventListener("change", buildPlayerRows);
kInput.addEventListener("change", buildPlayerRows);
document.getElementById("run").addEventListener("click", run);

document.getElementById("png").addEventListener("click", () => {
  if (!lastRun) return alert("Press Run first.");
  const a = document.createElement("a");
  a.href = fullImageURL();
  a.download = "spiralchess.png";
  a.click();
});

document.getElementById("open-full").addEventListener("click", () => {
  if (!lastRun) return alert("Press Run first.");
  const w = window.open();
  if (w) {
    w.document.write(
      `<title>Spiral Chess</title><img src="${fullImageURL()}" ` +
        `style="image-rendering:pixelated">`
    );
  }
});

buildPlayerRows();
