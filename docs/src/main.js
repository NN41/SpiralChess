import { PIECES, describePiece } from "./pieces.js";
import { simulate } from "./simulation.js";
import { toSpiralIndices } from "./indices.js";
import { render } from "./render.js";
import { renderChart } from "./chart.js";

// Default per-player colors (ported from PLAYER_COLORS, main.py 146-155).
const PLAYER_COLORS = [
  "#1565C0", "#C62828", "#2E7D32", "#E65100",
  "#6A1B9A", "#00838F", "#F9A825", "#4E342E",
];

const playersDiv = document.getElementById("players");
const kInput = document.getElementById("k");
const nInput = document.getElementById("n");
const canvas = document.getElementById("canvas");
const chartCanvas = document.getElementById("chart");

let lastRun = null; // { histories, colors } from the most recent Run

// Build the <option> list for the piece dropdown. The leaper vector is shown
// in the label so the movement is visible without opening the reference.
function pieceOptions(selected) {
  return Object.keys(PIECES)
    .map((name) => {
      const [m, n] = PIECES[name];
      const sel = name === selected ? " selected" : "";
      return `<option value="${name}"${sel}>${name} (${m},${n})</option>`;
    })
    .join("");
}

// (Re)build the per-player rows to match K, preserving existing choices.
function buildPlayerRows() {
  const K = clamp(parseInt(kInput.value, 10) || 1, 1, 8);
  kInput.value = K;
  const prev = [...playersDiv.querySelectorAll(".player-row")].map((row) => ({
    piece: row.querySelector("select").value,
    color: row.querySelector('input[type="color"]').value,
    sx: row.querySelector(".start-x").value,
    sy: row.querySelector(".start-y").value,
  }));

  playersDiv.innerHTML = "";
  for (let i = 0; i < K; i++) {
    const piece = prev[i] ? prev[i].piece : "knight";
    const color = prev[i] ? prev[i].color : PLAYER_COLORS[i % PLAYER_COLORS.length];
    const sx = prev[i] ? prev[i].sx : "0";
    const sy = prev[i] ? prev[i].sy : "0";
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML =
      `Player ${i + 1}: ` +
      `<select>${pieceOptions(piece)}</select> ` +
      `<input type="color" value="${color}"> ` +
      `&nbsp; start (x, y): ` +
      `<input type="number" class="start-x" value="${sx}" size="4"> ` +
      `<input type="number" class="start-y" value="${sy}" size="4">`;
    playersDiv.appendChild(row);
  }
}

// Fill the reference list with every piece and its movement.
function buildPieceList() {
  const ul = document.getElementById("piece-list");
  ul.innerHTML = Object.keys(PIECES)
    .map((name) => `<li><strong>${name}</strong> &mdash; ${describePiece(name)}</li>`)
    .join("");
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Read a starting-coordinate input: round to an integer, empty/NaN -> 0.
function readCoord(input) {
  const v = Math.round(parseFloat(input.value));
  return Number.isFinite(v) ? v : 0;
}

function run() {
  const N = clamp(parseInt(nInput.value, 10) || 1, 1, 100000);
  nInput.value = N;
  const rows = [...playersDiv.querySelectorAll(".player-row")];
  const pieceVecs = rows.map((r) => PIECES[r.querySelector("select").value]);
  const colors = rows.map((r) => r.querySelector('input[type="color"]').value);
  const starts = rows.map((r) => [
    readCoord(r.querySelector(".start-x")),
    readCoord(r.querySelector(".start-y")),
  ]);

  const histories = simulate(N, pieceVecs, starts);
  lastRun = { histories, colors };
  render(canvas, histories, colors);
  renderChart(chartCanvas, toSpiralIndices(histories), colors);
}

// Re-render the last run to a large offscreen canvas for a crisp,
// zoomable image. render() reads the canvas's own size, so nothing else
// needs to change.
const FULL_SIZE = 3000;
function fullImageURL() {
  const off = document.createElement("canvas");
  off.width = FULL_SIZE;
  off.height = FULL_SIZE;
  render(off, lastRun.histories, lastRun.colors);
  return off.toDataURL("image/png");
}

// --- wire up controls ---
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
buildPieceList();
