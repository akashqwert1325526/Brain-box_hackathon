/**
 * Problem 1: Maze with Keys and Doors - Web Visualizer & Solver
 * Core Engine: Bitmask BFS + Solvable Maze Generator + Canvas Renderer + Web Audio FX
 */

// Color Palette for Keys & Doors (Pair 0 to 5)
const PAIR_COLORS = [
  { name: 'Amber',  key: 'a', door: 'A', hex: '#F59E0B' },
  { name: 'Cyan',   key: 'b', door: 'B', hex: '#06B6D4' },
  { name: 'Purple', key: 'c', door: 'C', hex: '#8B5CF6' },
  { name: 'Rose',   key: 'd', door: 'D', hex: '#F43F5E' },
  { name: 'Orange', key: 'e', door: 'E', hex: '#F97316' },
  { name: 'Blue',   key: 'f', door: 'F', hex: '#3B82F6' },
];

const COLOR_MAP = {};
PAIR_COLORS.forEach(p => {
  COLOR_MAP[p.key] = p.hex;
  COLOR_MAP[p.door] = p.hex;
});

// App State
const state = {
  grid: [],
  rows: 0,
  cols: 0,
  T: 3,
  solverResult: null,
  currentStep: 0,
  isPlaying: false,
  timerId: null,
  speedMs: 180,
  soundEnabled: true,
  audioCtx: null,
};

// DOM Elements
const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');
const canvasWrapper = document.getElementById('canvasWrapper');

const inputT = document.getElementById('inputT');
const inputN = document.getElementById('inputN');
const btnGenerate = document.getElementById('btnGenerate');
const presetSelect = document.getElementById('presetSelect');
const csvFileInput = document.getElementById('csvFileInput');
const dropzone = document.getElementById('dropzone');

const btnSolve = document.getElementById('btnSolve');
const btnPlay = document.getElementById('btnPlay');
const btnReset = document.getElementById('btnReset');
const btnStepBack = document.getElementById('btnStepBack');
const btnStepForward = document.getElementById('btnStepForward');
const timelineSlider = document.getElementById('timelineSlider');
const speedSelect = document.getElementById('speedSelect');
const btnSoundToggle = document.getElementById('btnSoundToggle');

const btnExportSolution = document.getElementById('btnExportSolution');
const btnExportRaw = document.getElementById('btnExportRaw');

const statGridSize = document.getElementById('statGridSize');
const statPathLen = document.getElementById('statPathLen');
const statStep = document.getElementById('statStep');
const statusBadge = document.getElementById('statusBadge');
const eventText = document.getElementById('eventText');
const stepCoord = document.getElementById('stepCoord');
const inventoryGrid = document.getElementById('inventoryGrid');
const inventoryCounter = document.getElementById('inventoryCounter');
const toastContainer = document.getElementById('toastContainer');

// ==========================================
// Web Audio Synthesizer
// ==========================================
function getAudioContext() {
  if (!state.audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new AudioContext();
  }
  if (state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
  return state.audioCtx;
}

function playSound(type) {
  if (!state.soundEnabled) return;
  try {
    const actx = getAudioContext();
    const now = actx.currentTime;

    if (type === 'pickup') {
      // Sparkling Key Pickup Chime
      const osc1 = actx.createOscillator();
      const osc2 = actx.createOscillator();
      const gain = actx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

      osc2.frequency.setValueAtTime(880, now);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.18); // D6

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(actx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.25);
      osc2.stop(now + 0.25);

    } else if (type === 'unlock') {
      // Mechanical Door Unlock Unlatch
      const osc = actx.createOscillator();
      const gain = actx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.setValueAtTime(480, now + 0.06);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(actx.destination);

      osc.start(now);
      osc.stop(now + 0.2);

    } else if (type === 'victory') {
      // Fanfare chords on reaching Exit
      const freqs = [523.25, 659.25, 783.99, 1046.50]; // C Major
      freqs.forEach((f, idx) => {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.08);
        gain.gain.setValueAtTime(0.15, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.45);
      });
    }
  } catch (e) {
    console.warn("Audio error:", e);
  }
}

// ==========================================
// Toast Notifications
// ==========================================
function showToast(msg, icon = 'ℹ️') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 400);
  }, 2800);
}

// ==========================================
// Bitmask BFS Maze Solver
// ==========================================
function solveMaze(grid, T) {
  const rows = grid.length;
  const cols = grid[0].length;
  let start = null;
  let exit = null;
  const keys = new Map();  // "r,c" -> char
  const doors = new Map(); // "r,c" -> char

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = grid[r][c].trim();
      if (val === 'S') start = [r, c];
      else if (val === 'E') {
        if (!exit) exit = [r, c];
      } else if (val >= 'a' && val <= 'f') {
        const idx = val.charCodeAt(0) - 'a'.charCodeAt(0);
        if (idx < T) keys.set(`${r},${c}`, val);
      } else if (val >= 'A' && val <= 'F') {
        const idx = val.charCodeAt(0) - 'A'.charCodeAt(0);
        if (idx < T) doors.set(`${r},${c}`, val);
      }
    }
  }

  if (!start) throw new Error("Start 'S' missing in maze!");
  if (!exit) throw new Error("Exit 'E' missing in maze!");

  const [sr, sc] = start;
  const [er, ec] = exit;

  let startMask = 0;
  if (keys.has(`${sr},${sc}`)) {
    startMask |= (1 << (keys.get(`${sr},${sc}`).charCodeAt(0) - 'a'.charCodeAt(0)));
  }

  // BFS Queue: [r, c, mask]
  const queue = [[sr, sc, startMask]];
  const parent = new Map(); // "r,c,mask" -> [pr, pc, pmask]
  const dist = new Map();

  const startKey = `${sr},${sc},${startMask}`;
  dist.set(startKey, 0);
  parent.set(startKey, null);

  let exitState = null;
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  let head = 0;
  while (head < queue.length) {
    const [r, c, mask] = queue[head++];
    const currDist = dist.get(`${r},${c},${mask}`);

    if (r === er && c === ec) {
      exitState = [r, c, mask];
      break;
    }

    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;

      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const cell = grid[nr][nc].trim();
      if (cell === '#') continue;

      // Check Door
      const doorChar = doors.get(`${nr},${nc}`);
      if (doorChar && !(nr === er && nc === ec)) {
        const doorIdx = doorChar.charCodeAt(0) - 'A'.charCodeAt(0);
        if (!(mask & (1 << doorIdx))) continue; // Locked!
      }

      // Check Key
      let nextMask = mask;
      const keyChar = keys.get(`${nr},${nc}`);
      if (keyChar) {
        const keyIdx = keyChar.charCodeAt(0) - 'a'.charCodeAt(0);
        nextMask = mask | (1 << keyIdx);
      }

      const nextKey = `${nr},${nc},${nextMask}`;
      if (!dist.has(nextKey)) {
        dist.set(nextKey, currDist + 1);
        parent.set(nextKey, [r, c, mask]);
        queue.push([nr, nc, nextMask]);
      }
    }
  }

  if (!exitState) {
    return { shortestLength: -1, pathCoords: [], stepDetails: [] };
  }

  // Reconstruct path
  const pathStates = [];
  let curr = exitState;
  while (curr) {
    pathStates.push(curr);
    curr = parent.get(`${curr[0]},${curr[1]},${curr[2]}`);
  }
  pathStates.reverse();

  const pathCoords = pathStates.map(s => [s[0], s[1]]);
  const shortestLength = pathCoords.length - 1;

  // Step details
  const stepDetails = [];
  const heldKeys = new Set();
  const openedDoors = new Set();

  pathStates.forEach((s, idx) => {
    const [r, c, mask] = s;
    const cellVal = grid[r][c].trim();
    let keyPicked = null;
    let doorUnlocked = null;

    if (keys.has(`${r},${c}`)) {
      const k = keys.get(`${r},${c}`);
      if (!heldKeys.has(k)) {
        heldKeys.add(k);
        keyPicked = k;
      }
    }

    if (doors.has(`${r},${c}`)) {
      const d = doors.get(`${r},${c}`);
      if (!openedDoors.has(d)) {
        openedDoors.add(d);
        doorUnlocked = d;
      }
    }

    stepDetails.push({
      step: idx,
      r,
      c,
      cell: cellVal,
      keyPicked,
      doorUnlocked,
      heldKeys: Array.from(heldKeys),
      openedDoors: Array.from(openedDoors),
    });
  });

  return { shortestLength, pathCoords, stepDetails };
}

// Generate Marked Grid for CSV Export
function getMarkedGrid(grid, pathCoords) {
  const rows = grid.length;
  const cols = grid[0].length;
  const marked = grid.map(r => [...r]);
  const pathSet = new Set(pathCoords.map(p => `${p[0]},${p[1]}`));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (pathSet.has(`${r},${c}`)) {
        const val = grid[r][c].trim();
        if (val === '.') marked[r][c] = 'x';
        else if (val >= 'a' && val <= 'f') marked[r][c] = `x(${val})`;
        else if (val >= 'A' && val <= 'F') marked[r][c] = `x(${val})`;
        else if (val === 'S') marked[r][c] = 'S';
        else if (val === 'E') marked[r][c] = 'E';
        else marked[r][c] = `x(${val})`;
      }
    }
  }
  return marked;
}

// ==========================================
// Solvable Maze Generator
// ==========================================
function generateSolvableMaze(N, T) {
  N = Math.max(7, N);
  T = Math.max(1, Math.min(6, T));

  for (let attempt = 0; attempt < 80; attempt++) {
    // 1. Grid of walls
    const grid = Array.from({ length: N }, () => Array(N).fill('#'));

    // 2. Randomized DFS
    const stack = [[1, 1]];
    grid[1][1] = '.';
    const visited = new Set(['1,1']);

    while (stack.length > 0) {
      const [cr, cc] = stack[stack.length - 1];
      const neighbors = [];
      for (const [dr, dc] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
        const nr = cr + dr;
        const nc = cc + dc;
        if (nr >= 1 && nr < N - 1 && nc >= 1 && nc < N - 1 && !visited.has(`${nr},${nc}`)) {
          neighbors.push([nr, nc, cr + dr / 2, cc + dc / 2]);
        }
      }

      if (neighbors.length > 0) {
        const [nr, nc, wr, wc] = neighbors[Math.floor(Math.random() * neighbors.length)];
        grid[wr][wc] = '.';
        grid[nr][nc] = '.';
        visited.add(`${nr},${nc}`);
        stack.push([nr, nc]);
      } else {
        stack.pop();
      }
    }

    // Add extra connections to create loops
    for (let r = 2; r < N - 2; r++) {
      for (let c = 2; c < N - 2; c++) {
        if (grid[r][c] === '#' && Math.random() < 0.12) {
          if ((grid[r-1][c] === '.' && grid[r+1][c] === '.') || (grid[r][c-1] === '.' && grid[r][c+1] === '.')) {
            grid[r][c] = '.';
          }
        }
      }
    }

    const openCells = [];
    for (let r = 1; r < N - 1; r++) {
      for (let c = 1; c < N - 1; c++) {
        if (grid[r][c] === '.') openCells.push([r, c]);
      }
    }

    if (openCells.length < 2 * T + 2) continue;

    // S at top-left, E at bottom-right
    openCells.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
    const sPos = openCells[0];
    const ePos = openCells[openCells.length - 1];

    grid[sPos[0]][sPos[1]] = 'S';
    grid[ePos[0]][ePos[1]] = 'E';

    // Distances from S
    const distFromS = new Map([[`${sPos[0]},${sPos[1]}`, 0]]);
    const q = [sPos];
    let qh = 0;
    while (qh < q.length) {
      const [cr, cc] = q[qh++];
      const d = distFromS.get(`${cr},${cc}`);
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = cr + dr;
        const nc = cc + dc;
        if (nr >= 0 && nr < N && nc >= 0 && nc < N && grid[nr][nc] !== '#' && !distFromS.has(`${nr},${nc}`)) {
          distFromS.set(`${nr},${nc}`, d + 1);
          q.push([nr, nc]);
        }
      }
    }

    const candidateCells = openCells.filter(p => (p[0] !== sPos[0] || p[1] !== sPos[1]) && (p[0] !== ePos[0] || p[1] !== ePos[1]));
    candidateCells.sort((a, b) => (distFromS.get(`${a[0]},${a[1]}`) || 0) - (distFromS.get(`${b[0]},${b[1]}`) || 0));

    const tierSize = Math.max(2, Math.floor(candidateCells.length / (T + 1)));
    let placementOk = true;

    for (let i = 0; i < T; i++) {
      const keyChar = String.fromCharCode('a'.charCodeAt(0) + i);
      const doorChar = String.fromCharCode('A'.charCodeAt(0) + i);

      const kPool = candidateCells.slice(i * tierSize, (i + 1) * tierSize);
      let dPool = candidateCells.slice((i + 1) * tierSize, (i + 2) * tierSize);
      if (dPool.length === 0) dPool = candidateCells.slice((i + 1) * tierSize);

      if (kPool.length === 0 || dPool.length === 0) {
        placementOk = false;
        break;
      }

      const kp = kPool[Math.floor(Math.random() * kPool.length)];
      const dp = dPool[Math.floor(Math.random() * dPool.length)];

      grid[kp[0]][kp[1]] = keyChar;
      grid[dp[0]][dp[1]] = doorChar;

      // Remove from candidate pool
      const kIdx = candidateCells.indexOf(kp);
      if (kIdx !== -1) candidateCells.splice(kIdx, 1);
      const dIdx = candidateCells.indexOf(dp);
      if (dIdx !== -1) candidateCells.splice(dIdx, 1);
    }

    if (!placementOk) continue;

    // Check with solver
    const res = solveMaze(grid, T);
    if (res.shortestLength > 0) {
      return grid;
    }
  }

  // Fallback guaranteed serpentine maze
  return generateFallbackMaze(N, T);
}

function generateFallbackMaze(N, T) {
  const grid = Array.from({ length: N }, () => Array(N).fill('#'));
  const path = [];
  let r = 1;
  let dir = 1;
  while (r < N - 1) {
    if (dir === 1) {
      for (let c = 1; c < N - 1; c++) { grid[r][c] = '.'; path.push([r, c]); }
    } else {
      for (let c = N - 2; c >= 1; c--) { grid[r][c] = '.'; path.push([r, c]); }
    }
    if (r + 1 < N - 1) {
      const turnC = (dir === 1) ? N - 2 : 1;
      grid[r + 1][turnC] = '.';
      path.push([r + 1, turnC]);
    }
    r += 2;
    dir *= -1;
  }

  const sPos = path[0];
  const ePos = path[path.length - 1];
  grid[sPos[0]][sPos[1]] = 'S';
  grid[ePos[0]][ePos[1]] = 'E';

  const step = Math.floor((path.length - 2) / (2 * T + 1));
  for (let i = 0; i < T; i++) {
    const kp = path[1 + (2 * i) * step + Math.floor(step / 2)];
    const dp = path[1 + (2 * i + 1) * step + Math.floor(step / 2)];
    grid[kp[0]][kp[1]] = String.fromCharCode('a'.charCodeAt(0) + i);
    grid[dp[0]][dp[1]] = String.fromCharCode('A'.charCodeAt(0) + i);
  }
  return grid;
}

// ==========================================
// Canvas Renderer
// ==========================================
function render() {
  if (!state.grid || state.grid.length === 0) return;

  const rect = canvasWrapper.getBoundingClientRect();
  const maxW = Math.max(300, rect.width - 24);
  const maxH = Math.max(300, rect.height - 24);

  const rows = state.rows;
  const cols = state.cols;

  const cellSize = Math.max(6, Math.min(Math.floor(maxW / cols), Math.floor(maxH / rows), 48));
  const gridW = cols * cellSize;
  const gridH = rows * cellSize;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = gridW * dpr;
  canvas.height = gridH * dpr;
  canvas.style.width = `${gridW}px`;
  canvas.style.height = `${gridH}px`;

  ctx.save();
  ctx.scale(dpr, dpr);

  // Active step details
  const stepIdx = state.currentStep;
  const details = state.solverResult ? state.solverResult.stepDetails : [];
  const currentDetail = (details && stepIdx < details.length) ? details[stepIdx] : null;

  const heldKeys = new Set(currentDetail ? currentDetail.heldKeys : []);
  const unlockedDoors = new Set();
  if (details) {
    for (let i = 0; i <= stepIdx && i < details.length; i++) {
      if (details[i].doorUnlocked) {
        unlockedDoors.add(`${details[i].r},${details[i].c}`);
      }
    }
  }

  const pathCoords = state.solverResult ? state.solverResult.pathCoords : [];
  const visitedPath = pathCoords.slice(0, stepIdx + 1);
  const visitedSet = new Set(visitedPath.map(p => `${p[0]},${p[1]}`));
  const agentPos = pathCoords[stepIdx] || null;

  // Background
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, gridW, gridH);

  // Draw cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellSize;
      const y = r * cellSize;
      const cell = state.grid[r][c].trim();

      let cellColor = '#ffffff'; // White open cell
      let text = '';
      let textColor = '#000000';
      let isUnlockedDoor = false;

      if (cell === '#') {
        cellColor = '#18181b'; // Black wall
      } else if (cell === 'S') {
        cellColor = '#10b981'; // Green Start
        text = 'S';
        textColor = '#ffffff';
      } else if (cell === 'E') {
        cellColor = '#ef4444'; // Red Exit
        text = 'E';
        textColor = '#ffffff';
      } else if (cell >= 'a' && cell <= 'f') {
        // Key cell
        if (heldKeys.has(cell)) {
          // Key disappears! Turns to open / path color
          cellColor = visitedSet.has(`${r},${c}`) ? '#fef08a' : '#ffffff';
          text = '·';
          textColor = '#94a3b8';
        } else {
          cellColor = COLOR_MAP[cell] || '#f59e0b';
          text = cell;
          textColor = '#ffffff';
        }
      } else if (cell >= 'A' && cell <= 'F') {
        // Door cell
        if (unlockedDoors.has(`${r},${c}`)) {
          // Door turns from its color to WHITE with unlock mark 🔓
          cellColor = '#ffffff';
          isUnlockedDoor = true;
          text = '🔓';
          textColor = '#059669';
        } else {
          cellColor = COLOR_MAP[cell] || '#f59e0b';
          text = cell;
          textColor = '#ffffff';
        }
      }

      // If open cell is on visited path
      if (cell === '.' && visitedSet.has(`${r},${c}`)) {
        cellColor = '#fef08a'; // Subtle warm path highlight
      }

      // Fill Cell
      ctx.fillStyle = cellColor;
      ctx.fillRect(x, y, cellSize, cellSize);

      // Border
      ctx.strokeStyle = (cell === '#') ? '#090d16' : '#cbd5e1';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x, y, cellSize, cellSize);

      // Render Label / Icon
      if (text && cellSize >= 14) {
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const fontSize = Math.max(9, Math.floor(cellSize * (isUnlockedDoor ? 0.55 : 0.48)));
        ctx.font = `bold ${fontSize}px "Outfit", sans-serif`;
        ctx.fillText(text, x + cellSize / 2, y + cellSize / 2 + 1);
      }
    }
  }

  // Draw Glowing Path Connector Line
  if (visitedPath.length > 1 && cellSize >= 8) {
    ctx.beginPath();
    visitedPath.forEach(([pr, pc], idx) => {
      const cx = pc * cellSize + cellSize / 2;
      const cy = pr * cellSize + cellSize / 2;
      if (idx === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
    ctx.lineWidth = Math.max(2, cellSize * 0.16);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // Draw Animated Agent Avatar
  if (agentPos) {
    const [ar, ac] = agentPos;
    const cx = ac * cellSize + cellSize / 2;
    const cy = ar * cellSize + cellSize / 2;
    const radius = Math.max(4, cellSize * 0.36);

    // Halo pulse
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Agent Core
    const grad = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, radius);
    grad.addColorStop(0, '#818cf8');
    grad.addColorStop(1, '#4f46e5');
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

// Update HUD & Status UI
function updateHUD() {
  const stepIdx = state.currentStep;
  const pathCoords = state.solverResult ? state.solverResult.pathCoords : [];
  const details = state.solverResult ? state.solverResult.stepDetails : [];
  const currentDetail = (details && stepIdx < details.length) ? details[stepIdx] : null;

  statGridSize.textContent = `${state.rows}×${state.cols}`;
  statStep.textContent = `${stepIdx} / ${Math.max(0, pathCoords.length - 1)}`;

  if (state.solverResult && state.solverResult.shortestLength !== -1) {
    statPathLen.textContent = `${state.solverResult.shortestLength} steps`;
    statusBadge.textContent = 'Solvable';
    statusBadge.style.borderColor = '#10b981';
    statusBadge.style.color = '#34d399';
  } else if (state.solverResult) {
    statPathLen.textContent = '-1';
    statusBadge.textContent = 'Unsolvable';
    statusBadge.style.borderColor = '#ef4444';
    statusBadge.style.color = '#f87171';
  }

  // Event text banner
  if (currentDetail) {
    stepCoord.textContent = `(${currentDetail.r}, ${currentDetail.c})`;
    if (currentDetail.keyPicked) {
      eventText.innerHTML = `<span style="color: #f59e0b; font-size: 1.1rem;">🗝️</span> Picked up <strong>Key '${currentDetail.keyPicked}'</strong>! Inventory updated.`;
    } else if (currentDetail.doorUnlocked) {
      eventText.innerHTML = `<span style="color: #10b981; font-size: 1.1rem;">🔓</span> Unlocked <strong>Door '${currentDetail.doorUnlocked}'</strong> with matching key!`;
    } else if (currentDetail.cell === 'S') {
      eventText.innerHTML = `<span>🟢</span> Starting path search at <strong>Start 'S'</strong>.`;
    } else if (currentDetail.cell === 'E') {
      eventText.innerHTML = `<span style="color: #ef4444; font-size: 1.1rem;">🏁</span> Reached <strong>Exit 'E'</strong>! Shortest path complete.`;
    } else {
      eventText.innerHTML = `<span>👣</span> Step ${stepIdx}: Moving along path.`;
    }
  }

  // Update Key Inventory Slots
  const heldKeys = new Set(currentDetail ? currentDetail.heldKeys : []);
  inventoryCounter.textContent = `${heldKeys.size} / ${state.T} Held`;

  PAIR_COLORS.forEach((p, idx) => {
    const slot = document.getElementById(`invSlot_${p.key}`);
    if (slot) {
      if (idx >= state.T) {
        slot.style.display = 'none';
      } else {
        slot.style.display = 'flex';
        if (heldKeys.has(p.key)) {
          if (!slot.classList.contains('unlocked')) {
            slot.classList.remove('locked');
            slot.classList.add('unlocked');
          }
          slot.querySelector('.slot-status').textContent = 'HELD ✓';
        } else {
          slot.classList.remove('unlocked');
          slot.classList.add('locked');
          slot.querySelector('.slot-status').textContent = 'LOCKED';
        }
      }
    }
  });
}

// Build Inventory Slots HTML
function buildInventoryDOM() {
  inventoryGrid.innerHTML = '';
  PAIR_COLORS.forEach((p, idx) => {
    const slot = document.createElement('div');
    slot.id = `invSlot_${p.key}`;
    slot.className = 'inventory-slot locked';
    slot.style.setProperty('--slot-color', p.hex);
    slot.innerHTML = `
      <div class="slot-icon">${p.key}</div>
      <div class="slot-info">
        <span class="slot-name">Key ${p.key.toUpperCase()}</span>
        <span class="slot-status">LOCKED</span>
      </div>
    `;
    inventoryGrid.appendChild(slot);
  });
}

// ==========================================
// Playback Engine
// ==========================================
function setStep(newStep) {
  if (!state.solverResult || state.solverResult.pathCoords.length === 0) return;
  const maxStep = state.solverResult.pathCoords.length - 1;
  const clamped = Math.max(0, Math.min(newStep, maxStep));

  // Check sounds
  if (state.solverResult.stepDetails && clamped < state.solverResult.stepDetails.length) {
    const detail = state.solverResult.stepDetails[clamped];
    if (clamped > state.currentStep) {
      if (detail.keyPicked) playSound('pickup');
      else if (detail.doorUnlocked) playSound('unlock');
      else if (clamped === maxStep) playSound('victory');
    }
  }

  state.currentStep = clamped;
  timelineSlider.value = clamped;
  render();
  updateHUD();
}

function play() {
  if (state.isPlaying) return;
  if (!state.solverResult || state.solverResult.shortestLength === -1) {
    showToast("Maze is unsolvable or not loaded!", "⚠️");
    return;
  }
  const maxStep = state.solverResult.pathCoords.length - 1;
  if (state.currentStep >= maxStep) {
    setStep(0);
  }
  state.isPlaying = true;
  btnPlay.textContent = '⏸ Pause';
  btnPlay.className = 'btn btn-amber';

  state.timerId = setInterval(() => {
    if (state.currentStep < maxStep) {
      setStep(state.currentStep + 1);
    } else {
      pause();
    }
  }, state.speedMs);
}

function pause() {
  state.isPlaying = false;
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
  btnPlay.textContent = '▶ Play';
  btnPlay.className = 'btn btn-success';
}

function togglePlay() {
  if (state.isPlaying) pause();
  else play();
}

// ==========================================
// High-Level Actions
// ==========================================
function loadGrid(grid, T) {
  pause();
  state.grid = grid;
  state.rows = grid.length;
  state.cols = grid[0].length;
  state.T = Math.max(1, Math.min(6, T));
  inputT.value = state.T;
  inputN.value = Math.max(state.rows, state.cols);

  buildInventoryDOM();

  try {
    state.solverResult = solveMaze(grid, state.T);
    const maxStep = Math.max(0, state.solverResult.pathCoords.length - 1);
    timelineSlider.max = maxStep;
    timelineSlider.value = 0;
    setStep(0);
    render();
    updateHUD();

    if (state.solverResult.shortestLength !== -1) {
      showToast(`Found shortest path: ${state.solverResult.shortestLength} steps!`, '✅');
    } else {
      showToast("Maze is unsolvable (-1)", '❌');
    }
  } catch (err) {
    showToast(err.message, '⚠️');
  }
}

// Presets
const PRESETS = {
  small: {
    T: 1,
    grid: [
      ['S', '.', '.', '#', '.', '.', 'a'],
      ['#', '#', '.', '#', '.', '#', '#'],
      ['.', '.', '.', '.', '.', '.', '.'],
      ['.', '#', '#', '#', '#', '#', '.'],
      ['.', '.', '.', '.', '.', '.', '.'],
      ['#', '#', '#', '#', '#', 'A', '#'],
      ['.', '.', '.', '.', '.', '.', 'E']
    ]
  }
};

// ==========================================
// CSV Importer & Exporter
// ==========================================
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const grid = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (row.length > 0) grid.push(row);
  }
  return grid;
}

function exportCSV(grid, filename) {
  const csvContent = grid.map(r => r.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ==========================================
// Event Listeners
// ==========================================
btnGenerate.addEventListener('click', () => {
  const N = parseInt(inputN.value, 10) || 15;
  const T = parseInt(inputT.value, 10) || 3;
  showToast(`Generating solvable ${N}×${N} maze with ${T} keys...`, '⏳');
  setTimeout(() => {
    const grid = generateSolvableMaze(N, T);
    loadGrid(grid, T);
    presetSelect.value = 'custom';
  }, 30);
});

presetSelect.addEventListener('change', (e) => {
  const val = e.target.value;
  if (val === 'small') {
    loadGrid(PRESETS.small.grid, PRESETS.small.T);
  } else if (val === 'multikey') {
    const grid = generateSolvableMaze(15, 3);
    loadGrid(grid, 3);
  } else if (val === 'large') {
    const grid = generateSolvableMaze(21, 5);
    loadGrid(grid, 5);
  }
});

btnSolve.addEventListener('click', () => {
  if (!state.grid) return;
  loadGrid(state.grid, parseInt(inputT.value, 10) || state.T);
  setTimeout(() => play(), 200);
});

btnPlay.addEventListener('click', togglePlay);
btnReset.addEventListener('click', () => { pause(); setStep(0); });
btnStepBack.addEventListener('click', () => { pause(); setStep(state.currentStep - 1); });
btnStepForward.addEventListener('click', () => { pause(); setStep(state.currentStep + 1); });

timelineSlider.addEventListener('input', (e) => {
  pause();
  setStep(parseInt(e.target.value, 10));
});

speedSelect.addEventListener('change', (e) => {
  state.speedMs = parseInt(e.target.value, 10);
  if (state.isPlaying) {
    pause();
    play();
  }
});

btnSoundToggle.addEventListener('click', () => {
  state.soundEnabled = !state.soundEnabled;
  btnSoundToggle.textContent = state.soundEnabled ? '🔊 Sound ON' : '🔇 Sound OFF';
  btnSoundToggle.className = state.soundEnabled ? 'btn btn-secondary' : 'btn btn-secondary';
});

// CSV Upload & Drag and Drop
dropzone.addEventListener('click', () => csvFileInput.click());
csvFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const grid = parseCSV(evt.target.result);
      if (grid.length === 0) throw new Error("Empty CSV");
      loadGrid(grid, parseInt(inputT.value, 10) || 3);
      presetSelect.value = 'custom';
      showToast(`Loaded ${grid.length}×${grid[0].length} maze from CSV!`, '📂');
    } catch (err) {
      showToast(`Error parsing CSV: ${err.message}`, '❌');
    }
  };
  reader.readAsText(file);
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const grid = parseCSV(evt.target.result);
      loadGrid(grid, parseInt(inputT.value, 10) || 3);
      presetSelect.value = 'custom';
      showToast(`Loaded ${grid.length}×${grid[0].length} maze from CSV!`, '📂');
    } catch (err) {
      showToast(`Error parsing CSV: ${err.message}`, '❌');
    }
  };
  reader.readAsText(file);
});

// CSV Exports
btnExportSolution.addEventListener('click', () => {
  if (!state.solverResult || state.solverResult.shortestLength === -1) {
    showToast("No valid solution path to export!", '⚠️');
    return;
  }
  const marked = getMarkedGrid(state.grid, state.solverResult.pathCoords);
  exportCSV(marked, 'maze_solution.csv');
  showToast("Solution CSV downloaded!", '💾');
});

btnExportRaw.addEventListener('click', () => {
  if (!state.grid) return;
  exportCSV(state.grid, 'maze_grid.csv');
  showToast("Maze Grid CSV downloaded!", '📋');
});

window.addEventListener('resize', () => render());

// Initialize Default Maze
window.addEventListener('DOMContentLoaded', () => {
  buildInventoryDOM();
  const initGrid = generateSolvableMaze(15, 3);
  loadGrid(initGrid, 3);
});
