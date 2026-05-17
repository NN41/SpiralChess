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
    // The piece's defining [m,n] leaper vector, shown read-only in the UI.
    vectorLabel: (name) => `(${PIECES[name].join(",")})`,
  },
  hex: {
    pieces: HEX_PIECES,
    step: hexStep,
    render: hexRender,
    // D6 orbit of the piece's cube triple, as axial offsets.
    offsetsFor: (name) => hexOrbit(HEX_PIECES[name]),
    // The piece's defining cube triple (a,b,c), shown read-only in the UI.
    vectorLabel: (name) => `(${HEX_PIECES[name].join(",")})`,
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
    // Indices of the players this row is "protected from". Targets that no
    // longer exist after a K change are simply not re-rendered below.
    protectedFrom: new Set(
      [...row.querySelectorAll(".prot:checked")].map((c) => +c.dataset.target)
    ),
  }));

  playersDiv.innerHTML = "";
  for (let i = 0; i < K; i++) {
    let piece = prev[i] ? prev[i].piece : "knight";
    if (!(piece in g.pieces)) piece = "knight";
    const color = prev[i] ? prev[i].color : PLAYER_COLORS[i % PLAYER_COLORS.length];
    const startIndex = prev[i] ? prev[i].startIndex : "0";
    const prevProt = prev[i] ? prev[i].protectedFrom : new Set();
    const boxes = [];
    for (let j = 0; j < K; j++) {
      if (j === i) continue; // a player is never protected from itself
      const checked = prevProt.has(j) ? " checked" : "";
      boxes.push(
        `<label><input type="checkbox" class="prot" data-target="${j}"${checked}>P${j + 1}</label>`
      );
    }
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML =
      `Player ${i + 1}: ` +
      `<select>${pieceOptions(g.pieces, piece)}</select> ` +
      `<span class="mn">${g.vectorLabel(piece)}</span> ` +
      `<input type="color" value="${color}"> ` +
      `&nbsp; starting position: ` +
      `<input type="number" class="start-index" value="${startIndex}" min="0" size="6">` +
      (boxes.length ? `&nbsp; protected from: ${boxes.join(" ")}` : "");
    playersDiv.appendChild(row);
    const sel = row.querySelector("select");
    sel.addEventListener("change", () => {
      row.querySelector(".mn").textContent = g.vectorLabel(sel.value);
    });
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
  const protectedFrom = rows.map(
    (r) =>
      new Set(
        [...r.querySelectorAll(".prot:checked")].map((c) => +c.dataset.target)
      )
  );

  const histories = simulate(N, offsets, starts, g.step, protectedFrom);
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

// Random integer in [lo, hi], both inclusive.
function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

// Fill every control with random choices, then run: a random lattice, 2-8
// players, a random piece and start index (0-25) each, and a coin flip per
// ordered player pair for the "protected from" relation.
function randomize() {
  const names = Object.keys(GEOMETRIES);
  geomInput.value = names[randInt(0, names.length - 1)];
  kInput.value = randInt(2, 8);
  buildPlayerRows();
  const g = geom();
  const pieces = Object.keys(g.pieces);
  for (const r of playersDiv.querySelectorAll(".player-row")) {
    const sel = r.querySelector("select");
    sel.value = pieces[randInt(0, pieces.length - 1)];
    r.querySelector(".mn").textContent = g.vectorLabel(sel.value);
    r.querySelector(".start-index").value = randInt(0, 25);
    for (const c of r.querySelectorAll(".prot")) c.checked = Math.random() < 0.5;
  }
  run();
}

// --- wire up controls ---
geomInput.addEventListener("change", buildPlayerRows);
kInput.addEventListener("change", buildPlayerRows);
document.getElementById("run").addEventListener("click", run);
document.getElementById("randomize").addEventListener("click", randomize);

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
