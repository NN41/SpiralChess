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
  active: true, // per-player: included in the simulation
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
const indexSeqBody = document.getElementById("index-seq-body");

let lastRun = null; // { histories, colors, render } from the most recent Run

// The authoritative model for Randomize/Reset math. run() still *reads the
// DOM* (so the Python parity path is byte-identical with defaults), but every
// randomize/reset writes `state`, pushes it to the DOM, then runs.
function freshDefaultState() {
  return {
    geom: DEFAULTS.geom,
    k: DEFAULTS.k,
    n: DEFAULTS.n,
    players: [], // [{ piece, color, start, ignores: [opponentIndex,...], active }]
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

const key = (p) => p[0] + "," + p[1];

// --- RNG ------------------------------------------------------------------
// Random integer in [lo, hi], both inclusive.
function randInt(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}
function randColor() {
  return "#" + randInt(0, 0xffffff).toString(16).padStart(6, "0");
}
// Random ignore-set for player i over a K-sized lineup: independent fair coin
// per ordered pair (i, j != i). Used by both the column-level and per-row
// ignore-Randomize buttons, so they stay in sync.
function randomIgnores(i, k) {
  const ig = [];
  for (let j = 0; j < k; j++) {
    if (j === i) continue;
    if (Math.random() < 0.5) ig.push(j);
  }
  return ig;
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
      active: DEFAULTS.active,
    });
  }
  // Backfill any pre-existing row that pre-dates the `active` flag.
  for (const p of state.players) {
    if (typeof p.active !== "boolean") p.active = DEFAULTS.active;
  }
}

// Build the <option> list for the current lattice's piece table. Each option
// is labelled with the piece's name *and* its leaper vector (square: (m,n);
// hex: cube triple), so the offsets are visible while scrolling the dropdown
// instead of only after the selection commits.
function pieceOptions(pieces, selected, vectorLabel) {
  return Object.keys(pieces)
    .map(
      (name) =>
        `<option value="${name}"${name === selected ? " selected" : ""}>${name} ${vectorLabel(name)}</option>`
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
      if (j === i) {
        // Visual-only "self" checkbox so each row's Protected-from cell has
        // the same number of boxes (= K) and they line up across rows. It's
        // disabled + always checked because a player can't threaten itself,
        // and it has *no* `.prot` class so readDomIntoState skips it.
        boxes.push(
          `<label title="A player can never threaten itself.">` +
            `<input type="checkbox" checked disabled>P${j + 1}</label>`
        );
        continue;
      }
      const checked = ignoreSet.has(j) ? " checked" : "";
      boxes.push(
        `<label title="Ignore P${j + 1}'s threats">` +
          `<input type="checkbox" class="prot" data-target="${j}"${checked}>P${j + 1}</label>`
      );
    }
    const activeChecked = p.active ? " checked" : "";
    const row = document.createElement("tr");
    row.className = "player-row";
    row.innerHTML =
      `<td>` +
        `<label title="Active: include this player in the simulation">` +
          `<input type="checkbox" class="active"${activeChecked}> Player ${i + 1}</label> ` +
        `<button class="rnd-row" data-i="${i}" title="Randomize this player (keeps color)">Randomize</button>` +
      `</td>` +
      `<td><input type="color" value="${p.color}"></td>` +
      `<td><select>${pieceOptions(g.pieces, p.piece, g.vectorLabel)}</select></td>` +
      `<td><input type="number" class="start-index" value="${p.start}" min="0"></td>` +
      `<td class="ignores-cell">${boxes.join(" ")} ` +
        `<button class="rnd-prot" data-i="${i}" title="Randomize ignore-threats-from for this player">Randomize</button>` +
      `</td>`;
    playerRowsBody.appendChild(row);

    // Auto-rerun: any input/select/checkbox edit inside the row re-runs.
    // The disabled self-checkbox can't fire change, so no special-casing.
    row.querySelectorAll("input, select").forEach((el) => {
      el.addEventListener("change", run);
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
    const activeEl = r.querySelector(".active");
    p.active = activeEl ? activeEl.checked : true;
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

// --- index-sequence panel -------------------------------------------------
// For each history's cells, find their global-spiral index — i.e. how many
// step()s from the origin reach that cell. This is the OEIS numbering used in
// A392177 etc., independent of where each player's *own* spiral starts. We
// walk the global spiral once, recording each visited cell's index in a Map,
// and stop as soon as every cell we care about has been seen.
function globalSpiralIndices(histories, step) {
  const wanted = new Set();
  for (const h of histories) for (const c of h) wanted.add(key(c));
  if (wanted.size === 0) return histories.map(() => []);

  // Safety cap: A392177-like sequences place at indices ~3x piece count, so
  // walking ~50x the wanted-set size is more than enough headroom. The walk
  // exits early via the wanted.size===0 check below in the common case.
  const cap = Math.max(10000, wanted.size * 50);
  const keyToIdx = new Map();
  let cell = [0, 0];
  for (let idx = 0; idx < cap; idx++) {
    const k = key(cell);
    if (wanted.has(k)) {
      keyToIdx.set(k, idx);
      wanted.delete(k);
      if (wanted.size === 0) break;
    }
    cell = step(cell);
  }
  return histories.map((h) =>
    h.map((c) => {
      const idx = keyToIdx.get(key(c));
      return idx === undefined ? -1 : idx;
    })
  );
}

// Rebuild the collapsible "Index sequence" panel below the canvas. We label
// each sequence with the *original* player number (so inactivating a player
// doesn't renumber the rest mid-list) and color the label with that player's
// color, so the panel reads like a legend for the canvas. Each sequence is
// capped at INDEX_SEQ_CAP integers — OEIS submission needs only the first
// ~75 anyway, and rendering tens of thousands of commas locks the DOM up.
const INDEX_SEQ_CAP = 100;
function renderIndexSeq(liveHistories, liveOrig, allColors, step) {
  if (!indexSeqBody) return;
  if (!liveHistories.length) {
    indexSeqBody.innerHTML = "<i>No active players.</i>";
    return;
  }
  const seqs = globalSpiralIndices(liveHistories, step);
  indexSeqBody.innerHTML = liveHistories
    .map((_, live) => {
      const orig = liveOrig[live];
      const color = allColors[orig];
      const full = seqs[live];
      const shown = full.slice(0, INDEX_SEQ_CAP).join(", ");
      const more =
        full.length > INDEX_SEQ_CAP
          ? ` <small>(first ${INDEX_SEQ_CAP} of ${full.length})</small>`
          : "";
      return `<div><b style="color:${color}">Player ${orig + 1}:</b> <code>${shown}</code>${more}</div>`;
    })
    .join("");
}

function run() {
  readDomIntoState();
  const g = geom();
  const N = clamp(parseInt(nInput.value, 10) || 1, N_MIN, N_MAX);
  nInput.value = N;
  const rows = [...playerRowsBody.querySelectorAll(".player-row")];

  // Pull every per-row datum once, then filter by `active`. Inactive players
  // never reach simulate(); they're stripped out and the remaining ones are
  // renumbered into a contiguous 0..K'-1 lineup, with their `ignores` lists
  // remapped through origToLive (and any reference to an inactive opponent
  // dropped). This keeps simulation.js untouched — the Python parity path
  // through it is identical when every player is active.
  const allOffsets = rows.map((r) => g.offsetsFor(r.querySelector("select").value));
  const allColors = rows.map((r) => r.querySelector('input[type="color"]').value);
  const allStarts = rows.map((r) =>
    cellAtIndex(g.step, readIndex(r.querySelector(".start-index")))
  );
  const allProtected = rows.map(
    (r) =>
      new Set(
        [...r.querySelectorAll(".prot:checked")].map((c) => +c.dataset.target)
      )
  );
  const allActive = rows.map((r) => {
    const el = r.querySelector(".active");
    return el ? el.checked : true;
  });

  const liveOrig = [];
  for (let i = 0; i < rows.length; i++) if (allActive[i]) liveOrig.push(i);

  // No active players — clear the canvas, blank the index panel, still update
  // the hash so the empty-board URL round-trips.
  if (!liveOrig.length) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lastRun = { histories: [], colors: [], render: g.render };
    renderIndexSeq([], [], allColors, g.step);
    writeHash();
    return;
  }

  const origToLive = new Map();
  liveOrig.forEach((orig, live) => origToLive.set(orig, live));

  const offsets = liveOrig.map((i) => allOffsets[i]);
  const colors = liveOrig.map((i) => allColors[i]);
  const starts = liveOrig.map((i) => allStarts[i]);
  const protectedFrom = liveOrig.map((i) => {
    const remap = [];
    for (const j of allProtected[i]) {
      if (origToLive.has(j)) remap.push(origToLive.get(j));
    }
    return new Set(remap);
  });

  const liveHistories = simulate(N, offsets, starts, g.step, protectedFrom);
  const view = cropHistories(liveHistories, g.shell);
  // Store the cropped view so the PNG / full-image export matches the canvas.
  lastRun = { histories: view, colors, render: g.render };
  g.render(canvas, view, colors);
  // Use uncropped liveHistories so the OEIS sequence isn't silently truncated
  // by the visual crop.
  renderIndexSeq(liveHistories, liveOrig, allColors, g.step);
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
// `~`, fields `piece,color6,start,ignores(. -joined),active(1|0)`.
// The 5th field (active) is additive: older v1 links omit it and the decoder
// reads a missing field as active=true, so existing share-links round-trip.
function encodeHash() {
  const p = state.players
    .slice(0, state.k)
    .map((pl) => {
      const color = pl.color.replace(/^#/, "");
      const ig = pl.ignores
        .filter((j) => j >= 0 && j < state.k)
        .join(".");
      const act = pl.active ? "1" : "0";
      return `${pl.piece},${color},${pl.start},${ig},${act}`;
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
      // f[4] absent (old v1 link) -> active = true. "0" -> false. Anything
      // else (incl. "1") -> true.
      const active = f[4] === undefined ? true : f[4] !== "0";
      state.players.push({ piece, color, start, ignores, active });
    }
    ensurePlayers(state.k);
  } catch (e) {
    state = freshDefaultState(); // any parse failure -> full defaults
  }
}

// --- per-setting Randomize / Reset ----------------------------------------
// INVARIANT: every entry below runs via doOp() or doRowOp(), which always end
// in run(). Grid has no Randomize button (deleted from the HTML) since it's
// only a 2-choice toggle — Reset All restores it.
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
    state.players[i].active = true; // Randomize All shows the full lineup
    // Color is deliberately left as-is (Randomize All does not recolor).
  }
  for (let i = 0; i < state.k; i++) {
    state.players[i].ignores = randomIgnores(i, state.k);
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
  // Players and Rounds have no per-control Randomize/Reset — they're covered
  // by Randomize All / Reset All. (Grid is a 2-choice toggle, same story.)
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
        state.players[i].ignores = randomIgnores(i, state.k);
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

// Per-row operations dispatched from the row buttons (rnd-row / rnd-prot).
// Same shape as doOp: read DOM, mutate state, push to DOM, run. Per-player
// removal is handled by unticking the row's Active checkbox — there is no
// destructive delete.
function doRowOp(kind, i) {
  readDomIntoState();
  ensurePlayers(state.k);
  if (i < 0 || i >= state.k) return;

  if (kind === "rnd-row") {
    const names = Object.keys(geom().pieces);
    state.players[i].piece = names[randInt(0, names.length - 1)];
    state.players[i].start = randInt(0, START_RAND_MAX);
    state.players[i].ignores = randomIgnores(i, state.k);
    // Color is deliberately left as-is (matches Randomize All convention).
  } else if (kind === "rnd-prot") {
    state.players[i].ignores = randomIgnores(i, state.k);
  } else {
    return;
  }

  applyStateToDom();
  run();
}

// --- wire up controls -----------------------------------------------------
// Auto-rerun on every settings change. Geom and K rebuild the player table
// first; run() picks up the new rows afterwards.
geomInput.addEventListener("change", () => {
  readDomIntoState();
  buildPlayerRows();
  run();
});
kInput.addEventListener("change", () => {
  readDomIntoState();
  buildPlayerRows();
  run();
});
nInput.addEventListener("change", run);

// One delegated handler for every .rnd / .rst button (controls, table
// header, top-actions) and every per-row button (rnd-row / rnd-prot).
document.body.addEventListener("click", (e) => {
  const rowBtn =
    e.target.closest && e.target.closest("button.rnd-row, button.rnd-prot");
  if (rowBtn && rowBtn.dataset.i !== undefined) {
    const kind = rowBtn.classList.contains("rnd-row") ? "rnd-row" : "rnd-prot";
    doRowOp(kind, +rowBtn.dataset.i);
    return;
  }
  const btn = e.target.closest && e.target.closest("button.rnd, button.rst");
  if (!btn || !btn.dataset.act) return;
  doOp(btn.dataset.act, btn.classList.contains("rnd") ? "rnd" : "rst");
});

// Enter in any input/select runs. Cheap safety net on top of the per-control
// change listeners (those fire on blur/commit; Enter is the impatient path).
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
  if (!lastRun) return alert("Nothing to export yet — change a setting first.");
  const a = document.createElement("a");
  a.href = fullImageURL();
  a.download = "spiralchess.png";
  a.click();
});

document.getElementById("open-full").addEventListener("click", () => {
  if (!lastRun) return alert("Nothing to export yet — change a setting first.");
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
