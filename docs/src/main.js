import { PIECES, reachable } from "./pieces.js";
import { step as squareStep } from "./spiral.js";
import { render } from "./render.js";
import { HEX_PIECES, hexOrbit } from "./hexpieces.js";
import { hexStep, hexShell } from "./hexspiral.js";
import { hexRender } from "./hexrender.js";
import { simulate } from "./simulation.js";

// Default per-player colors (ported from PLAYER_COLORS, main.py 146-155).
const PLAYER_COLORS = [
  "#1565C0", "#C62828", "#2E7D32", "#E65100",
  "#6A1B9A", "#00838F", "#F9A825", "#4E342E",
];

// Single source of truth for every default. Reset = restore these.
const DEFAULTS = {
  geom: "square",
  k: 2,
  n: 10000,
  piece: "knight", // per-player
  start: 0, // per-player (start index)
  color: (i) => PLAYER_COLORS[i % PLAYER_COLORS.length], // per-player
  ignores: () => [], // per-player: ignores nobody
};
const K_MIN = 1, K_MAX = 8;
const N_MIN = 1, N_MAX = 1000000;
const START_RAND_MAX = 25; // Start-Randomize draws 0..25 inclusive

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
    // Spiral shell (ring) index of a cell = its Chebyshev distance from [0,0].
    shell: ([a, b]) => Math.max(Math.abs(a), Math.abs(b)),
  },
  hex: {
    pieces: HEX_PIECES,
    step: hexStep,
    render: hexRender,
    // D6 orbit of the piece's cube triple, as axial offsets.
    offsetsFor: (name) => hexOrbit(HEX_PIECES[name]),
    // The piece's defining cube triple (a,b,c), shown read-only in the UI.
    vectorLabel: (name) => `(${HEX_PIECES[name].join(",")})`,
    // Spiral shell index of an axial cell = its hex distance from [0,0].
    shell: hexShell,
  },
};

const playerRowsBody = document.getElementById("player-rows");
const geomInput = document.getElementById("geom");
const kInput = document.getElementById("k");
const nInput = document.getElementById("n");
const canvas = document.getElementById("canvas");

let lastRun = null; // { histories, colors, render } from the most recent Run

// The authoritative model for Randomize/Reset math. run() still *reads the
// DOM* (so the Python parity path is byte-identical with defaults), but every
// randomize/reset writes `state`, pushes it to the DOM, then runs.
function freshDefaultState() {
  return {
    geom: DEFAULTS.geom,
    k: DEFAULTS.k,
    n: DEFAULTS.n,
    players: [], // [{ piece, color, start, ignores: [opponentIndex,...] }]
  };
}
let state = freshDefaultState();

function geom() {
  return GEOMETRIES[geomInput.value] || GEOMETRIES.square;
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

// --- RNG ------------------------------------------------------------------
// Random integer in [lo, hi], both inclusive.
function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}
function randColor() {
  return "#" + randInt(0, 0xffffff).toString(16).padStart(6, "0");
}

// --- state <-> DOM bridge -------------------------------------------------
// Grow state.players to >= k with defaults; never shrink, so lowering then
// raising K (or hidden ignore targets) restores prior rows.
function ensurePlayers(k) {
  for (let i = state.players.length; i < k; i++) {
    state.players.push({
      piece: DEFAULTS.piece,
      color: DEFAULTS.color(i),
      start: DEFAULTS.start,
      ignores: DEFAULTS.ignores(),
    });
  }
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

// (Re)build the per-player table rows from state.players. The piece list and
// coordinate labels follow the selected lattice; a piece that doesn't exist on
// the new lattice falls back to "knight" (in both tables).
function buildPlayerRows() {
  const g = geom();
  const K = clamp(parseInt(kInput.value, 10) || 1, K_MIN, K_MAX);
  kInput.value = K;
  state.k = K;
  ensurePlayers(K);

  playerRowsBody.innerHTML = "";
  for (let i = 0; i < K; i++) {
    const p = state.players[i];
    if (!(p.piece in g.pieces)) p.piece = "knight"; // revalidate vs lattice
    const ignoreSet = new Set(p.ignores);
    const boxes = [];
    for (let j = 0; j < K; j++) {
      if (j === i) continue; // a player is never protected from itself
      const checked = ignoreSet.has(j) ? " checked" : "";
      boxes.push(
        `<label title="Ignore P${j + 1}'s threats">` +
          `<input type="checkbox" class="prot" data-target="${j}"${checked}>P${j + 1}</label>`
      );
    }
    const row = document.createElement("tr");
    row.className = "player-row";
    row.innerHTML =
      `<td>Player ${i + 1}</td>` +
      `<td><input type="color" value="${p.color}"></td>` +
      `<td><select>${pieceOptions(g.pieces, p.piece)}</select> ` +
      `<span class="mn">${g.vectorLabel(p.piece)}</span></td>` +
      `<td><input type="number" class="start-index" value="${p.start}" min="0" size="6"></td>` +
      `<td class="ignores-cell">${boxes.join(" ")}</td>`;
    playerRowsBody.appendChild(row);
    const sel = row.querySelector("select");
    sel.addEventListener("change", () => {
      row.querySelector(".mn").textContent = g.vectorLabel(sel.value);
    });
  }
}

// Push state -> DOM (then rebuild rows from state.players).
function applyStateToDom() {
  geomInput.value = state.geom;
  kInput.value = state.k;
  nInput.value = state.n;
  buildPlayerRows();
}

// Pull DOM -> state. Called at the top of run() so manual keyboard/mouse
// edits are captured before hashing and before the next randomize uses state
// as its base.
function readDomIntoState() {
  state.geom = geomInput.value;
  state.k = clamp(parseInt(kInput.value, 10) || 1, K_MIN, K_MAX);
  state.n = clamp(parseInt(nInput.value, 10) || 1, N_MIN, N_MAX);
  const rows = [...playerRowsBody.querySelectorAll(".player-row")];
  const renderedK = rows.length;
  ensurePlayers(renderedK);
  rows.forEach((r, i) => {
    const p = state.players[i];
    p.piece = r.querySelector("select").value;
    p.color = r.querySelector('input[type="color"]').value;
    p.start = readIndex(r.querySelector(".start-index"));
    const checked = new Set(
      [...r.querySelectorAll(".prot:checked")].map((c) => +c.dataset.target)
    );
    // Preserve ignore targets that were out of the rendered range (no
    // checkbox to read), merge with the visible checked ones.
    const preserved = p.ignores.filter((j) => j >= renderedK);
    p.ignores = [...new Set([...preserved, ...checked])]
      .filter((j) => j !== i && j >= 0)
      .sort((a, b) => a - b);
  });
}

// Largest spiral shell any cell of one player's history reaches. A player's
// candidate only ever steps forward, so this is the shell of its last piece.
function maxShell(h, shell) {
  let m = -Infinity;
  for (const c of h) {
    const s = shell(c);
    if (s > m) m = s;
  }
  return m;
}

// Crop the view to one less than the last shell of the *slowest* player — the
// player whose furthest piece sits on the smallest shell. Pieces beyond that
// shell are dropped, so render's autoscale zooms to the region every player
// reached. Loops (not Math.max(...spread)) so N up to 1e6 can't blow the
// stack. Degenerate crops (nothing left, or slowest only reached shell 0)
// fall back to the full, uncropped histories.
function cropHistories(histories, shell) {
  let slowest = Infinity;
  for (const h of histories) {
    if (!h.length) continue;
    const m = maxShell(h, shell);
    if (m < slowest) slowest = m;
  }
  if (!isFinite(slowest)) return histories;
  const cropShell = slowest - 1;
  if (cropShell < 0) return histories;
  const cropped = histories.map((h) => h.filter((c) => shell(c) <= cropShell));
  return cropped.some((h) => h.length) ? cropped : histories;
}

function run() {
  readDomIntoState();
  const g = geom();
  const N = clamp(parseInt(nInput.value, 10) || 1, N_MIN, N_MAX);
  nInput.value = N;
  const rows = [...playerRowsBody.querySelectorAll(".player-row")];
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
  const view = cropHistories(histories, g.shell);
  // Store the cropped view so the PNG / full-image export matches the canvas.
  lastRun = { histories: view, colors, render: g.render };
  g.render(canvas, view, colors);
  writeHash();
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

// --- URL hash state -------------------------------------------------------
// Versioned, ;-separated key=value scheme; players in `p` are rows joined by
// `~`, fields `piece,color6,start,ignores(. -joined)`.
function encodeHash() {
  const p = state.players
    .slice(0, state.k)
    .map((pl) => {
      const color = pl.color.replace(/^#/, "");
      const ig = pl.ignores
        .filter((j) => j >= 0 && j < state.k)
        .join(".");
      return `${pl.piece},${color},${pl.start},${ig}`;
    })
    .join("~");
  return `v1;g=${state.geom};k=${state.k};n=${state.n};p=${p}`;
}
function writeHash() {
  // replaceState (not location.hash=) avoids a back-button entry per run and
  // a hashchange feedback loop. The address bar is always a shareable link.
  try {
    history.replaceState(null, "", "#" + encodeHash());
  } catch (e) {
    /* e.g. file:// — harmless, sharing just isn't available there */
  }
}
function decodeHash() {
  try {
    const raw = location.hash.replace(/^#/, "");
    if (!raw) return; // no hash -> keep DEFAULTS
    const parts = raw.split(";");
    if (parts[0] !== "v1") return; // unknown version -> DEFAULTS
    const map = {};
    for (let i = 1; i < parts.length; i++) {
      const eq = parts[i].indexOf("=");
      if (eq >= 0) map[parts[i].slice(0, eq)] = parts[i].slice(eq + 1);
    }
    state.geom = map.g === "hex" ? "hex" : "square";
    state.k = clamp(parseInt(map.k, 10) || DEFAULTS.k, K_MIN, K_MAX);
    state.n = clamp(parseInt(map.n, 10) || DEFAULTS.n, N_MIN, N_MAX);
    state.players = [];
    const rows = (map.p || "").split("~");
    for (let i = 0; i < state.k; i++) {
      const f = (rows[i] || "").split(",");
      const piece = f[0] || DEFAULTS.piece; // revalidated in buildPlayerRows
      const color = /^[0-9a-fA-F]{6}$/.test(f[1] || "")
        ? "#" + f[1]
        : DEFAULTS.color(i);
      const start = Math.max(0, parseInt(f[2], 10) || 0);
      const ignores = (f[3] || "")
        .split(".")
        .map((x) => parseInt(x, 10))
        .filter(
          (j) => Number.isInteger(j) && j >= 0 && j < state.k && j !== i
        );
      state.players.push({ piece, color, start, ignores });
    }
    ensurePlayers(state.k);
  } catch (e) {
    state = freshDefaultState(); // any parse failure -> full defaults
  }
}

// --- per-setting Randomize / Reset ----------------------------------------
// INVARIANT: every entry below runs via doOp(), which always ends in run().
function randomizeAll() {
  const gn = Object.keys(GEOMETRIES);
  state.geom = gn[randInt(0, gn.length - 1)];
  state.k = randInt(2, K_MAX);
  ensurePlayers(state.k);
  const g = GEOMETRIES[state.geom];
  const names = Object.keys(g.pieces);
  for (let i = 0; i < state.k; i++) {
    state.players[i].piece = names[randInt(0, names.length - 1)];
    state.players[i].start = randInt(0, START_RAND_MAX);
    // Color is deliberately left as-is (Randomize All does not recolor).
  }
  for (let i = 0; i < state.k; i++) {
    const ig = [];
    for (let j = 0; j < state.k; j++) {
      if (j === i) continue;
      if (Math.random() < 0.5) ig.push(j); // independent fair coin per ordered pair
    }
    state.players[i].ignores = ig;
  }
}
function resetAll() {
  state.geom = DEFAULTS.geom;
  state.k = DEFAULTS.k;
  state.n = DEFAULTS.n;
  state.players = [];
  ensurePlayers(state.k);
}

const OPS = {
  // Grid, Players: Randomize only (no Reset button — Reset All covers them).
  grid: {
    rnd: () => {
      const gn = Object.keys(GEOMETRIES);
      state.geom = gn[randInt(0, gn.length - 1)];
    },
  },
  players: {
    rnd: () => {
      state.k = randInt(2, K_MAX);
    },
  },
  // Rounds has no Randomize and no Reset button (Reset All restores it).
  color: {
    rnd: () => {
      for (let i = 0; i < state.k; i++) state.players[i].color = randColor();
    },
    rst: () => {
      for (let i = 0; i < state.k; i++)
        state.players[i].color = DEFAULTS.color(i);
    },
  },
  piece: {
    rnd: () => {
      const names = Object.keys(geom().pieces);
      for (let i = 0; i < state.k; i++)
        state.players[i].piece = names[randInt(0, names.length - 1)];
    },
    rst: () => {
      for (let i = 0; i < state.k; i++)
        state.players[i].piece = DEFAULTS.piece;
    },
  },
  start: {
    rnd: () => {
      for (let i = 0; i < state.k; i++)
        state.players[i].start = randInt(0, START_RAND_MAX);
    },
    rst: () => {
      for (let i = 0; i < state.k; i++)
        state.players[i].start = DEFAULTS.start;
    },
  },
  ignores: {
    rnd: () => {
      for (let i = 0; i < state.k; i++) {
        const ig = [];
        for (let j = 0; j < state.k; j++) {
          if (j === i) continue;
          if (Math.random() < 0.5) ig.push(j); // independent fair coin per pair
        }
        state.players[i].ignores = ig;
      }
    },
    rst: () => {
      for (let i = 0; i < state.k; i++) state.players[i].ignores = [];
    },
  },
  all: { rnd: randomizeAll, rst: resetAll },
};

function doOp(act, kind) {
  const op = OPS[act];
  if (!op || !op[kind]) return;
  readDomIntoState(); // capture manual edits as the base
  ensurePlayers(state.k);
  op[kind]();
  applyStateToDom();
  run();
}

// --- wire up controls -----------------------------------------------------
geomInput.addEventListener("change", () => {
  readDomIntoState();
  buildPlayerRows();
});
kInput.addEventListener("change", () => {
  readDomIntoState();
  buildPlayerRows();
});
document.getElementById("run").addEventListener("click", run);

// One delegated handler for every .rnd / .rst button (controls, table
// header, actions row).
document.body.addEventListener("click", (e) => {
  const btn = e.target.closest && e.target.closest("button.rnd, button.rst");
  if (!btn || !btn.dataset.act) return;
  doOp(btn.dataset.act, btn.classList.contains("rnd") ? "rnd" : "rst");
});

// Enter in any input/select runs.
document.body.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "SELECT")) {
    e.preventDefault();
    run();
  }
});

document.getElementById("copy-link").addEventListener("click", (e) => {
  const url = location.href;
  const btn = e.currentTarget;
  const restore = () => {
    const txt = btn.textContent;
    btn.textContent = "Copied";
    setTimeout(() => {
      btn.textContent = txt;
    }, 1000);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(restore, () => alert(url));
  } else {
    alert(url);
  }
});

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

// Boot: URL hash (or defaults) -> DOM -> initial run (which normalizes the
// hash to its canonical form).
decodeHash();
applyStateToDom();
run();
