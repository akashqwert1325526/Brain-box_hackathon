/**
 * Problem 3: Budget Traveller with Coupons - Web Visualizer & Solver
 * Features:
 * - Directed weighted graph with cities as nodes and flights as edges
 * - Multi-dimensional Dijkstra solver matching BudgetTraveller.java: (city, flights, coupons)
 * - Color coding: Start = Green, Destination = Red, Intermediate Stops = Orange
 * - Chosen path highlighting with animated glowing energy pulses
 * - Golden flight transform when coupon is applied with original price -> discounted price
 * - Live animated journey playback with airplane avatar, running cost HUD, stops counter, and sound FX
 * - Interactive draggable nodes, auto-layout algorithms, CSV dropzone & export
 */

(function () {
  'use strict';

  // --- State ---
  const tState = {
    N: 5,
    K: 2,
    C: 1,
    flights: [],
    cityCoords: {},      // cityId -> { x, y, vx, vy, isDragging }
    solution: null,      // { minCost, path }
    currentStep: 0,      // 0 to path.length
    isPlaying: false,
    animT: 0,            // interpolation factor 0..1 for current flight hop
    animHopIndex: 0,
    animFrameId: null,
    speedMs: 1200,       // duration per flight hop in ms
    soundEnabled: true,
    audioCtx: null,
    dragNodeId: null,
    dragOffset: { x: 0, y: 0 },
    goldParticles: [],
    layoutMode: 'circle' // 'circle', 'force', 'layered'
  };

  // --- Sound FX via Web Audio API ---
  function getAudioContext() {
    if (!tState.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      tState.audioCtx = new AudioCtx();
    }
    if (tState.audioCtx.state === 'suspended') {
      tState.audioCtx.resume();
    }
    return tState.audioCtx;
  }

  function playTravellerSound(type) {
    if (!tState.soundEnabled) return;
    try {
      const actx = getAudioContext();
      const now = actx.currentTime;

      if (type === 'flight') {
        // Jet whoosh / flight hum
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.25);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.start(now);
        osc.stop(now + 0.32);
      } else if (type === 'coupon') {
        // Celebratory Cash / Gold Discount Chime (Arpeggio + Bell)
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = actx.createOscillator();
          const gain = actx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.07);
          gain.gain.setValueAtTime(0.18, now + i * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.35);
          osc.connect(gain);
          gain.connect(actx.destination);
          osc.start(now + i * 0.07);
          osc.stop(now + i * 0.07 + 0.38);
        });
      } else if (type === 'arrival') {
        // Destination fanfare
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
          const osc = actx.createOscillator();
          const gain = actx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.09);
          gain.gain.setValueAtTime(0.2, now + i * 0.09);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.5);
          osc.connect(gain);
          gain.connect(actx.destination);
          osc.start(now + i * 0.09);
          osc.stop(now + i * 0.09 + 0.55);
        });
      }
    } catch (e) {
      // Audio autoplay policy
    }
  }

  // --- Presets ---
  const PRESETS = {
    standard4: {
      name: "Standard 4 Cities (K=1, C=1, Optimal $300)",
      N: 4, K: 1, C: 1,
      flights: [
        { id: 1, u: 1, v: 2, price: 100 },
        { id: 2, u: 2, v: 4, price: 500 },
        { id: 3, u: 1, v: 3, price: 200 },
        { id: 4, u: 3, v: 4, price: 200 },
        { id: 5, u: 1, v: 4, price: 1000 },
      ]
    },
    sample5: {
      name: "Sample 5 Cities (sample_flights.csv, K=2, C=1)",
      N: 5, K: 2, C: 1,
      flights: [
        { id: 1, u: 1, v: 2, price: 150 },
        { id: 2, u: 2, v: 4, price: 300 },
        { id: 3, u: 1, v: 3, price: 200 },
        { id: 4, u: 3, v: 4, price: 180 },
        { id: 5, u: 2, v: 3, price: 50 },
        { id: 6, u: 1, v: 4, price: 800 },
        { id: 7, u: 4, v: 5, price: 400 },
        { id: 8, u: 3, v: 5, price: 600 },
        { id: 9, u: 2, v: 5, price: 700 },
      ]
    },
    generated5: {
      name: "Java Generated 5 Cities (generated_flights.csv, K=2, C=1)",
      N: 5, K: 2, C: 1,
      flights: [
        { id: 1, u: 1, v: 2, price: 104 },
        { id: 2, u: 2, v: 3, price: 618 },
        { id: 3, u: 3, v: 5, price: 110 },
        { id: 4, u: 5, v: 3, price: 99 },
        { id: 5, u: 4, v: 2, price: 824 },
        { id: 6, u: 5, v: 4, price: 973 },
        { id: 7, u: 3, v: 1, price: 396 },
        { id: 8, u: 1, v: 4, price: 643 },
      ]
    },
    complex8: {
      name: "Complex Hub 8 Cities (K=3, C=2)",
      N: 8, K: 3, C: 2,
      flights: [
        { id: 1, u: 1, v: 2, price: 250 },
        { id: 2, u: 1, v: 3, price: 180 },
        { id: 3, u: 2, v: 4, price: 400 },
        { id: 4, u: 3, v: 4, price: 300 },
        { id: 5, u: 4, v: 6, price: 550 },
        { id: 6, u: 3, v: 5, price: 700 },
        { id: 7, u: 5, v: 7, price: 350 },
        { id: 8, u: 6, v: 8, price: 900 },
        { id: 9, u: 7, v: 8, price: 280 },
        { id: 10, u: 2, v: 6, price: 850 },
        { id: 11, u: 4, v: 7, price: 420 },
        { id: 12, u: 1, v: 5, price: 950 },
      ]
    }
  };

  // --- Algorithm: Modified Dijkstra on (city, flights, coupons) ---
  function solveBudgetDijkstra(N, flights, K, C) {
    if (N <= 1) return { minCost: 0, path: [] };

    const maxFlights = K + 1;
    const maxCoupons = Math.min(C, maxFlights);

    const adj = Array.from({ length: N + 1 }, () => []);
    flights.forEach((f) => {
      if (f.u >= 1 && f.u <= N && f.v >= 1 && f.v <= N) {
        adj[f.u].push(f);
      }
    });

    // dist[city][flights][coupons]
    const dist = Array.from({ length: N + 1 }, () =>
      Array.from({ length: maxFlights + 1 }, () =>
        new Array(maxCoupons + 1).fill(Infinity)
      )
    );
    const parent = Array.from({ length: N + 1 }, () =>
      Array.from({ length: maxFlights + 1 }, () =>
        new Array(maxCoupons + 1).fill(null)
      )
    );

    // Min-Heap Priority Queue
    class MinPQ {
      constructor() { this.heap = []; }
      push(node) {
        this.heap.push(node);
        this._bubbleUp(this.heap.length - 1);
      }
      pop() {
        if (this.heap.length === 0) return null;
        const top = this.heap[0];
        const last = this.heap.pop();
        if (this.heap.length > 0) {
          this.heap[0] = last;
          this._bubbleDown(0);
        }
        return top;
      }
      isEmpty() { return this.heap.length === 0; }
      _bubbleUp(idx) {
        while (idx > 0) {
          const p = Math.floor((idx - 1) / 2);
          if (this.heap[idx].cost < this.heap[p].cost) {
            [this.heap[idx], this.heap[p]] = [this.heap[p], this.heap[idx]];
            idx = p;
          } else break;
        }
      }
      _bubbleDown(idx) {
        const len = this.heap.length;
        while (true) {
          const left = 2 * idx + 1;
          const right = 2 * idx + 2;
          let smallest = idx;
          if (left < len && this.heap[left].cost < this.heap[smallest].cost) smallest = left;
          if (right < len && this.heap[right].cost < this.heap[smallest].cost) smallest = right;
          if (smallest !== idx) {
            [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
            idx = smallest;
          } else break;
        }
      }
    }

    const pq = new MinPQ();
    dist[1][0][0] = 0;
    pq.push({ cost: 0, city: 1, flights: 0, coupons: 0 });

    let target = null;

    while (!pq.isEmpty()) {
      const curr = pq.pop();

      if (curr.city === N) {
        target = curr;
        break;
      }

      if (curr.cost > dist[curr.city][curr.flights][curr.coupons]) continue;
      if (curr.flights >= maxFlights) continue;

      for (const edge of adj[curr.city]) {
        const nextCity = edge.v;
        const nextFlights = curr.flights + 1;

        // Option A: Fly without coupon
        const costWithout = curr.cost + edge.price;
        if (costWithout < dist[nextCity][nextFlights][curr.coupons]) {
          dist[nextCity][nextFlights][curr.coupons] = costWithout;
          parent[nextCity][nextFlights][curr.coupons] = {
            prevCity: curr.city,
            prevFlights: curr.flights,
            prevCoupons: curr.coupons,
            flight: edge,
            couponUsed: false,
            paidCost: edge.price
          };
          pq.push({ cost: costWithout, city: nextCity, flights: nextFlights, coupons: curr.coupons });
        }

        // Option B: Fly with coupon (halves ticket price, floor)
        if (curr.coupons < maxCoupons) {
          const nextCoupons = curr.coupons + 1;
          const discounted = Math.floor(edge.price / 2);
          const costWith = curr.cost + discounted;
          if (costWith < dist[nextCity][nextFlights][nextCoupons]) {
            dist[nextCity][nextFlights][nextCoupons] = costWith;
            parent[nextCity][nextFlights][nextCoupons] = {
              prevCity: curr.city,
              prevFlights: curr.flights,
              prevCoupons: curr.coupons,
              flight: edge,
              couponUsed: true,
              paidCost: discounted
            };
            pq.push({ cost: costWith, city: nextCity, flights: nextFlights, coupons: nextCoupons });
          }
        }
      }
    }

    if (!target) return { minCost: -1, path: [] };

    // Reconstruct path
    const path = [];
    let curCity = target.city;
    let curFlights = target.flights;
    let curCoupons = target.coupons;

    while (curCity !== 1 || curFlights !== 0) {
      const p = parent[curCity][curFlights][curCoupons];
      if (!p) break;
      path.push({
        flight: p.flight,
        couponUsed: p.couponUsed,
        paidCost: p.paidCost,
        fromCity: p.prevCity,
        toCity: curCity,
        originalPrice: p.flight.price
      });
      curCity = p.prevCity;
      curFlights = p.prevFlights;
      curCoupons = p.prevCoupons;
    }

    path.reverse();
    return { minCost: target.cost, path };
  }

  // --- Graph Auto-Layouts ---
  function computeLayout(N, mode = 'circle', canvasW = 850, canvasH = 500) {
    const coords = {};
    const paddingX = 85;
    const paddingY = 65;
    const innerW = Math.max(500, canvasW - paddingX * 2);
    const innerH = Math.max(340, canvasH - paddingY * 2);
    const cx = canvasW / 2;
    const cy = canvasH / 2;

    const rx = innerW * 0.44;
    const ry = innerH * 0.40;

    if (mode === 'circle') {
      // Start (City 1) on far left
      coords[1] = { x: cx - rx, y: cy, radius: 28 };
      // Destination (City N) on far right
      coords[N] = { x: cx + rx, y: cy, radius: 28 };

      const interCount = N - 2;
      if (interCount > 0) {
        // Distribute intermediate cities cleanly across top and bottom arcs
        const topCount = Math.ceil(interCount / 2);
        const bottomCount = interCount - topCount;

        // Top arc: cities 2 to 1 + topCount
        for (let i = 1; i <= topCount; i++) {
          const cityId = 1 + i;
          const angle = Math.PI + (i / (topCount + 1)) * Math.PI; // In [PI, 2*PI]
          coords[cityId] = {
            x: cx + rx * Math.cos(angle),
            y: cy + ry * Math.sin(angle),
            radius: 26
          };
        }

        // Bottom arc: remaining intermediate cities
        for (let j = 1; j <= bottomCount; j++) {
          const cityId = 1 + topCount + j;
          const angle = Math.PI - (j / (bottomCount + 1)) * Math.PI; // In [0, PI]
          coords[cityId] = {
            x: cx + rx * Math.cos(angle),
            y: cy + ry * Math.sin(angle),
            radius: 26
          };
        }
      }
    } else if (mode === 'layered') {
      coords[1] = { x: paddingX + 20, y: cy, radius: 28 };
      coords[N] = { x: canvasW - paddingX - 20, y: cy, radius: 28 };

      const interCount = N - 2;
      const cols = Math.max(1, Math.ceil(interCount / 2));
      const colW = (innerW - 100) / (cols + 1);

      let placed = 0;
      for (let col = 1; col <= cols && placed < interCount; col++) {
        const inThisCol = (placed + 2 <= interCount) ? 2 : 1;
        for (let row = 0; row < inThisCol && placed < interCount; row++) {
          const cityId = 2 + placed;
          const yOffset = inThisCol === 1 ? cy : cy + (row === 0 ? -ry * 0.75 : ry * 0.75);
          coords[cityId] = {
            x: paddingX + 50 + col * colW,
            y: yOffset,
            radius: 26
          };
          placed++;
        }
      }
    } else {
      // Grid fallback
      const cols = Math.ceil(Math.sqrt(N));
      const rows = Math.ceil(N / cols);
      for (let i = 1; i <= N; i++) {
        const c = (i - 1) % cols;
        const r = Math.floor((i - 1) / cols);
        coords[i] = {
          x: paddingX + (c / (cols - 1 || 1)) * innerW,
          y: paddingY + (r / (rows - 1 || 1)) * innerH,
          radius: 26
        };
      }
    }

    return coords;
  }

  // Solvable Random Graph Generator
  function generateSolvableFlightNetwork(N = 6, M = 11, K = 2) {
    const flights = [];
    let nextId = 1;

    // Guaranteed path from 1 to N with stops <= K
    const actualStops = Math.min(K, N - 2);
    const chosenStops = [];
    const available = [];
    for (let i = 2; i < N; i++) available.push(i);
    // Shuffle available
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    for (let i = 0; i < actualStops; i++) {
      chosenStops.push(available[i]);
    }

    // Build backbone route
    const backbone = [1, ...chosenStops, N];
    for (let i = 0; i < backbone.length - 1; i++) {
      const u = backbone[i];
      const v = backbone[i + 1];
      const price = Math.floor(Math.random() * 600) + 100;
      flights.push({ id: nextId++, u, v, price });
    }

    // Add extra random flights
    const existing = new Set(flights.map(f => `${f.u}->${f.v}`));
    let attempts = 0;
    while (flights.length < M && attempts < 100) {
      attempts++;
      const u = Math.floor(Math.random() * N) + 1;
      const v = Math.floor(Math.random() * N) + 1;
      if (u !== v && !existing.has(`${u}->${v}`)) {
        existing.add(`${u}->${v}`);
        const price = Math.floor(Math.random() * 850) + 80;
        flights.push({ id: nextId++, u, v, price });
      }
    }

    return flights;
  }

  // --- Canvas Rendering Engine ---
  let canvas, ctx;

  function initCanvas() {
    canvas = document.getElementById('travellerCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', () => {
      resizeCanvas();
      renderGraph();
    });
    setupMouseInteraction();
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width > 50 ? rect.width : 850;
    const h = rect.height > 50 ? rect.height : 520;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);

    if (!tState.hasCustomLayout && tState.N) {
      tState.cityCoords = computeLayout(tState.N, tState.layoutMode, w, h);
    }
  }

  function setupMouseInteraction() {
    let isDown = false;

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }

    canvas.addEventListener('mousedown', (e) => {
      const pos = getPos(e);
      for (const [id, c] of Object.entries(tState.cityCoords)) {
        const dx = pos.x - c.x;
        const dy = pos.y - c.y;
        if (Math.hypot(dx, dy) <= c.radius + 6) {
          tState.dragNodeId = parseInt(id, 10);
          tState.dragOffset = { x: dx, y: dy };
          isDown = true;
          canvas.style.cursor = 'grabbing';
          return;
        }
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDown || !tState.dragNodeId) {
        // Hover cursor
        if (canvas) {
          const pos = getPos(e);
          let hover = false;
          for (const c of Object.values(tState.cityCoords)) {
            if (Math.hypot(pos.x - c.x, pos.y - c.y) <= c.radius) {
              hover = true;
              break;
            }
          }
          canvas.style.cursor = hover ? 'grab' : 'default';
        }
        return;
      }
      const pos = getPos(e);
      const c = tState.cityCoords[tState.dragNodeId];
      if (c) {
        c.x = Math.max(30, Math.min(canvas.clientWidth - 30, pos.x - tState.dragOffset.x));
        c.y = Math.max(30, Math.min(canvas.clientHeight - 30, pos.y - tState.dragOffset.y));
        renderGraph();
      }
    });

    window.addEventListener('mouseup', () => {
      if (isDown) {
        isDown = false;
        tState.dragNodeId = null;
        if (canvas) canvas.style.cursor = 'grab';
      }
    });
  }

  // Quadratic curve midpoint calculator for flight arrows
  function getEdgeCurve(c1, c2, curvature = 0) {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const dist = Math.hypot(dx, dy);
    const mx = (c1.x + c2.x) / 2;
    const my = (c1.y + c2.y) / 2;

    if (dist < 0.001) return { qx: mx, qy: my, mx, my };

    // Normal vector perpendicular to edge
    const nx = -dy / dist;
    const ny = dx / dist;

    const qx = mx + nx * curvature;
    const qy = my + ny * curvature;

    // Apex point of quadratic curve at t = 0.5: B(0.5) = 0.25*P0 + 0.5*Q + 0.25*P1
    const apexX = 0.25 * c1.x + 0.5 * qx + 0.25 * c2.x;
    const apexY = 0.25 * c1.y + 0.5 * qy + 0.25 * c2.y;

    return { qx, qy, apexX, apexY };
  }

  // Draw arrow head at intersection with destination node
  function drawArrowHead(ctx, fromX, fromY, toX, toY, targetRadius, color, width = 3) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);
    const arrowLen = 13;
    const arrowAngle = Math.PI / 7;

    // Contact point at perimeter of target node
    const tipX = toX - Math.cos(angle) * (targetRadius + 1);
    const tipY = toY - Math.sin(angle) * (targetRadius + 1);

    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      tipX - arrowLen * Math.cos(angle - arrowAngle),
      tipY - arrowLen * Math.sin(angle - arrowAngle)
    );
    ctx.lineTo(
      tipX - (arrowLen * 0.6) * Math.cos(angle),
      tipY - (arrowLen * 0.6) * Math.sin(angle)
    );
    ctx.lineTo(
      tipX - arrowLen * Math.cos(angle + arrowAngle),
      tipY - arrowLen * Math.sin(angle + arrowAngle)
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Main Graph Render Function
  function renderGraph() {
    if (!ctx || !canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);

    // Subtle background grid
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridStep = 40;
    for (let x = 0; x < w; x += gridStep) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += gridStep) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.restore();

    // Map of optimal path flights for quick lookup
    const pathFlightMap = new Map();
    const intermediateStops = new Set();

    if (tState.solution && tState.solution.path.length > 0) {
      tState.solution.path.forEach((step, idx) => {
        pathFlightMap.set(step.flight.id, { step, index: idx });
        if (step.toCity !== tState.N) {
          intermediateStops.add(step.toCity);
        }
      });
    }

    // Check bidirectional flight pairs to assign appropriate curvatures
    const pairLookup = new Set();
    tState.flights.forEach(f => pairLookup.add(`${f.u}->${f.v}`));

    // --- 1. Draw Non-Path Flight Edges ---
    tState.flights.forEach(f => {
      if (pathFlightMap.has(f.id)) return; // Draw path flights later on top

      const c1 = tState.cityCoords[f.u];
      const c2 = tState.cityCoords[f.v];
      if (!c1 || !c2) return;

      const hasReverse = pairLookup.has(`${f.v}->${f.u}`);
      const curvature = hasReverse ? 38 : 0;
      const { qx, qy, apexX, apexY } = getEdgeCurve(c1, c2, curvature);

      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(c1.x, c1.y);
      if (curvature !== 0) {
        ctx.quadraticCurveTo(qx, qy, c2.x, c2.y);
      } else {
        ctx.lineTo(c2.x, c2.y);
      }
      ctx.stroke();

      // Arrow
      const arrowFromX = curvature !== 0 ? qx : c1.x;
      const arrowFromY = curvature !== 0 ? qy : c1.y;
      drawArrowHead(ctx, arrowFromX, arrowFromY, c2.x, c2.y, c2.radius, 'rgba(148, 163, 184, 0.35)', 1.5);

      // Price Tag Badge
      drawPriceBadge(ctx, apexX, apexY, `$${f.price}`, false, false);
      ctx.restore();
    });

    // --- 2. Draw Chosen Optimal Path Flights ---
    if (tState.solution && tState.solution.path.length > 0) {
      tState.solution.path.forEach((step, idx) => {
        const f = step.flight;
        const c1 = tState.cityCoords[f.u];
        const c2 = tState.cityCoords[f.v];
        if (!c1 || !c2) return;

        const hasReverse = pairLookup.has(`${f.v}->${f.u}`);
        const curvature = hasReverse ? 40 : 12;
        const { qx, qy, apexX, apexY } = getEdgeCurve(c1, c2, curvature);

        const isCoupon = step.couponUsed;
        const isCurrentActiveHop = (tState.isPlaying || tState.currentStep > 0) && (tState.animHopIndex === idx);

        ctx.save();
        if (isCoupon) {
          // GOLD FLIGHT: Applied discount coupon!
          ctx.strokeStyle = '#FFD700'; // Pure vibrant gold
          ctx.lineWidth = isCurrentActiveHop ? 5 : 4;
          ctx.shadowColor = 'rgba(255, 215, 0, 0.75)';
          ctx.shadowBlur = 18;
        } else {
          // CYAN/BLUE FLIGHT: Regular path flight
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = isCurrentActiveHop ? 4.5 : 3.5;
          ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
          ctx.shadowBlur = 14;
        }

        ctx.beginPath();
        ctx.moveTo(c1.x, c1.y);
        ctx.quadraticCurveTo(qx, qy, c2.x, c2.y);
        ctx.stroke();

        // Arrow in Gold or Cyan
        const arrowColor = isCoupon ? '#FFD700' : '#38BDF8';
        drawArrowHead(ctx, qx, qy, c2.x, c2.y, c2.radius, arrowColor, 3);
        ctx.restore();

        // Price Tag: Show Original -> Discounted in Gold if coupon applied
        if (isCoupon) {
          drawPriceBadge(
            ctx, apexX, apexY,
            `$${f.price} ➔ $${step.paidCost}`,
            true, true, true
          );
        } else {
          drawPriceBadge(ctx, apexX, apexY, `$${f.price}`, true, false);
        }
      });
    }

    // --- 3. Draw Active Flight Animated Plane Avatar ---
    if (tState.solution && tState.solution.path.length > 0 && tState.animHopIndex < tState.solution.path.length) {
      const step = tState.solution.path[tState.animHopIndex];
      const c1 = tState.cityCoords[step.fromCity];
      const c2 = tState.cityCoords[step.toCity];

      if (c1 && c2 && (tState.isPlaying || tState.animT > 0)) {
        const hasReverse = pairLookup.has(`${step.toCity}->${step.fromCity}`);
        const curvature = hasReverse ? 40 : 12;
        const { qx, qy } = getEdgeCurve(c1, c2, curvature);

        // Bezier position at animT
        const t = tState.animT;
        const px = (1 - t) * (1 - t) * c1.x + 2 * (1 - t) * t * qx + t * t * c2.x;
        const py = (1 - t) * (1 - t) * c1.y + 2 * (1 - t) * t * qy + t * t * c2.y;

        // Tangent angle
        const tx = 2 * (1 - t) * (qx - c1.x) + 2 * t * (c2.x - qx);
        const ty = 2 * (1 - t) * (qy - c1.y) + 2 * t * (c2.y - qy);
        const planeAngle = Math.atan2(ty, tx);

        drawAirplane(ctx, px, py, planeAngle, step.couponUsed);

        // If coupon applied, spawn gold sparkle particles along the plane
        if (step.couponUsed && Math.random() < 0.4) {
          tState.goldParticles.push({
            x: px + (Math.random() - 0.5) * 16,
            y: py + (Math.random() - 0.5) * 16,
            vx: -Math.cos(planeAngle) * 2 + (Math.random() - 0.5) * 2,
            vy: -Math.sin(planeAngle) * 2 + (Math.random() - 0.5) * 2,
            size: Math.random() * 4 + 2,
            alpha: 1,
            life: 25
          });
        }
      }
    }

    // --- 4. Draw Gold Particle Effects ---
    drawGoldParticles(ctx);

    // --- 5. Draw City Nodes ---
    for (let id = 1; id <= tState.N; id++) {
      const c = tState.cityCoords[id];
      if (!c) continue;

      const isStart = (id === 1);
      const isDest = (id === tState.N);
      const isIntermediate = intermediateStops.has(id);

      drawCityNode(ctx, id, c.x, c.y, c.radius, isStart, isDest, isIntermediate);
    }
  }

  // Draw Price Badge on Flight Edge
  function drawPriceBadge(ctx, x, y, text, isPath, isCoupon, hasDiscount = false) {
    ctx.save();
    ctx.font = isCoupon ? 'bold 12px "JetBrains Mono", monospace' : '11px "JetBrains Mono", monospace';
    const textWidth = ctx.measureText(text).width;
    const badgeW = textWidth + 16;
    const badgeH = 22;

    // Background pill
    ctx.beginPath();
    ctx.roundRect(x - badgeW / 2, y - badgeH / 2, badgeW, badgeH, 6);

    if (isCoupon) {
      // GOLD BADGE
      ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
      ctx.shadowColor = 'rgba(245, 158, 11, 0.8)';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Text in dark gold / black for high contrast
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y);

      // Gold ticket icon
      ctx.font = '10px sans-serif';
      ctx.fillText('🎟️', x - badgeW / 2 + 8, y);
    } else if (isPath) {
      // Cyan path badge
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y);
    } else {
      // Dim neutral badge
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y);
    }

    ctx.restore();
  }

  // Draw Airplane Avatar
  function drawAirplane(ctx, x, y, angle, isGold = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Glowing halo
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fillStyle = isGold ? 'rgba(255, 215, 0, 0.35)' : 'rgba(56, 189, 248, 0.3)';
    ctx.shadowColor = isGold ? '#FFD700' : '#38BDF8';
    ctx.shadowBlur = 20;
    ctx.fill();

    // Stylized Jet Icon / Emoji
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✈️', 0, 0);

    ctx.restore();
  }

  // Draw Gold Sparkles
  function drawGoldParticles(ctx) {
    for (let i = tState.goldParticles.length - 1; i >= 0; i--) {
      const p = tState.goldParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 1 / p.life;

      if (p.alpha <= 0) {
        tState.goldParticles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.fillStyle = `rgba(255, 215, 0, ${p.alpha})`;
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Draw City Node with Status Badges
  function drawCityNode(ctx, id, x, y, radius, isStart, isDest, isIntermediate) {
    ctx.save();

    // 1. Outer Pulse / Halo for Start, Dest, Intermediate
    if (isStart) {
      // GREEN START
      const grad = ctx.createRadialGradient(x, y, radius * 0.7, x, y, radius * 1.5);
      grad.addColorStop(0, 'rgba(16, 185, 129, 0.5)');
      grad.addColorStop(1, 'rgba(16, 185, 129, 0)');
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    } else if (isDest) {
      // RED DESTINATION
      const grad = ctx.createRadialGradient(x, y, radius * 0.7, x, y, radius * 1.5);
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.5)');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    } else if (isIntermediate) {
      // ORANGE INTERMEDIATE STOP
      const grad = ctx.createRadialGradient(x, y, radius * 0.7, x, y, radius * 1.4);
      grad.addColorStop(0, 'rgba(249, 115, 22, 0.45)');
      grad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // 2. Node Circle Fill
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);

    if (isStart) {
      ctx.fillStyle = '#10B981'; // Green
      ctx.strokeStyle = '#A7F3D0';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#10B981';
      ctx.shadowBlur = 15;
    } else if (isDest) {
      ctx.fillStyle = '#EF4444'; // Red
      ctx.strokeStyle = '#FECACA';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#EF4444';
      ctx.shadowBlur = 15;
    } else if (isIntermediate) {
      ctx.fillStyle = '#F97316'; // Orange
      ctx.strokeStyle = '#FED7AA';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#F97316';
      ctx.shadowBlur = 12;
    } else {
      ctx.fillStyle = '#1E293B'; // Dark Slate Glass
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 0;
    }

    ctx.fill();
    ctx.stroke();

    // 3. City Label & Number inside Node
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${id}`, x, y);

    // 4. Role Pill Tag above or below node
    ctx.font = 'bold 9.5px "Outfit", sans-serif';
    if (isStart) {
      drawNodeBadge(ctx, x, y - radius - 14, 'START • CITY 1', '#10B981', '#064E3B');
    } else if (isDest) {
      drawNodeBadge(ctx, x, y - radius - 14, `DEST • CITY ${id}`, '#EF4444', '#7F1D1D');
    } else if (isIntermediate) {
      drawNodeBadge(ctx, x, y - radius - 14, `STOP`, '#F97316', '#7C2D12');
    } else {
      drawNodeBadge(ctx, x, y + radius + 12, `City ${id}`, 'rgba(255,255,255,0.7)', 'rgba(15,23,42,0.85)');
    }

    ctx.restore();
  }

  function drawNodeBadge(ctx, x, y, text, borderColor, bgColor) {
    const w = ctx.measureText(text).width + 12;
    const h = 17;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 8);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  // --- Animation Playback Controller ---
  let lastTimestamp = 0;

  function animLoop(timestamp) {
    if (!tState.isPlaying) return;

    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;

    const path = tState.solution ? tState.solution.path : [];

    if (tState.animHopIndex < path.length) {
      tState.animT += delta / tState.speedMs;

      if (tState.animT >= 1) {
        // Completed this flight hop!
        tState.animT = 0;
        tState.animHopIndex++;
        tState.currentStep = tState.animHopIndex;

        // Check coupon sound/notification
        const completedStep = path[tState.animHopIndex - 1];
        if (completedStep && completedStep.couponUsed) {
          playTravellerSound('coupon');
          triggerCouponBurst();
          showTravellerToast(
            `🎟️ COUPON APPLIED! City ${completedStep.fromCity} ➔ ${completedStep.toCity}: $${completedStep.originalPrice} ➔ $${completedStep.paidCost} (Saved $${completedStep.originalPrice - completedStep.paidCost})!`,
            'gold'
          );
        } else {
          playTravellerSound('flight');
        }

        updateHUD();

        // Check if finished entire journey
        if (tState.animHopIndex >= path.length) {
          tState.isPlaying = false;
          playTravellerSound('arrival');
          showTravellerToast(`🎉 Reached Destination City ${tState.N}! Total Cost: $${tState.solution.minCost}`, 'green');
          setPlayBtnState(false);
        }
      }
    } else {
      tState.isPlaying = false;
      setPlayBtnState(false);
    }

    renderGraph();

    if (tState.isPlaying) {
      tState.animFrameId = requestAnimationFrame(animLoop);
    }
  }

  function startPlayback() {
    if (!tState.solution || tState.solution.path.length === 0) {
      solveAndRefresh();
      if (!tState.solution || tState.solution.path.length === 0) {
        showTravellerToast("No path found to destination!", "red");
        return;
      }
    }

    if (tState.animHopIndex >= tState.solution.path.length) {
      // Loop around
      tState.animHopIndex = 0;
      tState.currentStep = 0;
      tState.animT = 0;
    }

    tState.isPlaying = true;
    lastTimestamp = 0;
    setPlayBtnState(true);
    playTravellerSound('flight');
    tState.animFrameId = requestAnimationFrame(animLoop);
  }

  function pausePlayback() {
    tState.isPlaying = false;
    if (tState.animFrameId) {
      cancelAnimationFrame(tState.animFrameId);
      tState.animFrameId = null;
    }
    setPlayBtnState(false);
    renderGraph();
  }

  function resetPlayback() {
    pausePlayback();
    tState.animHopIndex = 0;
    tState.currentStep = 0;
    tState.animT = 0;
    updateHUD();
    renderGraph();
    showTravellerToast("Reset to Start (City 1)", "info");
  }

  function stepForward() {
    pausePlayback();
    const path = tState.solution ? tState.solution.path : [];
    if (tState.animHopIndex < path.length) {
      tState.animHopIndex++;
      tState.currentStep = tState.animHopIndex;
      tState.animT = 0;
      const step = path[tState.animHopIndex - 1];
      if (step && step.couponUsed) {
        playTravellerSound('coupon');
        triggerCouponBurst();
      } else {
        playTravellerSound('flight');
      }
      updateHUD();
      renderGraph();
    }
  }

  function stepBackward() {
    pausePlayback();
    if (tState.animHopIndex > 0) {
      tState.animHopIndex--;
      tState.currentStep = tState.animHopIndex;
      tState.animT = 0;
      updateHUD();
      renderGraph();
    }
  }

  function triggerCouponBurst() {
    const costElem = document.getElementById('travellerCostAmount');
    if (costElem) {
      costElem.classList.add('cost-updated');
      setTimeout(() => costElem.classList.remove('cost-updated'), 500);
    }
  }

  function setPlayBtnState(isPlaying) {
    const btn = document.getElementById('btnTravellerPlay');
    if (btn) {
      btn.innerHTML = isPlaying ? '⏸ Pause' : '▶ Play';
      btn.className = isPlaying ? 'btn btn-secondary' : 'btn btn-success';
    }
  }

  // --- HUD & UI Updates ---
  function updateHUD() {
    const path = tState.solution ? tState.solution.path : [];
    const stepCount = tState.animHopIndex;

    let runningCost = 0;
    let couponsUsed = 0;
    let stopsUsed = 0;
    let totalSaved = 0;

    for (let i = 0; i < stepCount && i < path.length; i++) {
      const step = path[i];
      runningCost += step.paidCost;
      if (step.couponUsed) {
        couponsUsed++;
        totalSaved += (step.originalPrice - step.paidCost);
      }
      if (step.toCity !== tState.N) {
        stopsUsed++;
      }
    }

    // Cost counter
    const costElem = document.getElementById('travellerCostAmount');
    if (costElem) {
      costElem.textContent = `$${runningCost}`;
    }

    // Stops HUD
    const stopsElem = document.getElementById('travellerStopsVal');
    if (stopsElem) {
      stopsElem.textContent = `${stopsUsed} / ${tState.K}`;
      stopsElem.style.color = stopsUsed > tState.K ? '#ef4444' : '#f8fafc';
    }

    // Coupons HUD
    const couponsElem = document.getElementById('travellerCouponsVal');
    if (couponsElem) {
      couponsElem.textContent = `${couponsUsed} / ${tState.C}`;
      couponsElem.style.color = couponsUsed > 0 ? '#fbbf24' : '#f8fafc';
    }

    // Savings HUD
    const savingsElem = document.getElementById('travellerSavingsVal');
    if (savingsElem) {
      savingsElem.textContent = `$${totalSaved}`;
    }

    // Timeline Slider
    const slider = document.getElementById('travellerTimelineSlider');
    if (slider) {
      slider.max = path.length;
      slider.value = stepCount;
    }

    // Step text
    const stepBadge = document.getElementById('travellerStepBadge');
    if (stepBadge) {
      stepBadge.textContent = `${stepCount} / ${path.length}`;
    }

    // Banner Text
    const banner = document.getElementById('travellerEventText');
    if (banner) {
      if (stepCount === 0) {
        banner.innerHTML = `🛫 Ready at <strong>Start (City 1)</strong>. Max Stops: ${tState.K}, Coupons: ${tState.C}. Click "Play" or "Solve & Animate".`;
      } else if (stepCount <= path.length) {
        const curStep = path[stepCount - 1];
        if (curStep.couponUsed) {
          banner.innerHTML = `🎟️ <strong style="color: #fbbf24;">Coupon Halved Flight!</strong> City ${curStep.fromCity} ➔ City ${curStep.toCity}: <span class="price-strike">$${curStep.originalPrice}</span> <span class="price-discounted">$${curStep.paidCost}</span> (Stops: ${stopsUsed}/${tState.K})`;
        } else {
          banner.innerHTML = `✈️ Flight hop City ${curStep.fromCity} ➔ City ${curStep.toCity}: <strong>$${curStep.paidCost}</strong> (Stops: ${stopsUsed}/${tState.K})`;
        }
      }
    }

    // Active hop list highlight
    updateJourneyListDOM(stepCount);
  }

  function updateJourneyListDOM(activeHopIndex) {
    const container = document.getElementById('journeyTimelineList');
    if (!container || !tState.solution) return;

    const path = tState.solution.path;
    if (path.length === 0) {
      container.innerHTML = `<div style="color: #94a3b8; font-size: 0.8rem; text-align: center; padding: 12px;">No valid path within ${tState.K} stops.</div>`;
      return;
    }

    let html = '';
    path.forEach((step, idx) => {
      const isActive = (idx === activeHopIndex - 1);
      const isPast = (idx < activeHopIndex);
      const cls = isActive
        ? (step.couponUsed ? 'journey-step-chip active-hop-gold' : 'journey-step-chip active-hop')
        : 'journey-step-chip';

      html += `
        <div class="${cls}">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 700; color: #94a3b8;">#${idx + 1}</span>
            <span>City <strong>${step.fromCity}</strong> ➔ City <strong>${step.toCity}</strong></span>
            ${step.couponUsed ? '<span class="coupon-ticket-badge">🎟️ COUPON</span>' : ''}
          </div>
          <div>
            ${step.couponUsed ? `<span class="price-strike">$${step.originalPrice}</span>` : ''}
            <span class="${step.couponUsed ? 'price-discounted' : ''}" style="font-family: var(--font-mono); font-weight: 700;">$${step.paidCost}</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function updateFlightListDOM() {
    const listElem = document.getElementById('travellerFlightList');
    if (!listElem) return;

    if (tState.flights.length === 0) {
      listElem.innerHTML = `<div style="color: #64748b; font-size: 0.8rem; text-align: center; padding: 10px;">No flights loaded</div>`;
      return;
    }

    const pathFlightIds = new Set(
      tState.solution ? tState.solution.path.map(p => p.flight.id) : []
    );
    const couponFlightIds = new Set(
      tState.solution ? tState.solution.path.filter(p => p.couponUsed).map(p => p.flight.id) : []
    );

    let html = '';
    tState.flights.forEach(f => {
      const onPath = pathFlightIds.has(f.id);
      const isCoupon = couponFlightIds.has(f.id);
      let rowCls = 'flight-item-row';
      if (isCoupon) rowCls += ' on-path-coupon';
      else if (onPath) rowCls += ' on-path';

      html += `
        <div class="${rowCls}">
          <div>
            <span style="color: #64748b; font-size: 0.75rem; margin-right: 4px;">#${f.id}</span>
            <span><strong>${f.u}</strong> ➔ <strong>${f.v}</strong></span>
            ${isCoupon ? '<span class="coupon-ticket-badge" style="font-size: 0.65rem; padding: 1px 5px;">🎟️ 50%</span>' : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-family: var(--font-mono); font-weight: 700; color: ${isCoupon ? '#fbbf24' : '#38bdf8'};">$${f.price}</span>
            <button class="flight-btn-del" onclick="window.travellerApp.deleteFlight(${f.id})" title="Delete flight">✕</button>
          </div>
        </div>
      `;
    });

    listElem.innerHTML = html;
  }

  // --- Solve & Refresh ---
  function solveAndRefresh() {
    tState.solution = solveBudgetDijkstra(tState.N, tState.flights, tState.K, tState.C);

    const costBadge = document.getElementById('travellerOptimalCostBadge');
    if (costBadge) {
      costBadge.textContent = tState.solution.minCost === -1 ? 'Unsolvable' : `$${tState.solution.minCost}`;
    }

    const statusBadge = document.getElementById('travellerStatusBadge');
    if (statusBadge) {
      if (tState.solution.minCost === -1) {
        statusBadge.textContent = `No route within ${tState.K} stops`;
        statusBadge.style.borderColor = '#ef4444';
        statusBadge.style.color = '#ef4444';
      } else {
        statusBadge.textContent = `Optimal Path Found!`;
        statusBadge.style.borderColor = '#10b981';
        statusBadge.style.color = '#10b981';
      }
    }

    tState.animHopIndex = 0;
    tState.currentStep = 0;
    tState.animT = 0;

    updateHUD();
    updateFlightListDOM();
    renderGraph();
  }

  // --- Load Preset ---
  function loadPreset(key) {
    const p = PRESETS[key];
    if (!p) return;

    tState.N = p.N;
    tState.K = p.K;
    tState.C = p.C;
    tState.flights = JSON.parse(JSON.stringify(p.flights));

    // Update Input fields
    const inN = document.getElementById('travellerInputN');
    const inK = document.getElementById('travellerInputK');
    const inC = document.getElementById('travellerInputC');
    if (inN) inN.value = p.N;
    if (inK) inK.value = p.K;
    if (inC) inC.value = p.C;

    tState.hasCustomLayout = false;
    const w = (canvas && canvas.clientWidth > 50) ? canvas.clientWidth : 850;
    const h = (canvas && canvas.clientHeight > 50) ? canvas.clientHeight : 520;
    tState.cityCoords = computeLayout(tState.N, tState.layoutMode, w, h);
    solveAndRefresh();
    showTravellerToast(`Loaded preset: ${p.name}`, '✈️');
  }

  // --- CSV Parser & Exporter ---
  function parseFlightsCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    const flights = [];
    let autoId = 1;
    let maxCity = 2;

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#') || line.toLowerCase().startsWith('flight') || line.toLowerCase().startsWith('u,')) {
        continue;
      }
      const parts = line.split(',').map(s => s.trim());
      if (parts.length >= 3) {
        let u, v, price;
        if (parts.length >= 4 && !isNaN(parseInt(parts[0], 10)) && !isNaN(parseInt(parts[1], 10)) && !isNaN(parseInt(parts[2], 10))) {
          // format: id, u, v, price
          u = parseInt(parts[1], 10);
          v = parseInt(parts[2], 10);
          price = parseInt(parts[3], 10);
        } else {
          // format: u, v, price
          u = parseInt(parts[0], 10);
          v = parseInt(parts[1], 10);
          price = parseInt(parts[2], 10);
        }
        if (!isNaN(u) && !isNaN(v) && !isNaN(price)) {
          flights.push({ id: autoId++, u, v, price });
          if (u > maxCity) maxCity = u;
          if (v > maxCity) maxCity = v;
        }
      }
    }

    return { flights, maxCity };
  }

  function exportSolutionCSV() {
    if (!tState.solution || tState.solution.minCost === -1) {
      showTravellerToast("No valid solution to export!", "red");
      return;
    }

    const pathIds = new Set();
    const couponMap = new Map();
    tState.solution.path.forEach(step => {
      pathIds.add(step.flight.id);
      couponMap.set(step.flight.id, step.couponUsed);
    });

    let csv = "flight_id,u,v,price,on_path,coupon_used,actual_cost\n";
    tState.flights.forEach(f => {
      const onPath = pathIds.has(f.id);
      const isCoupon = couponMap.get(f.id) || false;
      const actualCost = onPath ? (isCoupon ? Math.floor(f.price / 2) : f.price) : "";
      csv += `${f.id},${f.u},${f.v},${f.price},${onPath ? 'x' : ''},${onPath ? (isCoupon ? 'yes' : 'no') : ''},${actualCost}\n`;
    });

    downloadCSV(csv, 'budget_traveller_solution.csv');
    showTravellerToast("Exported budget_traveller_solution.csv!", "💾");
  }

  function exportRawFlightsCSV() {
    let csv = "flight_id,u,v,price\n";
    tState.flights.forEach(f => {
      csv += `${f.id},${f.u},${f.v},${f.price}\n`;
    });
    downloadCSV(csv, 'flights.csv');
    showTravellerToast("Exported flights.csv!", "📋");
  }

  function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function showTravellerToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    let icon = 'ℹ️';
    if (type === 'gold') icon = '🎟️';
    else if (type === 'green') icon = '✅';
    else if (type === 'red') icon = '⚠️';
    else if (type === 'plane') icon = '✈️';

    toast.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // --- UI Event Bindings ---
  function bindEvents() {
    // Presets
    const presetSelect = document.getElementById('travellerPresetSelect');
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        loadPreset(e.target.value);
      });
    }

    // Input changes
    const inN = document.getElementById('travellerInputN');
    const inK = document.getElementById('travellerInputK');
    const inC = document.getElementById('travellerInputC');

    if (inN) inN.addEventListener('change', (e) => {
      const val = Math.max(2, Math.min(25, parseInt(e.target.value, 10) || 5));
      tState.N = val;
      tState.cityCoords = computeLayout(val, tState.layoutMode, canvas.clientWidth, canvas.clientHeight);
      solveAndRefresh();
    });
    if (inK) inK.addEventListener('change', (e) => {
      tState.K = Math.max(0, parseInt(e.target.value, 10) || 0);
      solveAndRefresh();
    });
    if (inC) inC.addEventListener('change', (e) => {
      tState.C = Math.max(0, parseInt(e.target.value, 10) || 0);
      solveAndRefresh();
    });

    // Generate random network
    const btnGen = document.getElementById('btnTravellerGenerate');
    if (btnGen) {
      btnGen.addEventListener('click', () => {
        const N = parseInt(inN.value, 10) || 6;
        const K = parseInt(inK.value, 10) || 2;
        const C = parseInt(inC.value, 10) || 1;
        const M = Math.max(N + 2, Math.floor(N * 2.2));
        tState.N = N;
        tState.K = K;
        tState.C = C;
        tState.flights = generateSolvableFlightNetwork(N, M, K);
        tState.cityCoords = computeLayout(N, tState.layoutMode, canvas.clientWidth, canvas.clientHeight);
        solveAndRefresh();
        showTravellerToast(`Generated solvable network with ${N} cities & ${tState.flights.length} flights!`, '🎲');
      });
    }

    // Add flight
    const btnAddFlight = document.getElementById('btnTravellerAddFlight');
    if (btnAddFlight) {
      btnAddFlight.addEventListener('click', () => {
        const u = parseInt(document.getElementById('inputFlightU').value, 10);
        const v = parseInt(document.getElementById('inputFlightV').value, 10);
        const price = parseInt(document.getElementById('inputFlightPrice').value, 10);
        if (isNaN(u) || isNaN(v) || isNaN(price) || u < 1 || v < 1 || u > tState.N || v > tState.N || u === v) {
          showTravellerToast(`Invalid flight: cities must be 1 to ${tState.N} and distinct!`, 'red');
          return;
        }
        const nextId = tState.flights.reduce((max, f) => Math.max(max, f.id), 0) + 1;
        tState.flights.push({ id: nextId, u, v, price });
        solveAndRefresh();
        showTravellerToast(`Added flight: City ${u} ➔ City ${v} ($${price})`, '✈️');
      });
    }

    // Playback buttons
    const btnPlay = document.getElementById('btnTravellerPlay');
    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        if (tState.isPlaying) pausePlayback();
        else startPlayback();
      });
    }

    const btnReset = document.getElementById('btnTravellerReset');
    if (btnReset) btnReset.addEventListener('click', resetPlayback);

    const btnStepBack = document.getElementById('btnTravellerStepBack');
    if (btnStepBack) btnStepBack.addEventListener('click', stepBackward);

    const btnStepFwd = document.getElementById('btnTravellerStepForward');
    if (btnStepFwd) btnStepFwd.addEventListener('click', stepForward);

    // Scrubber
    const slider = document.getElementById('travellerTimelineSlider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        pausePlayback();
        tState.animHopIndex = parseInt(e.target.value, 10);
        tState.currentStep = tState.animHopIndex;
        tState.animT = 0;
        updateHUD();
        renderGraph();
      });
    }

    // Speed selector
    const speedSelect = document.getElementById('travellerSpeedSelect');
    if (speedSelect) {
      speedSelect.addEventListener('change', (e) => {
        tState.speedMs = parseInt(e.target.value, 10);
      });
    }

    // Layout buttons
    document.querySelectorAll('.btn-layout').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-layout');
        tState.layoutMode = mode;
        tState.hasCustomLayout = false;
        const w = (canvas && canvas.clientWidth > 50) ? canvas.clientWidth : 850;
        const h = (canvas && canvas.clientHeight > 50) ? canvas.clientHeight : 520;
        tState.cityCoords = computeLayout(tState.N, mode, w, h);
        renderGraph();
      });
    });

    // Dropzone & File Input
    const dropzone = document.getElementById('travellerDropzone');
    const fileInput = document.getElementById('travellerCsvFileInput');
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
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
        if (file) handleFile(file);
      });
    }

    function handleFile(file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const { flights, maxCity } = parseFlightsCSV(evt.target.result);
          if (flights.length === 0) throw new Error("No valid flight lines found");
          tState.flights = flights;
          tState.N = Math.max(tState.N, maxCity);
          if (inN) inN.value = tState.N;
          tState.cityCoords = computeLayout(tState.N, tState.layoutMode, canvas.clientWidth, canvas.clientHeight);
          solveAndRefresh();
          showTravellerToast(`Loaded ${flights.length} flights from ${file.name}!`, '📂');
        } catch (err) {
          showTravellerToast(`CSV error: ${err.message}`, 'red');
        }
      };
      reader.readAsText(file);
    }

    // CSV Exports
    const btnExpSol = document.getElementById('btnTravellerExportSolution');
    if (btnExpSol) btnExpSol.addEventListener('click', exportSolutionCSV);

    const btnExpRaw = document.getElementById('btnTravellerExportRaw');
    if (btnExpRaw) btnExpRaw.addEventListener('click', exportRawFlightsCSV);

    const btnSound = document.getElementById('btnSoundToggle');
    if (btnSound) {
      btnSound.addEventListener('click', () => {
        tState.soundEnabled = !tState.soundEnabled;
      });
    }
  }

  // Delete flight by ID (exposed globally for table click)
  window.travellerApp = {
    deleteFlight: function (id) {
      tState.flights = tState.flights.filter(f => f.id !== id);
      solveAndRefresh();
      showTravellerToast(`Removed flight #${id}`, 'info');
    },
    solve: function () {
      solveAndRefresh();
      startPlayback();
    },
    setSound: function (enabled) {
      tState.soundEnabled = enabled;
    }
  };

  // --- Initialization ---
  window.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    bindEvents();
    loadPreset('generated5'); // Default to generated 5 cities which showcases coupon application!
  });

})();
