import { useEffect, useRef, useState, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS = { UNAWARE: 0, SEEKING: 1, MILLING: 2, EVAC: 3, DONE: 4 };

const STATUS_COLORS = {
  [STATUS.UNAWARE]: { fill: "#888780", stroke: "#5F5E5A" },
  [STATUS.SEEKING]: { fill: "#378ADD", stroke: "#185FA5" },
  [STATUS.MILLING]: { fill: "#EF9F27", stroke: "#BA7517" },
  [STATUS.EVAC]:    { fill: "#E24B4A", stroke: "#A32D2D" },
  [STATUS.DONE]:    { fill: "#1D9E75", stroke: "#0F6E56" },
};

const ELDER_FILL    = "#7F77DD";
const ELDER_STR     = "#534AB7";
const CHILD_FILL    = "#D4537E";
const CHILD_STR     = "#993556";
const PREGNANT_FILL = "#0891B2";
const PREGNANT_STR  = "#0E7490";
const UNACCOMP_FILL = "#EA580C";
const UNACCOMP_STR  = "#C2410C";

const FAMILY_NAMES = ["Rivera", "Kim", "Okafor", "Hassan", "Novak", "Tanaka"];
const PERSON_NAMES = ["Alex", "Jordan", "Sam", "Casey", "Morgan", "Riley", "Blake", "Avery"];
const FAMILY_COLORS = ["#534AB7", "#0F6E56", "#993C1D", "#185FA5", "#854F0B", "#993556"];

const CANVAS_HEIGHT = 440;
const NUM_FAMILIES  = 6;
const SIM_INTERVAL_MS = 200; // ms between ticks when running

const STATUS_LABEL      = ["Unaware", "Seeking info", "Milling", "Evacuating", "Evacuated"];
const STATUS_TEXT_COLOR = ["#737069", "#185FA5", "#BA7517", "#A32D2D", "#0F6E56"];

// ─── Scenario definitions ─────────────────────────────────────────────────────

/**
 * Evacuation-travel speed of each protected category, as a fraction of the
 * scenario's adult speed. The ratios are those of the pedestrian scenario
 * (1.5 / 1.8 / 2.0 against an adult 2.6) and are applied to every scenario, so
 * protected populations stay differentiated during the evacuation-travel phase
 * regardless of mode. Previously car and train used one flat speed for all
 * categories, which erased that differentiation outside the milling phase.
 */
const SPEED_FACTORS = {
  child:    1.5 / 2.6,
  elder:    1.8 / 2.6,
  pregnant: 2.0 / 2.6,
  adult:    1,
};

const scenarioSpeeds = (adult) => ({
  child:    adult * SPEED_FACTORS.child,
  elder:    adult * SPEED_FACTORS.elder,
  pregnant: adult * SPEED_FACTORS.pregnant,
  adult,
});

const SCENARIOS = {
  pedestrian: {
    label: "Pedestrian",
    icon: "🚶",
    millingBase:    [2, 4], millingElder:    [2, 5], millingChild:    [3, 6],
    millingPregnant:[2, 5], millingUnaccomp: [6, 12],
    evacBase:       [3, 6], evacElder:       [3, 7], evacChild:       [2, 5],
    evacPregnant:   [3, 6], evacUnaccomp:    [2, 5],
    speeds: scenarioSpeeds(2.6),
  },
  car: {
    label: "Car",
    icon: "🚗",
    millingBase:    [1, 3], millingElder:    [1, 2], millingChild:    [2, 3],
    millingPregnant:[1, 2], millingUnaccomp: [4, 8],
    evacBase:       [1, 2], evacElder:       [0, 1], evacChild:       [0, 1],
    evacPregnant:   [0, 1], evacUnaccomp:    [0, 1],
    speeds: scenarioSpeeds(5.5),
  },
  train: {
    label: "Train",
    icon: "🚆",
    millingBase:    [4, 8], millingElder:    [2, 4], millingChild:    [1, 3],
    millingPregnant:[2, 4], millingUnaccomp: [5, 10],
    evacBase:       [1, 2], evacElder:       [0, 1], evacChild:       [0, 1],
    evacPregnant:   [0, 1], evacUnaccomp:    [0, 1],
    speeds: scenarioSpeeds(8.0),
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Seeded PRNG (mulberry32). Returns a function producing floats in [0, 1).
 * Every stochastic draw in the simulation goes through one of these streams so
 * that a given seed reproduces a run exactly (see DEFAULT_SEED / sim.seed).
 */
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULT_SEED = 20250101;

const rnd   = (rng, a, b) => a + rng() * (b - a);
const irnd  = (rng, a, b) => Math.floor(rnd(rng, a, b + 1));
const pick  = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * Parse a corridor schedule field ('' / '12' / '0') into a tick number or null.
 * Tick 0 is a valid schedule value, so blank and non-numeric input — and only
 * those — map to null.
 */
const toTick = (v) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

function findNearestOpenCorridor(sim, x, y) {
  if (!sim.corridors) return null;
  const open = sim.corridors.filter(c => c.open);
  if (open.length === 0) return null;
  return open.reduce((best, c) =>
    Math.hypot(x - c.x, y - c.y) < Math.hypot(x - best.x, y - best.y) ? c : best
  );
}

// ─── Simulation builder ───────────────────────────────────────────────────────

/**
 * Build a fresh simulation state from slider parameters.
 *
 * @param {object} params
 * @param {number} params.threat        - 1–10, threat severity
 * @param {number} params.elderPct      - 0–1, fraction of non-hub members who are elders
 * @param {number} params.childPct      - 0–1, fraction of non-hub members who are children <5
 * @param {number} params.infoClar      - 1–10, information clarity / reliability
 * @param {number} params.nbrInfluence  - 0–1, neighbor social influence strength
 * @param {number} params.avgFamilySize - 1–7, average members per family
 * @param {string} params.scenario      - "pedestrian" | "car" | "train"
 * @param {number} params.seed          - PRNG seed; the same seed + params reproduces a run exactly
 * @param {number} canvasWidth
 */
export function buildSimulation({ threat, elderPct, childPct, pregnantPct = 0, unaccompChildPct = 0, infoClar, nbrInfluence, avgFamilySize = 3, scenario = "pedestrian", corridorSettings = null, threatRiseRate = 0, humanitarianAccess = 0, checkpointDelay = 0, misinfoRate = 0, infraDegradeRate = 0, coercionRisk = 0, seed = DEFAULT_SEED, canvasWidth }) {
  const sc = SCENARIOS[scenario] ?? SCENARIOS.pedestrian;
  const rng = mulberry32(seed);
  const W = canvasWidth;
  const H = CANVAS_HEIGHT;

  // Build corridor gates — only active for pedestrian and car scenarios
  const settingsMap = corridorSettings
    ? Object.fromEntries(corridorSettings.map(s => [s.id, s]))
    : {};
  const corridors = scenario === 'train' ? [] : [
    { id: 'N', label: 'North', x: W / 2, y: 18,      exitX: W / 2,   exitY: -100  },
    { id: 'S', label: 'South', x: W / 2, y: H - 18,  exitX: W / 2,   exitY: H+100 },
    { id: 'E', label: 'East',  x: W - 18, y: H / 2,  exitX: W + 100, exitY: H / 2 },
    { id: 'W', label: 'West',  x: 18,     y: H / 2,  exitX: -100,    exitY: H / 2 },
  ].map(c => {
    const cfg = settingsMap[c.id] ?? {};
    const hasOpenAt = cfg.opensAtTick != null;
    return {
      ...c,
      open:         hasOpenAt ? false : (cfg.open ?? true),
      closesAtTick: cfg.closesAtTick ?? null,
      opensAtTick:  cfg.opensAtTick  ?? null,
      pendingOpen:  hasOpenAt,
    };
  });

  const infoNode = {
    x: W / 2,
    y: H / 2,
    reliability: clamp(infoClar / 10, 0.1, 0.95),
    clarity: infoClar,
  };

  // Humanitarian actor node — independent reliability, reach limited by access parameter
  const humNode = {
    x: 45,
    y: 42,
    reliability: 0.75,
    access: humanitarianAccess,
  };

  const PAD = 80;
  const MIN_DIST = 110;
  const MIN_INFO_DIST = 90;
  const hubPositions = [];
  for (let fi = 0; fi < NUM_FAMILIES; fi++) {
    let hx, hy, attempts = 0;
    do {
      hx = rnd(rng, PAD, W - PAD);
      hy = rnd(rng, PAD, H - PAD);
      attempts++;
    } while (
      attempts < 200 &&
      (
        Math.hypot(W / 2 - hx, H / 2 - hy) < MIN_INFO_DIST ||
        hubPositions.some((p) => Math.hypot(p.x - hx, p.y - hy) < MIN_DIST)
      )
    );
    hubPositions.push({ x: hx, y: hy });
  }

  const families = hubPositions.map(({ x: hx, y: hy }, fi) => {
    const size = irnd(rng, Math.max(1, avgFamilySize - 1), avgFamilySize + 1);
    const name = FAMILY_NAMES[fi];
    const members = [];
    let childCount = 0;
    let elderCount = 0;
    let pregnantCount = 0;
    let unaccompCount = 0;

    for (let m = 0; m < size; m++) {
      const isElder        = m > 0 && rng() < elderPct;
      const isChild        = m > 0 && !isElder && rng() < childPct;
      const isPregnant     = m > 0 && !isElder && !isChild && rng() < pregnantPct;
      const isUnaccompChild = m > 0 && !isElder && !isChild && !isPregnant && rng() < unaccompChildPct;
      if (isElder)         elderCount++;
      if (isChild)         childCount++;
      if (isPregnant)      pregnantCount++;
      if (isUnaccompChild) unaccompCount++;

      const mang   = (m / size) * Math.PI * 2 + rnd(rng, -0.3, 0.3);
      const spread = m === 0 ? 0 : rnd(rng, 20, 32);

      // Confirmations needed: more for elders and unaccompanied children (need escort/reunification authority)
      const confirmNeeded = irnd(rng, 1, 3) + (infoClar < 4 ? irnd(rng, 1, 2) : 0) + (isElder ? 1 : 0) + (isUnaccompChild ? 2 : 0);

      // Milling delay: time to prepare before departing
      const millingExtra = isElder         ? irnd(rng, ...sc.millingElder)
                         : isChild         ? irnd(rng, ...sc.millingChild)
                         : isPregnant      ? irnd(rng, ...sc.millingPregnant)
                         : isUnaccompChild ? irnd(rng, ...sc.millingUnaccomp)
                         : 0;
      const millingTicks = irnd(rng, ...sc.millingBase) + millingExtra;

      // Evacuation travel time
      const evacExtra = isElder         ? irnd(rng, ...sc.evacElder)
                      : isChild         ? irnd(rng, ...sc.evacChild)
                      : isPregnant      ? irnd(rng, ...sc.evacPregnant)
                      : isUnaccompChild ? irnd(rng, ...sc.evacUnaccomp)
                      : 0;
      const evacTicks = irnd(rng, ...sc.evacBase) + evacExtra;

      members.push({
        x: hx + Math.cos(mang) * spread,
        y: hy + Math.sin(mang) * spread,
        // Saved so we can reset positions without rebuilding
        ox: hx + Math.cos(mang) * spread,
        oy: hy + Math.sin(mang) * spread,
        isElder,
        isChild,
        isPregnant,
        isUnaccompChild,
        isHub: m === 0,
        name: m === 0 ? name : pick(rng, PERSON_NAMES),
        status: STATUS.UNAWARE,
        confirmNeeded,
        confirmCount: 0,
        seekStart: null,
        millingStart: null,
        evacStart: null,
        doneAt: null,
        millingTicks,
        evacTicks,
        tx: 0,
        ty: 0,
        family: fi,
        reachableByHum: rng() < humanitarianAccess,
      });
    }

    // Hub node sits at center of cluster
    members[0].x = hx;
    members[0].y = hy;
    members[0].ox = hx;
    members[0].oy = hy;
    members[0].isHub = true;
    members[0].name = name;
    // Hub waits for slowest household member
    members[0].millingTicks = Math.max(...members.map((m) => m.millingTicks));
    members[0].evacTicks    = Math.max(...members.map((m) => m.evacTicks));

    return { name, members, fi, col: FAMILY_COLORS[fi], childCount, elderCount, pregnantCount, unaccompCount };
  });

  // Neighbor edges: ring + skip-one connections
  const rawEdges = [];
  for (let i = 0; i < NUM_FAMILIES; i++) {
    rawEdges.push({ a: families[i], b: families[(i + 1) % NUM_FAMILIES] });
    rawEdges.push({ a: families[i], b: families[(i + 2) % NUM_FAMILIES] });
  }
  const seen = new Set();
  const neighborEdges = rawEdges.filter((e) => {
    const key = [e.a.fi, e.b.fi].sort().join("-");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    families,
    neighborEdges,
    infoNode,
    humNode,
    seed,
    rng,          // seeded stream, consumed by stepSimulation — never reassign
    threat,
    infoClar,
    nbrInfluence,
    scenario,
    tick: 0,
    started: false,
    activeArcs: [],
    ripples:    [],  // expanding rings from info node on alert fire (13h)
    flashes:    [],  // confirmation-source rings at member position (13i/j)
    dashOffset: 0,   // animated neighbor edge offset (13e)
    socialInfluenceEvents: 0, // total times neighbour influence fired
    threatRiseRate,
    effectiveThreat: threat,  // updated each tick when threatRiseRate > 0
    corridors,
    closureEvents: [],        // transient red ripples when a corridor closes
    effectiveInfoClar: infoClar,
    openEvents:    [],
    coercedCount:  0,
    checkpointDelay,
    misinfoRate,
    infraDegradeRate,
    coercionRisk,
  };
}

// ─── Simulation step ──────────────────────────────────────────────────────────

/**
 * Advance simulation by one tick. Mutates sim in place.
 * Returns { sim, logs, finished }.
 *
 * @param {object} sim     - simulation state (mutated)
 * @param {number} canvasH - canvas height, used to compute evac direction
 * @param {number} canvasW
 */
export function stepSimulation(sim, canvasW, canvasH) {
  // Seeded stream created in buildSimulation; rebuilt from sim.seed if a caller
  // supplied a sim state without one (e.g. deserialised).
  const rng = sim.rng ?? (sim.rng = mulberry32(sim.seed ?? DEFAULT_SEED));
  sim.tick++;
  const t = sim.tick;
  const newLogs = [];

  sim.dashOffset++;
  // Update effective threat if dynamic escalation is active
  if (sim.threatRiseRate > 0) {
    sim.effectiveThreat = clamp(sim.threat + (t * sim.threatRiseRate / 10), sim.threat, 10);
  }
  sim.activeArcs    = sim.activeArcs.filter((a) => t - a.born < (a.social ? 7 : 8));
  sim.ripples       = sim.ripples.filter((r) => t - r.born < 7);
  sim.flashes       = sim.flashes.filter((f) => t - f.born < 5);
  sim.closureEvents = (sim.closureEvents || []).filter((e) => t - e.born < 9);
  sim.openEvents = (sim.openEvents || []).filter(e => t - e.born < 7);

  // Infrastructure degradation
  if (sim.infraDegradeRate > 0) {
    sim.effectiveInfoClar = Math.max(1, sim.infoClar - t * sim.infraDegradeRate / 15);
    sim.infoNode.reliability = clamp(sim.effectiveInfoClar / 10, 0.05, 0.9);
  }

  // ── Corridor closure check ─────────────────────────────────────────────────
  (sim.corridors || []).forEach((c) => {
    if (c.open && c.closesAtTick !== null && t >= c.closesAtTick) {
      c.open = false;
      newLogs.push(`t${t} ⚠ ${c.label} corridor closed`);
      sim.closureEvents.push({ x: c.x, y: c.y, born: t });
      // Reroute any EVAC members heading to this corridor
      sim.families.forEach((fam) => {
        fam.members.forEach((mem) => {
          if (mem.status === STATUS.EVAC && mem.corridorId === c.id) {
            const alt = findNearestOpenCorridor(sim, mem.x, mem.y);
            if (!alt) {
              mem.trapped = true;
              newLogs.push(`t${t} ${mem.name} (${fam.name}) trapped — no open corridors`);
            } else {
              // A route was found, so this member is no longer trapped.
              mem.trapped = false;
              mem.corridorId = alt.id;
              mem.tx = alt.exitX; mem.ty = alt.exitY;
              newLogs.push(`t${t} ${mem.name} rerouting → ${alt.label} corridor`);
              sim.activeArcs.push({ x1: mem.x, y1: mem.y, x2: alt.x, y2: alt.y, born: t, col: '#D97706', social: true });
            }
          }
        });
      });
    }
  });

  // ── Corridor opening check (humanitarian ceasefire window) ─────────────────
  (sim.corridors || []).forEach((c) => {
    if (c.pendingOpen && c.opensAtTick !== null && t >= c.opensAtTick) {
      c.open = true;
      c.pendingOpen = false;
      newLogs.push(`t${t} ✅ ${c.label} corridor opened — humanitarian window in effect`);
      (sim.openEvents = sim.openEvents || []).push({ x: c.x, y: c.y, born: t });
      // Members stranded mid-evacuation when every corridor shut now have a
      // route again: send them to it and clear the trapped flag, mirroring the
      // reroute done on closure.
      sim.families.forEach((fam) => {
        fam.members.forEach((mem) => {
          if (mem.status === STATUS.EVAC && mem.trapped) {
            const alt = findNearestOpenCorridor(sim, mem.x, mem.y);
            if (alt) {
              mem.trapped = false;
              mem.corridorId = alt.id;
              mem.tx = alt.exitX; mem.ty = alt.exitY;
              newLogs.push(`t${t} ${mem.name} (${fam.name}) rerouting → ${alt.label} corridor`);
              sim.activeArcs.push({ x1: mem.x, y1: mem.y, x2: alt.x, y2: alt.y, born: t, col: '#D97706', social: true });
            }
          }
        });
      });
    }
  });

  sim.families.forEach((f) => {
    f.members.forEach((mem) => {
      if (mem.status === STATUS.DONE) return;

      // ── UNAWARE → SEEKING ──────────────────────────────────────────────────
      if (mem.status === STATUS.UNAWARE) {
        const alertChance = clamp(sim.effectiveThreat / 10 * 0.35 + (t / 30) * 0.15, 0.02, 0.55);
        const officialAlert = rng() < alertChance;
        const humAlert = !officialAlert && sim.humNode && sim.humNode.access > 0 && mem.reachableByHum
          && rng() < clamp(sim.effectiveThreat / 10 * 0.22 + (t / 45) * 0.09, 0.01, 0.4);

        if (officialAlert || humAlert) {
          mem.status = STATUS.SEEKING;
          mem.seekStart = t;
          mem.confirmCount = 0;
          mem.lastConfirmSource = officialAlert ? 'official' : 'humanitarian';
          const tag = mem.isElder ? "[elder]" : mem.isChild ? "[child<5]" : mem.isPregnant ? "[pregnant]" : mem.isUnaccompChild ? "[unaccomp. minor]" : "";
          newLogs.push(`t${t} ${mem.name} (${f.name}) ${tag} receives alert — needs ${mem.confirmNeeded} confirmation(s)`);
          if (officialAlert) {
            sim.activeArcs.push({ x1: sim.infoNode.x, y1: sim.infoNode.y, x2: mem.x, y2: mem.y, born: t, col: "#378ADD" });
            sim.ripples.push({ born: t, clarity: sim.infoClar });
          } else {
            sim.activeArcs.push({ x1: sim.humNode.x, y1: sim.humNode.y, x2: mem.x, y2: mem.y, born: t, col: "#1D9E75" });
          }
        }

        // Coercion: forced displacement before voluntary threshold
        if (!officialAlert && !humAlert && sim.coercionRisk > 0) {
          const coercChance = clamp(sim.effectiveThreat / 10 * sim.coercionRisk * 0.008, 0, 0.06);
          if (rng() < coercChance) {
            mem.status = STATUS.MILLING;
            mem.millingStart = t;
            mem.seekStart = t;
            mem.coerced = true;
            mem.confirmedByChannel = 'coerced';
            sim.coercedCount = (sim.coercedCount ?? 0) + 1;
            const tag = mem.isElder ? "[elder]" : mem.isChild ? "[child<5]" : mem.isPregnant ? "[pregnant]" : mem.isUnaccompChild ? "[unaccomp. minor]" : "";
            newLogs.push(`t${t} ⚠ ${mem.name} (${f.name}) ${tag} coerced into evacuation — forced displacement (Art. 17 AP II)`);
            sim.flashes.push({ x: mem.x, y: mem.y, col: '#DC2626', born: t });
          }
        }
      }

      // ── SEEKING → MILLING ─────────────────────────────────────────────────
      else if (mem.status === STATUS.SEEKING) {
        const confirmChance = clamp(sim.infoNode.reliability * 0.45 + ((sim.effectiveInfoClar ?? sim.infoClar) / 10) * 0.2, 0.05, 0.75);
        if (rng() < confirmChance) {
          mem.confirmCount++;
          mem.lastConfirmSource = 'official';
          sim.activeArcs.push({ x1: sim.infoNode.x, y1: sim.infoNode.y, x2: mem.x, y2: mem.y, born: t, col: "#EF9F27" });
          newLogs.push(`t${t} ${mem.name}: ${mem.confirmCount}/${mem.confirmNeeded} confirmations`);
        }

        // Humanitarian actor confirmation
        if (sim.humNode && sim.humNode.access > 0 && mem.reachableByHum && mem.confirmCount < mem.confirmNeeded) {
          const humConfirmChance = clamp(sim.humNode.reliability * 0.5, 0.08, 0.65);
          if (rng() < humConfirmChance) {
            mem.confirmCount = Math.min(mem.confirmNeeded, mem.confirmCount + 1);
            mem.lastConfirmSource = 'humanitarian';
            sim.activeArcs.push({ x1: sim.humNode.x, y1: sim.humNode.y, x2: mem.x, y2: mem.y, born: t, col: "#1D9E75" });
            newLogs.push(`t${t} ${mem.name}: ${mem.confirmCount}/${mem.confirmNeeded} confirmations (Aid)`);
          }
        }

        // Misinformation channel — false confirmations that may misdirect
        if (sim.misinfoRate > 0 && mem.confirmCount < mem.confirmNeeded) {
          if (rng() < sim.misinfoRate * 0.35) {
            mem.confirmCount = Math.min(mem.confirmNeeded, mem.confirmCount + 1);
            mem.lastConfirmSource = 'misinfo';
            sim.activeArcs.push({ x1: sim.infoNode.x, y1: sim.infoNode.y, x2: mem.x, y2: mem.y, born: t, col: '#DC2626', misinfo: true });
            newLogs.push(`t${t} ${mem.name}: false confirmation — ${mem.confirmCount}/${mem.confirmNeeded} (misinformation)`);
          }
        }

        // Neighbor influence: seeing others mill/evac counts as a confirmation
        const activeNeighbor = sim.neighborEdges
          .filter((e) => e.a === f || e.b === f)
          .map((e) => (e.a === f ? e.b : e.a))
          .find((nf) => nf.members.some((m) => m.status === STATUS.MILLING || m.status === STATUS.EVAC));
        if (activeNeighbor && rng() < sim.nbrInfluence) {
          mem.confirmCount = Math.min(mem.confirmNeeded, mem.confirmCount + 1);
          mem.lastConfirmSource = 'social';
          sim.socialInfluenceEvents++;
          newLogs.push(`t${t} ${mem.name} sees neighbor active — +1 confirmation`);
          const srcHub = activeNeighbor.members[0];
          sim.activeArcs.push({ x1: srcHub.x, y1: srcHub.y, x2: mem.x, y2: mem.y, born: t, col: "#D97706", social: true });
        }

        if (mem.confirmCount >= mem.confirmNeeded) {
          mem.status = STATUS.MILLING;
          mem.millingStart = t;
          const delay = t - mem.seekStart;
          const why = mem.isElder ? "elder: extra prep" : mem.isChild ? "child<5: gathering kids" : mem.isPregnant ? "pregnant: slower prep" : mem.isUnaccompChild ? "unaccomp. minor: awaiting escort" : "";
          newLogs.push(`t${t} ${mem.name} (${f.name}) confirmed after ${delay}t — milling${why ? " (" + why + ")" : ""}`);
          mem.confirmedByChannel = mem.lastConfirmSource;
          // 13j: flash colour shows which channel drove the final confirmation
          const flashCol = mem.lastConfirmSource === 'social' ? '#D97706'
                         : mem.lastConfirmSource === 'humanitarian' ? '#1D9E75'
                         : mem.lastConfirmSource === 'misinfo' ? '#DC2626'
                         : '#185FA5';
          sim.flashes.push({ x: mem.x, y: mem.y, col: flashCol, born: t });
          // 13i: cascade arc from source hub if social-driven
          if (mem.lastConfirmSource === 'social' && activeNeighbor) {
            const srcHub = activeNeighbor.members[0];
            sim.activeArcs.push({ x1: srcHub.x, y1: srcHub.y, x2: mem.x, y2: mem.y, born: t, col: '#D97706', social: true, cascade: true });
          }
        }
      }

      // ── MILLING → EVAC ────────────────────────────────────────────────────
      else if (mem.status === STATUS.MILLING) {
        if (t - mem.millingStart >= mem.millingTicks) {
          // Misinfo routing: if final confirmation was misinfo and multiple corridors open, pick non-nearest
          const allOpen = (sim.corridors || []).filter(c => c.open);
          let corridor = null;
          if (sim.corridors.length > 0) {
            if (mem.confirmedByChannel === 'misinfo' && allOpen.length > 1) {
              const nearest = findNearestOpenCorridor(sim, mem.x, mem.y);
              const others  = allOpen.filter(c => c.id !== nearest?.id);
              corridor = others[Math.floor(rng() * others.length)];
            } else {
              corridor = findNearestOpenCorridor(sim, mem.x, mem.y);
            }
          }
          if (sim.corridors.length > 0 && !corridor) {
            if (!mem.trapped) {
              mem.trapped = true;
              newLogs.push(`t${t} ${mem.name} (${f.name}) trapped — all corridors blocked`);
            }
          } else {
            // A corridor is available (or none are configured), so a member who
            // was trapped while every corridor was shut is no longer trapped —
            // otherwise they stay counted as trapped in the run summary and the
            // policy advice even though they go on to evacuate.
            mem.trapped = false;
            // Checkpoint delay (applied once when EVAC begins)
            if (sim.checkpointDelay > 0 && !mem.checkpointed) {
              mem.checkpointed = true;
              if (rng() < 0.55) {
                const cpDelay = 1 + Math.floor(rng() * sim.checkpointDelay);
                mem.evacTicks += cpDelay;
                newLogs.push(`t${t} ${mem.name} held at checkpoint (+${cpDelay}t)`);
              }
            }
            mem.status = STATUS.EVAC;
            mem.evacStart = t;
            if (corridor) {
              mem.corridorId = corridor.id;
              mem.tx = corridor.exitX;
              mem.ty = corridor.exitY;
              const misdirNote = mem.confirmedByChannel === 'misinfo' && allOpen.length > 1 ? ' (misdirected — misinformation)' : '';
              newLogs.push(`t${t} ${mem.name} (${f.name}) evacuating via ${corridor.label} corridor${misdirNote}`);
            } else {
              const ang = Math.atan2(mem.y - canvasH / 2, mem.x - canvasW / 2);
              mem.tx = mem.x + Math.cos(ang) * 300;
              mem.ty = mem.y + Math.sin(ang) * 300;
              newLogs.push(`t${t} ${mem.name} (${f.name}) evacuating`);
            }
          }
        }
      }

      // ── EVAC → DONE ───────────────────────────────────────────────────────
      else if (mem.status === STATUS.EVAC) {
        const { speeds } = SCENARIOS[sim.scenario] ?? SCENARIOS.pedestrian;
        const spd = (mem.isChild || mem.isUnaccompChild) ? speeds.child
                  : mem.isElder ? speeds.elder
                  : mem.isPregnant ? speeds.pregnant
                  : speeds.adult;
        const dx = mem.tx - mem.x;
        const dy = mem.ty - mem.y;
        const d  = Math.hypot(dx, dy);
        // The EVAC → DONE transition below is time-based, but movement used to be
        // capped at `spd` per tick toward an exit 200–300 px away. Slow members
        // therefore reached DONE (and stopped being drawn) while still standing
        // beside their origin, and fast ones reached the exit and froze there
        // until their timer expired. Pace the *remaining* distance over the
        // *remaining* ticks so a member always reaches their exit by the tick
        // they are recorded as evacuated; anyone fast enough to get there sooner
        // still travels at their own category speed. Trapped members have no
        // completion tick, so they keep moving at their plain category speed.
        const remainingTicks = Math.max(1, (mem.evacStart + mem.evacTicks + 2) - t);
        const step = mem.trapped ? spd : Math.max(spd, d / remainingTicks);
        if (d > step) { mem.x += (dx / d) * step; mem.y += (dy / d) * step; }
        else { mem.x = mem.tx; mem.y = mem.ty; }
        // A member stranded by a closure has no open route, so they cannot
        // complete the evacuation until one reopens and they are rerouted.
        if (!mem.trapped && t - mem.evacStart >= mem.evacTicks + 2) {
          mem.status = STATUS.DONE;
          mem.doneAt = t;
          newLogs.push(`t${t} ${mem.name} (${f.name}) evacuated ✓`);
        }
      }
    });
  });

  const finished = sim.families.every((f) =>
    f.members.every((m) => m.status === STATUS.DONE || m.trapped)
  );
  if (finished) {
    const trapped = sim.families.flatMap(f => f.members).filter(m => m.trapped).length;
    if (trapped > 0)
      newLogs.push(`Simulation ended at tick ${sim.tick}. ${trapped} member${trapped > 1 ? "s" : ""} trapped — corridor(s) blocked.`);
    else
      newLogs.push(`All evacuated at tick ${sim.tick}.`);
  }

  return { sim, newLogs, finished };
}

// ─── Canvas renderer ──────────────────────────────────────────────────────────

function drawHexagon(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 3) * i;
    const x = cx + r * Math.cos(ang);
    const y = cy + r * Math.sin(ang);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawScenarioBackground(ctx, scenario, W, H, darkMode) {
  const c = darkMode ? "rgba(255,255,255," : "rgba(0,0,0,";
  ctx.save();

  if (scenario === "car") {
    ctx.fillStyle = c + "0.04)";
    ctx.fillRect(0, H * 0.3,  W, 34);
    ctx.fillRect(W * 0.63, 0, 34, H);
    ctx.strokeStyle = c + "0.07)";
    ctx.lineWidth = 1;
    ctx.setLineDash([14, 10]);
    ctx.beginPath(); ctx.moveTo(0, H * 0.3 + 17);   ctx.lineTo(W, H * 0.3 + 17);   ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W * 0.63 + 17, 0);   ctx.lineTo(W * 0.63 + 17, H);  ctx.stroke();
    ctx.setLineDash([]);

  } else if (scenario === "train") {
    const ry = H * 0.83;
    ctx.strokeStyle = c + "0.07)";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "square";
    for (let x = 14; x < W; x += 18) {
      ctx.beginPath(); ctx.moveTo(x, ry - 5); ctx.lineTo(x, ry + 5); ctx.stroke();
    }
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, ry - 3); ctx.lineTo(W, ry - 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ry + 3); ctx.lineTo(W, ry + 3); ctx.stroke();
    ctx.strokeStyle = c + "0.1)";
    ctx.lineWidth = 1;
    ctx.lineCap = "butt";
    ctx.strokeRect(W - 64, ry - 20, 56, 24);
    ctx.fillStyle = c + "0.1)";
    ctx.font = "8px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("STATION", W - 36, ry - 8);

  } else if (scenario === "pedestrian") {
    ctx.strokeStyle = c + "0.06)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.setLineDash([5, 9]);
    ctx.beginPath();
    ctx.moveTo(0, H * 0.27);
    ctx.bezierCurveTo(W * 0.33, H * 0.17, W * 0.58, H * 0.38, W, H * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W * 0.18, 0);
    ctx.bezierCurveTo(W * 0.26, H * 0.33, W * 0.2, H * 0.63, W * 0.32, H);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

/**
 * Draw the current simulation state onto a canvas context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} sim
 * @param {number} W  - canvas width
 * @param {number} H  - canvas height
 * @param {boolean} darkMode
 */
export function drawSimulation(ctx, sim, W, H, darkMode = false, highlightFamilyIdx = null) {
  const BG   = darkMode ? "#1a1a18" : "#f8f7f4";
  const GCOL = darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)";

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // 13f — Information saturation gauge (reached vs evacuated)
  {
    const allM     = sim.families.flatMap(f => f.members);
    const total    = allM.length;
    const reached  = allM.filter(m => m.status !== STATUS.UNAWARE).length;
    const evacuated= allM.filter(m => m.status === STATUS.DONE).length;
    const GH = 5;
    ctx.fillStyle = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
    ctx.fillRect(0, 0, W, GH);
    ctx.fillStyle = "rgba(55,138,221,0.45)";
    ctx.fillRect(0, 0, (reached / total) * W, GH);
    ctx.fillStyle = "rgba(29,158,117,0.8)";
    ctx.fillRect(0, 0, (evacuated / total) * W, GH);
    if (reached > 0) {
      ctx.font = "8px system-ui, sans-serif";
      ctx.fillStyle = darkMode ? "rgba(200,200,200,0.55)" : "rgba(60,60,60,0.5)";
      ctx.textAlign = "left";
      ctx.fillText(`${Math.round((reached / total) * 100)}% reached  ${Math.round((evacuated / total) * 100)}% evacuated`, 6, GH + 9);
    }
    // Dynamic threat indicator
    if (sim.threatRiseRate > 0) {
      const pct    = (sim.effectiveThreat - 1) / 9; // 0–1
      const tAlpha = 0.45 + pct * 0.45;
      ctx.font      = "8px system-ui, sans-serif";
      ctx.fillStyle = `rgba(220,38,38,${tAlpha})`;
      ctx.textAlign = "right";
      ctx.fillText(`▲ Threat ${sim.effectiveThreat.toFixed(1)}/10`, W - 6, GH + 9);
    }
  }

  // Grid
  ctx.strokeStyle = GCOL;
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 36) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Scenario-specific background context
  drawScenarioBackground(ctx, sim.scenario, W, H, darkMode);

  // Neighbor edges — brighten + animate dash when endpoint is socially active (13e)
  sim.neighborEdges.forEach((e) => {
    const aActive   = e.a.members.some(m => m.status === STATUS.MILLING || m.status === STATUS.EVAC);
    const bActive   = e.b.members.some(m => m.status === STATUS.MILLING || m.status === STATUS.EVAC);
    const socially  = aActive || bActive;
    const highlighted = highlightFamilyIdx === null || e.a.fi === highlightFamilyIdx || e.b.fi === highlightFamilyIdx;
    ctx.globalAlpha   = highlighted ? 1 : 0.1;
    ctx.lineWidth     = socially ? 1.5 : 1;
    ctx.strokeStyle   = socially ? "rgba(217,119,6,0.6)" : "rgba(120,118,112,0.42)";
    ctx.setLineDash([3, 4]);
    ctx.lineDashOffset = socially ? -(sim.dashOffset * 0.6) % 7 : 0;
    const ha = e.a.members[0], hb = e.b.members[0];
    ctx.beginPath(); ctx.moveTo(ha.x, ha.y); ctx.lineTo(hb.x, hb.y); ctx.stroke();
  });
  ctx.globalAlpha    = 1;
  ctx.lineDashOffset = 0;
  ctx.setLineDash([]);

  // Family bonds
  sim.families.forEach((f) => {
    ctx.globalAlpha = (highlightFamilyIdx === null || f.fi === highlightFamilyIdx) ? 1 : 0.1;
    const hub = f.members[0];
    f.members.slice(1).forEach((m) => {
      if (m.status === STATUS.DONE) return;
      ctx.beginPath(); ctx.moveTo(hub.x, hub.y); ctx.lineTo(m.x, m.y);
      ctx.strokeStyle = f.col + "44";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  });
  ctx.globalAlpha = 1;

  // Information arcs — official (blue) and social/neighbor (amber)
  sim.activeArcs.forEach((a) => {
    const maxAge = a.social ? 7 : 8;
    const age    = (sim.tick - a.born) / maxAge;
    if (age >= 1) return;
    const alpha  = Math.max(0, 1 - age) * (a.social ? 0.85 : 0.75);
    const hex    = Math.round(alpha * 255).toString(16).padStart(2, "0");

    ctx.save();
    if (age < 0.25) {
      ctx.shadowColor = a.col;
      ctx.shadowBlur  = a.social ? 8 : 6;
    }

    // Line — social arcs bow outward as a quadratic curve (13a)
    ctx.beginPath(); ctx.moveTo(a.x1, a.y1);
    if (a.social) {
      const mx  = (a.x1 + a.x2) / 2, my = (a.y1 + a.y2) / 2;
      const len = Math.hypot(a.x2 - a.x1, a.y2 - a.y1) || 1;
      const px  = -(a.y2 - a.y1) / len, py = (a.x2 - a.x1) / len;
      const bow = a.cascade ? 28 : 18;
      ctx.quadraticCurveTo(mx + px * bow, my + py * bow, a.x2, a.y2);
    } else {
      ctx.lineTo(a.x2, a.y2);
    }
    ctx.strokeStyle = a.col + hex;
    ctx.lineWidth   = a.social ? (a.cascade ? 2.5 : 2) : a.misinfo ? 2 : 1.5;
    ctx.setLineDash(a.social ? [5, 4] : a.misinfo ? [] : [3, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead at receiving end
    const ang  = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
    const dist = Math.hypot(a.x2 - a.x1, a.y2 - a.y1);
    if (dist > 20) {
      const offset = a.social ? 12 : 10;
      const tx = a.x2 - Math.cos(ang) * offset;
      const ty = a.y2 - Math.sin(ang) * offset;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - Math.cos(ang - 0.42) * 7, ty - Math.sin(ang - 0.42) * 7);
      ctx.lineTo(tx - Math.cos(ang + 0.42) * 7, ty - Math.sin(ang + 0.42) * 7);
      ctx.closePath();
      ctx.fillStyle = a.col + hex;
      ctx.fill();
    }

    ctx.restore();
  });

  // 13h — Broadcast ripples from info node
  const nd = sim.infoNode;
  sim.ripples.forEach((r) => {
    const age      = (sim.tick - r.born) / 7;
    if (age >= 1) return;
    const speed    = 0.4 + (r.clarity / 10) * 0.5;
    const maxR     = 80 + r.clarity * 6;
    const radius   = age * maxR * speed / 0.9;
    const alpha    = Math.max(0, 1 - age) * 0.45;
    ctx.beginPath();
    ctx.arc(nd.x, nd.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(55,138,221,${alpha.toFixed(2)})`;
    ctx.lineWidth   = 1.5 - age;
    ctx.stroke();
  });

  // Info node (center)
  const seekingCount = sim.families.reduce(
    (n, f) => n + f.members.filter((m) => m.status === STATUS.SEEKING).length, 0
  );
  const pulse = seekingCount > 0;
  drawHexagon(ctx, nd.x, nd.y, pulse ? 18 : 15);
  ctx.fillStyle   = pulse ? "#185FA5" : "rgba(55,138,221,0.2)";
  ctx.fill();
  ctx.strokeStyle = "#185FA5";
  ctx.lineWidth   = pulse ? 2 : 0.8;
  ctx.stroke();
  ctx.font      = '500 10px system-ui, sans-serif';
  ctx.fillStyle = pulse ? "#E6F1FB" : "#0C447C";
  ctx.textAlign = "center";
  ctx.fillText("Govt", nd.x, nd.y + 1);
  ctx.font      = "9px system-ui, sans-serif";
  ctx.fillStyle = darkMode ? "rgba(181,212,244,0.75)" : "#185FA5";
  const displayClar = sim.effectiveInfoClar != null && sim.infraDegradeRate > 0
    ? sim.effectiveInfoClar.toFixed(1)
    : sim.infoClar;
  ctx.fillText(`govt clarity ${displayClar}/10${sim.infraDegradeRate > 0 ? ' ▼' : ''}`, nd.x, nd.y + 24);
  ctx.fillText(`${Math.round(nd.reliability * 100)}% reliable`, nd.x, nd.y + 34);
  const sc = SCENARIOS[sim.scenario] ?? SCENARIOS.pedestrian;
  ctx.fillStyle = darkMode ? "rgba(200,200,200,0.6)" : "rgba(80,80,80,0.55)";
  ctx.fillText(`${sc.icon} ${sc.label}`, nd.x, nd.y + 46);

  // Humanitarian actor node (upper-left corner)
  if (sim.humNode && sim.humNode.access > 0) {
    const hnd = sim.humNode;
    const hActive = sim.families.some(f => f.members.some(m => m.reachableByHum && m.status !== STATUS.UNAWARE));
    ctx.save();
    ctx.beginPath(); ctx.arc(hnd.x, hnd.y, hActive ? 15 : 12, 0, Math.PI * 2);
    ctx.fillStyle   = hActive ? "#1D9E75" : "rgba(29,158,117,0.18)";
    ctx.fill();
    ctx.strokeStyle = "#0F6E56"; ctx.lineWidth = hActive ? 2 : 0.8; ctx.stroke();
    ctx.font        = '500 9px system-ui, sans-serif';
    ctx.fillStyle   = hActive ? "#fff" : "#0F6E56";
    ctx.textAlign   = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Aid", hnd.x, hnd.y);
    ctx.textBaseline = "alphabetic";
    ctx.font        = "8px system-ui, sans-serif";
    ctx.fillStyle   = darkMode ? "rgba(100,210,170,0.75)" : "#0F6E56";
    ctx.fillText(`${Math.round(hnd.access * 100)}% access`, hnd.x, hnd.y + 24);
    ctx.restore();
  }

  // Members
  sim.families.forEach((f) => {
    ctx.globalAlpha = (highlightFamilyIdx === null || f.fi === highlightFamilyIdx) ? 1 : 0.15;
    f.members.forEach((m) => {
      if (m.status === STATUS.DONE && !m.isHub) return;
      const rad  = m.isHub ? 9 : (m.isChild || m.isUnaccompChild) ? 4 : 5.5;
      const fill = m.isElder ? ELDER_FILL
                 : m.isChild ? CHILD_FILL
                 : m.isPregnant ? PREGNANT_FILL
                 : m.isUnaccompChild ? UNACCOMP_FILL
                 : STATUS_COLORS[m.status].fill;
      const str  = m.isElder && m.status !== STATUS.DONE ? ELDER_STR
                 : m.isChild && m.status !== STATUS.DONE ? CHILD_STR
                 : m.isPregnant && m.status !== STATUS.DONE ? PREGNANT_STR
                 : m.isUnaccompChild && m.status !== STATUS.DONE ? UNACCOMP_STR
                 : STATUS_COLORS[m.status].stroke;

      // Trapped member indicator — pulsing red dashed ring
      if (m.trapped) {
        const pulse = Math.sin(sim.tick * 0.4) * 0.3 + 0.7;
        ctx.beginPath(); ctx.arc(m.x, m.y, rad + 10, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(220,38,38,${pulse})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
      }

      // Coerced member — solid red ring (forced displacement indicator)
      if (m.coerced && m.status !== STATUS.DONE) {
        ctx.beginPath(); ctx.arc(m.x, m.y, rad + 7, 0, Math.PI * 2);
        ctx.strokeStyle = '#DC2626'; ctx.lineWidth = 1.5; ctx.stroke();
      }

      // Checkpoint badge — small amber dot on checkpointed EVAC members
      if (m.checkpointed && m.status === STATUS.EVAC) {
        ctx.beginPath(); ctx.arc(m.x + rad + 1, m.y - rad - 1, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#D97706'; ctx.fill();
      }

      // 13d — Persistent "reached" halo: thin ring on any member alerted at least once
      if (m.seekStart !== null && m.status !== STATUS.DONE) {
        ctx.beginPath(); ctx.arc(m.x, m.y, rad + 8, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(55,138,221,0.22)";
        ctx.lineWidth = 1; ctx.stroke();
      }

      // 13g — Confirmation progress ring: always visible, full when highlighted
      if (m.status === STATUS.SEEKING) {
        const isHighlighted = highlightFamilyIdx === null || f.fi === highlightFamilyIdx;
        ctx.beginPath(); ctx.arc(m.x, m.y, rad + 5, 0, Math.PI * 2);
        ctx.fillStyle = isHighlighted ? "rgba(55,138,221,0.13)" : "rgba(55,138,221,0.06)";
        ctx.fill();
        const prog = clamp(m.confirmCount / Math.max(1, m.confirmNeeded), 0, 1);
        if (prog > 0) {
          ctx.beginPath();
          ctx.arc(m.x, m.y, rad + 5, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
          ctx.strokeStyle = isHighlighted ? "#378ADD" : "rgba(55,138,221,0.45)";
          ctx.lineWidth = isHighlighted ? 2 : 1.5; ctx.stroke();
        }
      }

      // Milling glow
      if (m.status === STATUS.MILLING) {
        ctx.beginPath(); ctx.arc(m.x, m.y, rad + 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(239,159,39,0.16)"; ctx.fill();
      }

      // Each IHL-protected population type has a distinct shape
      if (m.isChild && m.status !== STATUS.DONE) {
        // Child <5: rotated diamond (pink)
        ctx.save();
        ctx.translate(m.x, m.y); ctx.rotate(Math.PI / 4);
        ctx.beginPath(); ctx.rect(-4, -4, 8, 8);
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = str; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.restore();
      } else if (m.isUnaccompChild && m.status !== STATUS.DONE) {
        // Unaccompanied minor: upward triangle (orange)
        ctx.beginPath();
        ctx.moveTo(m.x, m.y - rad * 1.25);
        ctx.lineTo(m.x + rad, m.y + rad * 0.75);
        ctx.lineTo(m.x - rad, m.y + rad * 0.75);
        ctx.closePath();
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = str; ctx.lineWidth = 0.8; ctx.stroke();
      } else {
        // Circle: elders (purple), pregnant (teal), adults, hubs
        ctx.beginPath(); ctx.arc(m.x, m.y, rad, 0, Math.PI * 2);
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = str; ctx.lineWidth = m.isHub ? 1.5 : 0.8; ctx.stroke();
        // Pregnant women: white cross overlay (medical/maternity symbol)
        if (m.isPregnant && m.status !== STATUS.DONE) {
          ctx.strokeStyle = "rgba(255,255,255,0.92)";
          ctx.lineWidth = 1.5; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(m.x - rad * 0.48, m.y); ctx.lineTo(m.x + rad * 0.48, m.y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(m.x, m.y - rad * 0.48); ctx.lineTo(m.x, m.y + rad * 0.48); ctx.stroke();
          ctx.lineCap = "butt";
        }
      }

      // Evacuation direction arrow
      if (m.status === STATUS.EVAC && Math.hypot(m.tx - m.x, m.ty - m.y) > 8) {
        const ang = Math.atan2(m.ty - m.y, m.tx - m.x);
        const tip = rad + 8;
        const ax = m.x + Math.cos(ang) * tip;
        const ay = m.y + Math.sin(ang) * tip;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - Math.cos(ang - 0.5) * 6, ay - Math.sin(ang - 0.5) * 6);
        ctx.lineTo(ax - Math.cos(ang + 0.5) * 6, ay - Math.sin(ang + 0.5) * 6);
        ctx.closePath();
        ctx.fillStyle = STATUS_COLORS[STATUS.EVAC].stroke;
        ctx.fill();
      }

      // Labels — hub name always; detail labels only when this family is highlighted
      const showDetail = highlightFamilyIdx !== null && f.fi === highlightFamilyIdx;
      if (m.isHub) {
        ctx.font      = '500 10px system-ui, sans-serif';
        ctx.fillStyle = f.col;
        ctx.textAlign = "center";
        const tags = [];
        if (f.elderCount > 0)    tags.push(`${f.elderCount}e`);
        if (f.childCount > 0)    tags.push(`${f.childCount}c`);
        if (f.pregnantCount > 0) tags.push(`${f.pregnantCount}p`);
        if (f.unaccompCount > 0) tags.push(`${f.unaccompCount}u`);
        ctx.fillText(f.name + (tags.length ? ` (${tags.join(" ")})` : ""), m.x, m.y - (rad + 14));
      }
      if (showDetail && m.isElder && m.status !== STATUS.DONE) {
        ctx.font = "9px system-ui, sans-serif"; ctx.fillStyle = ELDER_STR; ctx.textAlign = "center";
        ctx.fillText("elder", m.x, m.y + (rad + 7));
      }
      if (showDetail && m.isChild && m.status !== STATUS.DONE) {
        ctx.font = "9px system-ui, sans-serif"; ctx.fillStyle = CHILD_STR; ctx.textAlign = "center";
        ctx.fillText("<5", m.x, m.y + (rad + 9));
      }
      if (showDetail && m.isPregnant && m.status !== STATUS.DONE) {
        ctx.font = "9px system-ui, sans-serif"; ctx.fillStyle = PREGNANT_STR; ctx.textAlign = "center";
        ctx.fillText("preg.", m.x, m.y + (rad + 7));
      }
      if (showDetail && m.isUnaccompChild && m.status !== STATUS.DONE) {
        ctx.font = "9px system-ui, sans-serif"; ctx.fillStyle = UNACCOMP_STR; ctx.textAlign = "center";
        ctx.fillText("minor", m.x, m.y + (rad + 9));
      }
      if (showDetail && m.status === STATUS.SEEKING) {
        ctx.font      = "9px system-ui, sans-serif";
        ctx.fillStyle = darkMode ? "#B5D4F4" : "#185FA5";
        ctx.textAlign = "center";
        ctx.fillText(`${m.confirmCount}/${m.confirmNeeded}`, m.x, m.y - (rad + 8));
      }
    });

    // Per-family evacuation progress bar
    const hub  = f.members[0];
    const done = f.members.filter((m) => m.status === STATUS.DONE).length;
    const tot  = f.members.length;
    if (done > 0 && done < tot) {
      const bw = 34, bx = hub.x - 17, by = hub.y + 12;
      ctx.fillStyle = "rgba(150,148,142,0.25)"; ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = "#1D9E75";               ctx.fillRect(bx, by, bw * (done / tot), 4);
    }
  });
  ctx.globalAlpha = 1;

  // ── Corridor closure ripples ──────────────────────────────────────────────
  (sim.closureEvents || []).forEach((e) => {
    const age = (sim.tick - e.born) / 9;
    if (age >= 1) return;
    ctx.beginPath();
    ctx.arc(e.x, e.y, age * 70, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(220,38,38,${(1 - age) * 0.7})`;
    ctx.lineWidth = 2; ctx.stroke();
  });

  // ── Corridor opening ripples (green, ceasefire window)
  (sim.openEvents || []).forEach((e) => {
    const age = (sim.tick - e.born) / 7;
    if (age >= 1) return;
    ctx.beginPath();
    ctx.arc(e.x, e.y, age * 70, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(29,158,117,${(1 - age) * 0.7})`;
    ctx.lineWidth = 2; ctx.stroke();
  });

  // ── Corridor gate markers ─────────────────────────────────────────────────
  (sim.corridors || []).forEach((c) => {
    const t   = sim.tick;
    const closingSoon = c.open && c.closesAtTick !== null && c.closesAtTick - t <= 5 && c.closesAtTick > t;
    const col = c.pendingOpen ? '#D97706'
              : c.open ? (closingSoon ? '#F59E0B' : '#1D9E75')
              : '#DC2626';
    const R   = 14;

    ctx.save();

    // Gate circle
    ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
    ctx.fillStyle   = col; ctx.fill();
    ctx.strokeStyle = darkMode ? '#1a1a18' : '#f8f7f4';
    ctx.lineWidth   = 2; ctx.stroke();

    // Gate letter
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.fillStyle   = '#fff';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.id, c.x, c.y);

    // X overlay when closed
    if (!c.open) {
      const d = 4;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(c.x - d, c.y - d); ctx.lineTo(c.x + d, c.y + d);
      ctx.moveTo(c.x + d, c.y - d); ctx.lineTo(c.x - d, c.y + d);
      ctx.stroke();
    }

    // "closes t:N" label directed toward canvas centre
    if (c.open && c.closesAtTick !== null) {
      const inset = R + 12;
      const [lx, ly] = c.id === 'N' ? [c.x, c.y + inset]
                      : c.id === 'S' ? [c.x, c.y - inset]
                      : c.id === 'E' ? [c.x - inset, c.y]
                      :                [c.x + inset, c.y];
      ctx.font      = `${closingSoon ? '700' : '500'} 8px system-ui, sans-serif`;
      ctx.fillStyle = closingSoon ? '#F59E0B' : (darkMode ? 'rgba(220,220,220,0.7)' : 'rgba(60,60,60,0.6)');
      ctx.textBaseline = 'middle';
      ctx.fillText(`closes t:${c.closesAtTick}`, lx, ly);
    }

    if (c.pendingOpen && c.opensAtTick !== null) {
      const inset = R + 12;
      const [lx, ly] = c.id === 'N' ? [c.x, c.y + inset]
                      : c.id === 'S' ? [c.x, c.y - inset]
                      : c.id === 'E' ? [c.x - inset, c.y]
                      :                [c.x + inset, c.y];
      ctx.font      = '500 8px system-ui, sans-serif';
      ctx.fillStyle = '#D97706';
      ctx.textBaseline = 'middle';
      ctx.fillText(`opens t:${c.opensAtTick}`, lx, ly);
    }

    // "BLOCKED" label when closed
    if (!c.open) {
      const inset = R + 12;
      const [lx, ly] = c.id === 'N' ? [c.x, c.y + inset]
                      : c.id === 'S' ? [c.x, c.y - inset]
                      : c.id === 'E' ? [c.x - inset, c.y]
                      :                [c.x + inset, c.y];
      ctx.font      = '600 8px system-ui, sans-serif';
      ctx.fillStyle = '#DC2626';
      ctx.textBaseline = 'middle';
      ctx.fillText('BLOCKED', lx, ly);
    }

    ctx.restore();
  });

  // 13i+13j — Confirmation-source flashes (expanding rings coloured by channel)
  sim.flashes.forEach((fl) => {
    const age    = (sim.tick - fl.born) / 5;
    if (age >= 1) return;
    const radius = 8 + age * 26;
    const alpha  = (1 - age) * 0.7;
    ctx.save();
    ctx.shadowColor = fl.col; ctx.shadowBlur = 10 * (1 - age);
    ctx.beginPath(); ctx.arc(fl.x, fl.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = fl.col + Math.round(alpha * 255).toString(16).padStart(2, "0");
    ctx.lineWidth = 2.5 - age * 1.5;
    ctx.stroke();
    ctx.restore();
  });
}

// ─── Stats helper ─────────────────────────────────────────────────────────────

/**
 * Count members by status and return summary stats.
 * @param {object} sim
 * @returns {{ counts: number[], elders: number, children: number, total: number, pctClear: number }}
 */
export function getStats(sim) {
  const counts = [0, 0, 0, 0, 0];
  let total = 0, elders = 0, children = 0, pregnant = 0, unaccomp = 0;
  sim.families.forEach((f) =>
    f.members.forEach((m) => {
      counts[m.status]++;
      total++;
      if (m.isElder)         elders++;
      if (m.isChild)         children++;
      if (m.isPregnant)      pregnant++;
      if (m.isUnaccompChild) unaccomp++;
    })
  );
  return { counts, elders, children, pregnant, unaccomp, total, pctClear: total > 0 ? Math.round((counts[4] / total) * 100) : 0 };
}

// ─── Run summary ──────────────────────────────────────────────────────────────

export function computeRunSummary(sim, params) {
  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const familyData = sim.families.map(f => {
    const ms    = f.members;
    const seek  = ms.filter(m => m.seekStart  !== null && m.millingStart !== null).map(m => m.millingStart - m.seekStart);
    const mill  = ms.filter(m => m.millingStart !== null && m.evacStart  !== null).map(m => m.evacStart   - m.millingStart);
    const evac  = ms.filter(m => m.evacStart   !== null && m.doneAt      !== null).map(m => m.doneAt      - m.evacStart);
    const avgSeek = avg(seek), avgMill = avg(mill), avgEvac = avg(evac);
    return {
      name: f.name, col: f.col,
      elderCount: f.elderCount, childCount: f.childCount,
      pregnantCount: f.pregnantCount ?? 0, unaccompCount: f.unaccompCount ?? 0,
      seek: avgSeek, mill: avgMill, evac: avgEvac,
      total: avgSeek + avgMill + avgEvac,
      lastDone: Math.max(...ms.map(m => m.doneAt ?? 0)),
    };
  });

  const allMs   = sim.families.flatMap(f => f.members);
  const allSeek = allMs.filter(m => m.seekStart !== null  && m.millingStart !== null).map(m => m.millingStart - m.seekStart);
  const allMill = allMs.filter(m => m.millingStart !== null && m.evacStart  !== null).map(m => m.evacStart   - m.millingStart);
  const allEvac = allMs.filter(m => m.evacStart   !== null && m.doneAt      !== null).map(m => m.doneAt      - m.evacStart);

  const trappedCount = sim.families.flatMap(f => f.members).filter(m => m.trapped).length;
  const slowest = familyData.reduce((a, b) => a.lastDone > b.lastDone ? a : b);
  let bottleneck = "";
  if (slowest.elderCount > 0)    bottleneck = `${slowest.elderCount} elder${slowest.elderCount > 1 ? "s" : ""}`;
  if (slowest.childCount > 0)    bottleneck += (bottleneck ? " + " : "") + `${slowest.childCount} child${slowest.childCount > 1 ? "ren" : ""}`;
  if (slowest.pregnantCount > 0) bottleneck += (bottleneck ? " + " : "") + `${slowest.pregnantCount} pregnant`;
  if (slowest.unaccompCount > 0) bottleneck += (bottleneck ? " + " : "") + `${slowest.unaccompCount} unaccomp. minor${slowest.unaccompCount > 1 ? "s" : ""}`;
  if (!bottleneck) bottleneck = "large household";

  // Neighbour influence summary
  const allMs2             = sim.families.flatMap(f => f.members);
  const confirmedMembers   = allMs2.filter(m => m.millingStart !== null);
  const sociallyConfirmed      = confirmedMembers.filter(m => m.confirmedByChannel === 'social').length;
  const humanitarianConfirmed  = confirmedMembers.filter(m => m.confirmedByChannel === 'humanitarian').length;
  const misinfoConfirmed       = confirmedMembers.filter(m => m.confirmedByChannel === 'misinfo').length;
  const coercedConfirmed       = confirmedMembers.filter(m => m.confirmedByChannel === 'coerced').length;
  const officiallyConfirmed    = confirmedMembers.filter(m =>
    m.confirmedByChannel === 'official' || (!m.confirmedByChannel && !m.coerced)
  ).length;
  const maxCh = Math.max(sociallyConfirmed, humanitarianConfirmed, officiallyConfirmed, misinfoConfirmed);
  const dominantChannel = misinfoConfirmed === maxCh && misinfoConfirmed > officiallyConfirmed ? "misinfo"
    : humanitarianConfirmed === maxCh && humanitarianConfirmed > officiallyConfirmed ? "humanitarian"
    : sociallyConfirmed === maxCh && sociallyConfirmed > officiallyConfirmed ? "social"
    : "official";

  const coercedCount      = allMs2.filter(m => m.coerced).length;
  const checkpointedCount = allMs2.filter(m => m.checkpointed).length;

  const neighbourFamilyData = sim.families.map(f => ({
    name:         f.name,
    col:          f.col,
    social:       f.members.filter(m => m.confirmedByChannel === 'social').length,
    humanitarian: f.members.filter(m => m.confirmedByChannel === 'humanitarian').length,
    misinfo:      f.members.filter(m => m.confirmedByChannel === 'misinfo').length,
    official:     f.members.filter(m =>
      m.millingStart !== null && (m.confirmedByChannel === 'official' || (!m.confirmedByChannel && !m.coerced))
    ).length,
  }));

  return {
    id: Date.now(),
    totalTicks:  sim.tick,
    avgSeeking:  avg(allSeek),
    avgMilling:  avg(allMill),
    avgEvac:     avg(allEvac),
    slowestFamily: slowest.name,
    bottleneck,
    familyData,
    scenario: sim.scenario,
    seed: sim.seed,
    params: { ...params },
    trappedCount,
    // Neighbour influence
    socialEvents:          sim.socialInfluenceEvents,
    sociallyConfirmed,
    humanitarianConfirmed,
    officiallyConfirmed,
    misinfoConfirmed,
    coercedCount,
    checkpointedCount,
    dominantChannel,
    neighbourFamilyData,
  };
}

// ─── Canvas interaction helpers ───────────────────────────────────────────────

function getCanvasCoords(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    cx: (e.clientX - rect.left) * scaleX,
    cy: (e.clientY - rect.top)  * scaleY,
    px: e.clientX - rect.left,
    py: e.clientY - rect.top,
    canvasWidth: rect.width,
  };
}

function hitTest(cx, cy, families) {
  for (const f of families) {
    for (const m of f.members) {
      const rad = (m.isHub ? 9 : m.isChild ? 4 : 5.5) + 5;
      if (Math.hypot(cx - m.x, cy - m.y) <= rad) return { member: m, family: f };
    }
  }
  return null;
}

// ─── Communications advice generator ─────────────────────────────────────────

function generateCommsAdvice(rs) {
  const items = [];
  const p = rs.params ?? {};

  // 1 — Message clarity / seeking bottleneck
  if (rs.avgSeeking >= 6 || p.infoClar <= 4) {
    items.push({
      tag: "Message clarity",
      col: "#185FA5",
      bg: "#E6F1FB",
      title: p.infoClar <= 4
        ? "Simplify and pre-validate messages with the community"
        : `Cut confirmation burden — avg. ${rs.avgSeeking} ticks in seeking`,
      body: p.infoClar <= 4
        ? "Ambiguous messages force households to seek multiple sources before acting — a dangerous delay in a fast-moving emergency. Test evacuation messages with community representatives before any crisis, use plain language in all spoken languages present, and pair official broadcasts with community-level repetition so each channel counts as an independent confirmation."
        : `Households spent an average of ${rs.avgSeeking} ticks seeking confirmation before acting. Distributing identical messages through three or more simultaneous channels — radio, SMS, and a trusted community messenger — is operationally equivalent to reducing each household's confirmation threshold, because each channel provides independent evidence rather than waiting for the same source to repeat itself.`,
    });
  }

  // 2 — Vulnerable population milling delays
  if ((p.elderPct >= 15 || p.childPct >= 15 || (p.pregnantPct ?? 0) >= 8 || (p.unaccompChildPct ?? 0) > 0) && rs.avgMilling >= 5) {
    const groups = [];
    if (p.elderPct >= 15)          groups.push("elders");
    if (p.childPct >= 15)          groups.push("young children");
    if ((p.pregnantPct ?? 0) >= 8) groups.push("pregnant women");
    if ((p.unaccompChildPct ?? 0) > 0) groups.push("unaccompanied minors");
    const who = groups.length > 1
      ? groups.slice(0, -1).join(", ") + " and " + groups[groups.length - 1]
      : groups[0] ?? "vulnerable members";
    items.push({
      tag: "Vulnerable populations",
      col: "#534AB7",
      bg: "#EEECFB",
      title: `Deploy direct outreach to households with ${who}`,
      body: `Preparation delays from ${who} (avg. milling ${rs.avgMilling} ticks) are structural — they cannot be eliminated through better broadcast messaging alone. Pre-register these households before any emergency, dispatch a community liaison to them personally at the moment the alert is issued, and communicate assisted transport pickup points as part of the initial message. Physical presence converts passive waiting into active, supported preparation.`,
    });
  }

  // 3 — Channel mix
  if (rs.dominantChannel === 'social') {
    items.push({
      tag: "Channel strategy",
      col: "#BA7517",
      bg: "#FEF3E2",
      title: "Formalise community anchor households as early-mover messengers",
      body: "Social contagion drove most final confirmations — one household departing visibly was more persuasive than the official broadcast. Make this intentional: identify two or three highly-connected households per neighbourhood before any emergency, brief them privately so they receive the alert first, and ask them to begin visible preparation immediately. The cascade effect is faster and more credible than any broadcast you can produce.",
    });
  } else if (rs.dominantChannel === 'humanitarian') {
    items.push({
      tag: "Channel strategy",
      col: "#0F6E56",
      bg: "#E6F7F0",
      title: "Protect humanitarian actor credibility and document access arrangements",
      body: "Humanitarian channels were more influential than the official broadcast in this run — reflecting earned community trust. Safeguard it: ensure field teams never co-brand with military actors, carry written access authorisations at all times, and maintain messaging that is demonstrably independent of government communications. Trust built over months is lost in one instance of perceived partiality.",
    });
  } else {
    items.push({
      tag: "Channel strategy",
      col: "#185FA5",
      bg: "#E6F1FB",
      title: "Build redundant channels now — before the crisis",
      body: "Official broadcast dominated in this run. Single-channel dependency is fragile: infrastructure damage, deliberate jamming, or a single credibility incident leaves households with no fallback. Pre-establish community radio trees, SMS broadcast lists, and trained neighbourhood messengers so that the same message reaches every household through at least three independent paths simultaneously.",
    });
  }

  // 4 — Humanitarian access restriction
  if (p.humanitarianAccess != null && p.humanitarianAccess <= 35) {
    items.push({
      tag: "Access",
      col: "#92400E",
      bg: "#FEF3E2",
      title: "Escalate access denials — and fill gaps with community intermediaries",
      body: `At ${p.humanitarianAccess}% access, a substantial share of households are beyond direct reach of the humanitarian actor. Formally document every access denial referencing AP I Art. 70 and Customary IHL Rule 55, submit notifications through OCHA's Access Monitoring and Reporting Framework, and raise denials with protection cluster leads. In the interim, map community intermediaries — religious leaders, school teachers, health workers — who can relay humanitarian messaging to households in inaccessible areas without requiring your physical presence.`,
    });
  }

  // 5 — Dynamic threat escalation
  if (p.threatRiseRate >= 6) {
    items.push({
      tag: "Early warning",
      col: "#A32D2D",
      bg: "#FEE2E2",
      title: "Issue graded warnings that communicate rate of change, not just current severity",
      body: `A fast-rising threat compressed the safe window for households with longer milling times. A single alert at high-threat level is already too late for families who need extended preparation. Issue tiered warnings tied to escalation trajectory — not just "threat is high" but "conditions will be critical in approximately X minutes — households with limited mobility should begin preparing now." Time the first warning to give your most vulnerable households enough lead time to complete preparation before conditions peak.`,
    });
  }

  // 6 — Trapped members
  if (rs.trappedCount > 0) {
    items.push({
      tag: "Route communication",
      col: "#A32D2D",
      bg: "#FEE2E2",
      title: "Communicate corridor status continuously and through every available channel",
      body: `${rs.trappedCount} member${rs.trappedCount !== 1 ? "s were" : " was"} trapped when exit routes closed. In a real emergency this represents the direct cost of households receiving route information too late. Corridor status — open, closing, closed — must be broadcast as it changes through radio, SMS, and physical runners, not just at the start of the evacuation. Pre-designate a liaison at each exit point responsible for immediately notifying the coordination hub the moment access is restricted, so that message can reach households who have not yet departed.`,
    });
  }

  // 7 — Transport in pedestrian scenario with vulnerable members
  if (rs.scenario === 'pedestrian' && (p.elderPct >= 20 || p.childPct >= 15) && !items.some(i => i.tag === 'Vulnerable populations')) {
    items.push({
      tag: "Transport",
      col: "#185FA5",
      bg: "#E6F1FB",
      title: "Include assisted-transport details in the initial alert",
      body: "Pedestrian evacuation with mobility-limited members requires the alert to answer not just 'go' but 'how.' Include pickup point, departure window, and contact number in the first message — households should be moving toward a vehicle, not calculating whether they can sustain a walking route. If vehicle capacity is limited, prioritise households with multiple vulnerable members, who face compounding preparation and movement delays.",
    });
  }

  // Coercion
  if (rs.coercedCount > 0) {
    items.push({
      tag: "Forced displacement",
      col: "#DC2626",
      bg: "#FEE2E2",
      title: `Document the ${rs.coercedCount} forced displacement${rs.coercedCount !== 1 ? "s" : ""} — and pursue accountability`,
      body: `Coerced evacuation before voluntary confirmation is a violation of Art. 17 AP II and Customary IHL Rule 129. Each instance should be documented with time, location, and household composition, submitted to the protection cluster and OHCHR, and flagged in OCHA's Humanitarian Needs Overview. Documentation is the primary accountability mechanism when direct intervention is not possible.`,
    });
  }

  // Checkpoint delays
  if (rs.checkpointedCount > 0) {
    items.push({
      tag: "Checkpoints",
      col: "#D97706",
      bg: "#FEF3E2",
      title: "Negotiate checkpoint procedures — and pre-register vulnerable households",
      body: `${rs.checkpointedCount} member${rs.checkpointedCount !== 1 ? "s were" : " was"} delayed at checkpoints. Under GC IV Art. 17, parties must endeavour to conclude local agreements for the removal of the wounded, sick, infirm, aged, children and maternity cases from besieged areas, and Customary Rules 55-56 require rapid, unimpeded passage of humanitarian relief. Screening must not become de facto obstruction. Negotiate in advance a simplified screening procedure for documented humanitarian evacuations, and pre-register households with elders, young children, or medical needs so they can be waved through priority lanes without full documentation checks.`,
    });
  }

  // Misinformation
  if ((rs.misinfoConfirmed ?? 0) > 0) {
    items.push({
      tag: "Misinformation",
      col: "#DC2626",
      bg: "#FEE2E2",
      title: "Counter false information with authoritative, repeated, multi-channel correction",
      body: `${rs.misinfoConfirmed} member${rs.misinfoConfirmed !== 1 ? "s" : ""} were confirmed primarily by false information — risking misdirection toward blocked or dangerous routes. Counter-messaging must be faster and louder than the misinformation: issue corrections through every channel simultaneously, name the false claim explicitly ("reports of a safe exit via [X] are false"), and enlist trusted community voices to amplify the correction. Under AP I Art. 37, deliberate deception of civilians is prohibited — document the source of false information for accountability.`,
    });
  }

  // Pregnant women
  if ((p.pregnantPct ?? 0) >= 8) {
    items.push({
      tag: "Pregnant women",
      col: "#0891B2",
      bg: "#E0F2FE",
      title: "Arrange assisted transport and priority corridor access for pregnant women",
      body: `Pregnant women face compound delays: physical mobility constraints extend milling time, and uncertainty about medical access along the route can cause them to defer departure. Pre-register pregnant women with local health authorities before any emergency, assign them a dedicated maternal health liaison, communicate the location of medical points along the route, and reserve priority access at checkpoints. Under AP I Art. 16 and GC IV Art. 23, pregnant women are entitled to special protection and priority access to humanitarian relief.`,
    });
  }

  // Unaccompanied minors
  if ((p.unaccompChildPct ?? 0) > 0) {
    items.push({
      tag: "Unaccompanied minors",
      col: "#EA580C",
      bg: "#FFF7ED",
      title: "Activate family reunification protocols before routing unaccompanied children",
      body: `Unaccompanied children cannot safely evacuate without an authorised escort. Under AP I Art. 77 and GC IV Arts. 24 and 50, children are entitled to special respect and protection and to measures securing their identification and family unity. (AP I Art. 78 governs evacuation to a foreign country and does not apply to internal evacuation.) Establish a child registration desk at the nearest safe point, activate ICRC family tracing services, and brief community monitors to hold separated children at a safe assembly point rather than routing them into the main evacuation flow. Movement without reunification exposes children to trafficking and secondary harm.`,
    });
  }

  return items.slice(0, 5);
}

// ─── React UI component ───────────────────────────────────────────────────────

export default function EvacuationSim() {
  const canvasRef            = useRef(null);
  const simRef               = useRef(null);
  const timerRef             = useRef(null);
  const hoveredFamilyIdxRef  = useRef(null);
  const paramsRef            = useRef(null);

  const [running,      setRunning]      = useState(false);
  const [tick,         setTick]         = useState(0);
  const [stats,        setStats]        = useState(null);
  const [logs,         setLogs]         = useState([]);
  const [finished,     setFinished]     = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showSliders,  setShowSliders]  = useState(true);
  const [runSummary,   setRunSummary]   = useState(null);
  const [runHistory,   setRunHistory]   = useState([]);
  const [pinnedRunId,  setPinnedRunId]  = useState(null);

  const [scenario, setScenario] = useState("pedestrian");
  // Seed for the simulation's PRNG — record it to replay a run exactly.
  const [seed, setSeed] = useState(DEFAULT_SEED);

  const DEFAULT_CORRIDORS = [
    { id: 'N', label: 'North', open: true, closesAtTick: '', opensAtTick: '' },
    { id: 'S', label: 'South', open: true, closesAtTick: '', opensAtTick: '' },
    { id: 'E', label: 'East',  open: true, closesAtTick: '', opensAtTick: '' },
    { id: 'W', label: 'West',  open: true, closesAtTick: '', opensAtTick: '' },
  ];
  const [corridorSettings, setCorridorSettings] = useState(DEFAULT_CORRIDORS);

  const [params, setParams] = useState({
    threat:               6,
    threatRiseRate:       0,
    elderPct:             20,  // stored as integer percent
    childPct:             20,
    pregnantPct:          0,
    unaccompChildPct:     0,
    infoClar:             5,
    nbrInfluence:         55,
    avgFamilySize:        3,
    humanitarianAccess:   40,
    checkpointDelay:   0,
    misinfoRate:       0,
    infraDegradeRate:  0,
    coercionRisk:      0,
  });

  // ── Build / reset ──────────────────────────────────────────────────────────
  const reset = useCallback((overrideScenario) => {
    clearInterval(timerRef.current);
    setRunning(false);
    setFinished(false);
    setTick(0);
    setLogs(["Ready. Press Run to start the evacuation."]);
    setSelectedNode(null);
    setRunSummary(null);
    hoveredFamilyIdxRef.current = null;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.clientWidth;
    canvas.width  = W;
    canvas.height = CANVAS_HEIGHT;

    const sim = buildSimulation({
      threat:         params.threat,
      threatRiseRate: params.threatRiseRate / 10,
      elderPct:         params.elderPct / 100,
      childPct:         params.childPct / 100,
      pregnantPct:      params.pregnantPct / 100,
      unaccompChildPct: params.unaccompChildPct / 100,
      infoClar:      params.infoClar,
      nbrInfluence:         params.nbrInfluence / 100,
      avgFamilySize:        params.avgFamilySize,
      humanitarianAccess:   params.humanitarianAccess / 100,
      checkpointDelay:   params.checkpointDelay,
      misinfoRate:       params.misinfoRate / 100,
      infraDegradeRate:  params.infraDegradeRate,
      coercionRisk:      params.coercionRisk / 100,
      scenario:             overrideScenario ?? scenario,
      corridorSettings: corridorSettings.map(c => ({
        ...c,
        // `|| null` would collapse a legitimate tick 0 to null, so a gate set to
        // close/open at tick 0 would never do so. Only a non-numeric entry
        // should become null.
        closesAtTick: toTick(c.closesAtTick),
        opensAtTick: toTick(c.opensAtTick),
      })),
      seed,
      canvasWidth:   W,
    });
    simRef.current = sim;

    const ctx = canvas.getContext("2d");
    drawSimulation(ctx, sim, W, CANVAS_HEIGHT, false, hoveredFamilyIdxRef.current);
    setStats(getStats(sim));
  }, [params, scenario, corridorSettings, seed]);

  useEffect(() => { reset(); }, [reset]);

  // ── Step ───────────────────────────────────────────────────────────────────
  const step = useCallback(() => {
    const canvas = canvasRef.current;
    const sim    = simRef.current;
    if (!canvas || !sim) return false;

    if (!sim.started) {
      sim.started = true;
      setLogs((prev) => [
        ...prev,
        `📋 Warring parties have agreed to allow civilian evacuation (AP II Art. 17). A humanitarian corridor is in effect.`,
        `⚠ Alert issued — threat ${sim.threat}/10, clarity ${sim.infoClar}/10.`,
      ]);
    }

    const W   = canvas.width;
    const H   = canvas.height;
    const { newLogs, finished } = stepSimulation(sim, W, H);

    const ctx = canvas.getContext("2d");
    drawSimulation(ctx, sim, W, H, false, hoveredFamilyIdxRef.current);
    setTick(sim.tick);
    setStats(getStats(sim));
    setLogs((prev) => [...prev, ...newLogs].slice(-80));

    if (finished) {
      setFinished(true);
      clearInterval(timerRef.current);
      setRunning(false);
      const summary = computeRunSummary(simRef.current, paramsRef.current);
      setRunSummary(summary);
      setRunHistory(prev => [summary, ...prev].slice(0, 5));
    }
    return !finished;
  }, []);

  // ── Run / pause ────────────────────────────────────────────────────────────
  const toggleRun = useCallback(() => {
    if (running) {
      clearInterval(timerRef.current);
      setRunning(false);
    } else {
      setRunning(true);
      timerRef.current = setInterval(() => {
        const cont = step();
        if (!cont) clearInterval(timerRef.current);
      }, SIM_INTERVAL_MS);
    }
  }, [running, step]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  useEffect(() => { if (running) setShowSliders(false); }, [running]);
  useEffect(() => { paramsRef.current = params; }, [params]);

  // ── Slider change ──────────────────────────────────────────────────────────
  const handleSlider = (key) => (e) => {
    setParams((prev) => ({ ...prev, [key]: +e.target.value }));
  };

  // ── Canvas interaction ─────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    const sim    = simRef.current;
    if (!canvas || !sim) return;
    const { cx, cy } = getCanvasCoords(e, canvas);
    const hit    = hitTest(cx, cy, sim.families);
    const newIdx = hit ? hit.family.fi : null;
    if (newIdx !== hoveredFamilyIdxRef.current) {
      hoveredFamilyIdxRef.current = newIdx;
      const ctx = canvas.getContext("2d");
      drawSimulation(ctx, sim, canvas.width, canvas.height, false, newIdx);
    }
    canvas.style.cursor = hit ? "pointer" : "default";
  }, []);

  const handleMouseLeave = useCallback(() => {
    const canvas = canvasRef.current;
    const sim    = simRef.current;
    if (!canvas || !sim) return;
    hoveredFamilyIdxRef.current = null;
    const ctx = canvas.getContext("2d");
    drawSimulation(ctx, sim, canvas.width, canvas.height, false, null);
    canvas.style.cursor = "default";
  }, []);

  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current;
    const sim    = simRef.current;
    if (!canvas || !sim) return;
    const coords = getCanvasCoords(e, canvas);
    const hit    = hitTest(coords.cx, coords.cy, sim.families);
    if (hit) {
      hoveredFamilyIdxRef.current = hit.family.fi;
      const ctx = canvas.getContext("2d");
      drawSimulation(ctx, sim, canvas.width, canvas.height, false, hit.family.fi);
      setSelectedNode({ member: hit.member, family: hit.family, x: coords.px, y: coords.py, canvasWidth: coords.canvasWidth });
    } else {
      setSelectedNode(null);
    }
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────
  const s = stats || {};
  const counts = s.counts || [0, 0, 0, 0, 0];

  const sliderGroups = [
    {
      group: "Environment",
      items: [
        { key: "threat",    label: "Threat level",  min: 1,  max: 10,  suffix: "",
          hint: v => v <= 3 ? "Low urgency — alerts spread slowly"
                 : v <= 6  ? "Moderate threat — some urgency to act"
                            : "High threat — alerts spread rapidly" },
        { key: "threatRiseRate", label: "Threat rise rate", min: 0, max: 20, suffix: "",
          hint: v => v === 0 ? "Static — threat stays fixed for the whole run"
                 : v <= 8   ? `Slow escalation — +1 level every ${Math.round(100/v)} ticks`
                 : v <= 14  ? `Moderate escalation — +1 level every ${Math.round(100/v)} ticks`
                            : `Fast escalation — threat surges rapidly as time passes` },
        { key: "infoClar",  label: "Info clarity",  min: 1,  max: 10,  suffix: "",
          hint: v => v <= 3 ? "Poor clarity — many confirmations needed before families act"
                 : v <= 6  ? "Moderate clarity — standard confirmation requirements"
                            : "High clarity — families act quickly on first alert" },
        { key: "humanitarianAccess", label: "Humanitarian access", min: 0, max: 100, suffix: "%",
          hint: v => v === 0 ? "No humanitarian actor — official broadcast and social channels only"
                 : v <= 40  ? "Partial access — aid actor reaches some households with higher reliability"
                 : v <= 70  ? "Good access — humanitarian actor active across most of the community"
                            : "Full access — humanitarian actor reaches all households (unobstructed)" },
      ],
    },
    {
      group: "Armed conflict",
      items: [
        { key: "checkpointDelay", label: "Checkpoint delay", min: 0, max: 15, suffix: "t",
          hint: v => v === 0 ? "No checkpoints — members evacuate without impediment"
                 : v <= 5   ? `Light screening — up to ${v}t delay for checked members`
                            : `Heavy screening — up to ${v}t delay, significant obstruction` },
        { key: "misinfoRate", label: "Misinformation", min: 0, max: 100, suffix: "%",
          hint: v => v === 0 ? "No misinformation — all confirmations are genuine"
                 : v <= 30  ? "Low misinformation — some false confirmations, may misdirect evacuees"
                 : v <= 60  ? "Moderate misinformation — false information competing with genuine alerts"
                            : "High misinformation — severe misdirection risk" },
        { key: "infraDegradeRate", label: "Infrastructure damage", min: 0, max: 20, suffix: "",
          hint: v => v === 0 ? "No damage — info clarity holds for the full run"
                 : v <= 7   ? "Light damage — clarity degrades slowly"
                            : "Heavy damage — clarity collapses quickly" },
        { key: "coercionRisk", label: "Coercion risk", min: 0, max: 100, suffix: "%",
          hint: v => v === 0 ? "No coercion — all evacuation is voluntary (IHL-compliant)"
                 : v <= 30  ? "Low coercion — some households may be forced to leave prematurely"
                            : "High coercion — forced displacement likely (violation: Art. 17 AP II)" },
      ],
    },
    {
      group: "Population",
      items: [
        { key: "avgFamilySize", label: "Avg. family size",   min: 1, max: 7,   suffix: "",
          hint: v => v <= 2 ? "Small households — faster to coordinate"
                 : v <= 4  ? "Typical household size"
                            : "Large households — longer to coordinate and depart" },
        { key: "elderPct",      label: "Elder ratio",         min: 0, max: 60,  suffix: "%",
          hint: v => v === 0 ? "No elders in population"
                 : v <= 20  ? "Small elder population — minor delays"
                 : v <= 40  ? "Moderate elders — noticeable prep and mobility impact"
                            : "High elder population — significant delays" },
        { key: "childPct",      label: "Children <5 ratio",   min: 0, max: 50,  suffix: "%",
          hint: v => v === 0 ? "No young children in population"
                 : v <= 20  ? "Small child population — some gathering delays"
                            : "High child population — significant preparation delays" },
        { key: "pregnantPct",   label: "Pregnant women",       min: 0, max: 30,  suffix: "%",
          hint: v => v === 0 ? "No pregnant women — GC IV Art. 16 / AP I Art. 8(a) special category absent"
                 : v <= 10  ? "Small proportion — some milling and mobility delays; priority transport advised"
                            : "Significant proportion — assisted transport and priority corridor access essential (GC IV Art. 16; AP I Arts. 8(a), 70(1), 76)" },
        { key: "unaccompChildPct", label: "Unaccomp. minors",  min: 0, max: 20,  suffix: "%",
          hint: v => v === 0 ? "No unaccompanied minors — all children have family escorts"
                 : v <= 6   ? "Some unaccompanied minors — family reunification delays likely before departure (GC IV Art. 26; AP I Art. 74)"
                            : "High proportion — significant reunification delays; ICRC tracing services required" },
        { key: "nbrInfluence",  label: "Neighbor influence",  min: 0, max: 100, suffix: "%",
          hint: (v, sc) => {
            if (sc === "train") return "Lower relevance in train scenario — passengers are often strangers";
            return v === 0  ? "No social contagion — only official alerts matter"
                 : v <= 40  ? "Low social influence — neighbors rarely trigger others"
                 : v <= 70  ? "Moderate contagion — neighbors noticeably accelerate confirmations"
                            : "High contagion — one family evacuating can cascade through the network";
          }},
      ],
    },
  ];

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", color: "#3d3d3a", maxWidth: 720, margin: "0 auto", padding: "12px 16px" }}>

      {/* Scenario selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {Object.entries(SCENARIOS).map(([key, sc]) => {
          const active = scenario === key;
          return (
            <button
              key={key}
              onClick={() => { setScenario(key); reset(key); }}
              style={{
                flex: 1, padding: "7px 0", fontSize: 12, cursor: "pointer",
                borderRadius: 8, fontWeight: active ? 600 : 400,
                background: active ? "#185FA5" : "#f1efe8",
                color: active ? "#fff" : "#3d3d3a",
                border: active ? "none" : "0.5px solid rgba(0,0,0,0.12)",
              }}
            >
              {sc.icon} {sc.label}
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <button onClick={toggleRun} disabled={finished} style={{ fontSize: 12, padding: "5px 12px", cursor: "pointer", borderRadius: 6, background: "#E6F1FB", color: "#0C447C", border: "0.5px solid #185FA5" }}>
          {running ? "⏸ Pause" : "▶ Run"}
        </button>
        <button onClick={step} disabled={running || finished} style={{ fontSize: 12, padding: "5px 12px", cursor: "pointer", borderRadius: 6 }}>
          Step
        </button>
        <button onClick={reset} style={{ fontSize: 12, padding: "5px 12px", cursor: "pointer", borderRadius: 6 }}>
          Reset
        </button>
        <span style={{ fontSize: 11, color: "#737069" }}>
          Tick <strong style={{ fontWeight: 500 }}>{tick}</strong>
          {finished && <span style={{ marginLeft: 8, color: "#0F6E56" }}>— complete</span>}
        </span>

        {/* Seed — same seed + same parameters reproduces a run exactly */}
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <label htmlFor="sim-seed" style={{ fontSize: 11, color: "#737069" }}>Seed</label>
          <input
            id="sim-seed"
            type="number"
            value={seed}
            disabled={running}
            title="Random seed — record it to replay this exact run"
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setSeed(Number.isNaN(n) ? 0 : n);
            }}
            style={{
              width: 84, fontSize: 11, padding: "3px 5px", borderRadius: 5,
              border: "0.5px solid rgba(0,0,0,0.2)", background: "#fff", color: "#3d3d3a",
            }}
          />
          <button
            onClick={() => setSeed(Math.floor(Math.random() * 1e9))}
            disabled={running}
            title="Draw a new random seed"
            style={{ fontSize: 11, padding: "3px 7px", cursor: running ? "default" : "pointer", borderRadius: 5 }}
          >
            🎲
          </button>
        </span>
      </div>

      {/* Corridor controls — pedestrian and car only */}
      {scenario !== 'train' && (
        <div style={{ marginBottom: 8, background: "#fff", border: "0.5px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "8px 12px" }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: "#737069", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Exit corridors
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {corridorSettings.map((c, i) => (
              <div key={c.id} style={{
                flex: 1, borderRadius: 7, padding: "6px 8px",
                background: c.open ? "rgba(29,158,117,0.07)" : "rgba(220,38,38,0.06)",
                border: `0.5px solid ${c.open ? "rgba(29,158,117,0.35)" : "rgba(220,38,38,0.35)"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.open ? "#0F6E56" : "#A32D2D" }}>
                    {c.label}
                  </span>
                  <button
                    onClick={() => setCorridorSettings(prev => prev.map((s, j) => j === i ? { ...s, open: !s.open } : s))}
                    style={{
                      fontSize: 9, padding: "2px 6px", borderRadius: 3, cursor: "pointer", border: "none",
                      background: c.open ? "#1D9E75" : "#DC2626", color: "#fff", fontWeight: 600,
                    }}
                  >
                    {c.open ? "Open" : "Closed"}
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 9, color: "#737069", whiteSpace: "nowrap" }}>closes t:</span>
                  <input
                    type="number" min="1" placeholder="—"
                    value={c.closesAtTick}
                    disabled={!c.open}
                    onChange={e => setCorridorSettings(prev => prev.map((s, j) => j === i ? { ...s, closesAtTick: e.target.value } : s))}
                    style={{
                      width: "100%", fontSize: 9, padding: "2px 4px",
                      borderRadius: 3, border: "0.5px solid rgba(0,0,0,0.18)",
                      opacity: c.open ? 1 : 0.4,
                    }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: "#737069", whiteSpace: "nowrap" }}>opens t:</span>
                  <input
                    type="number" min="1" placeholder="—"
                    value={c.opensAtTick ?? ''}
                    onChange={e => setCorridorSettings(prev => prev.map((s, j) => j === i ? { ...s, opensAtTick: e.target.value } : s))}
                    style={{ width: "100%", fontSize: 9, padding: "2px 4px", borderRadius: 3, border: "0.5px solid rgba(0,0,0,0.18)" }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 9, color: "#999895", marginTop: 6 }}>
            Set "closes t:" to close a corridor mid-run. Leave blank to keep it open for the full simulation.
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, fontSize: 10, color: "#737069" }}>
        {[
          { col: "#888780", label: "Unaware",     shape: "circle"  },
          { col: "#378ADD", label: "Seeking info", shape: "circle"  },
          { col: "#EF9F27", label: "Milling",      shape: "circle"  },
          { col: "#E24B4A", label: "Evacuating",   shape: "circle"  },
          { col: "#1D9E75", label: "Evacuated",    shape: "circle"  },
          { col: "#7F77DD", label: "Elder",        shape: "circle"  },
          { col: "#D4537E", label: "Child <5",     shape: "diamond" },
        ].map(({ col, label, shape }) => (
          <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <span style={{
              width: 9, height: 9, flexShrink: 0,
              borderRadius: shape === "circle" ? "50%" : 0,
              transform: shape === "diamond" ? "rotate(45deg)" : "none",
              background: col, display: "inline-block",
            }} />
            {label}
          </span>
        ))}
      </div>

      {/* Canvas */}
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleCanvasClick}
          style={{ width: "100%", borderRadius: 10, border: "0.5px solid rgba(0,0,0,0.1)", display: "block" }}
        />
        {selectedNode && (() => {
          const { member: m, family: f, x, y, canvasWidth } = selectedNode;
          const t          = simRef.current?.tick ?? 0;
          const ageGroup   = m.isElder ? "Elder" : m.isChild ? "Child <5" : "Adult";
          const phaseStart = m.status === STATUS.SEEKING ? m.seekStart
                           : m.status === STATUS.MILLING  ? m.millingStart
                           : m.status === STATUS.EVAC     ? m.evacStart : null;
          const phaseTicks = phaseStart !== null ? t - phaseStart : null;
          const flipLeft   = x + 14 + 160 > canvasWidth;
          return (
            <div style={{
              position: "absolute",
              left:  flipLeft ? Math.max(4, x - 164) : x + 14,
              top:   Math.max(4, y - 56),
              background: "#fff",
              border: "0.5px solid rgba(0,0,0,0.14)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 11,
              lineHeight: 1.75,
              pointerEvents: "none",
              boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
              minWidth: 152,
              zIndex: 10,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 1 }}>
                {m.name} <span style={{ color: f.col, fontWeight: 400 }}>· {f.name}</span>
              </div>
              <div style={{ color: "#737069" }}>{ageGroup}</div>
              <div>
                Status: <span style={{ color: STATUS_TEXT_COLOR[m.status], fontWeight: 500 }}>
                  {STATUS_LABEL[m.status]}
                </span>
              </div>
              {m.status === STATUS.SEEKING && (
                <div>Confirmations: {m.confirmCount}/{m.confirmNeeded}</div>
              )}
              {phaseTicks !== null && (
                <div style={{ color: "#737069" }}>
                  In phase: {phaseTicks} tick{phaseTicks !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Stats row 1 — phase counts */}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        {[
          { label: "Unaware",    val: counts[0], col: "#737069" },
          { label: "Seeking",    val: counts[1], col: "#185FA5" },
          { label: "Milling",    val: counts[2], col: "#BA7517" },
          { label: "Evacuating", val: counts[3], col: "#A32D2D" },
          { label: "Evacuated",  val: counts[4], col: "#0F6E56" },
        ].map(({ label, val, col }) => (
          <div key={label} style={{ background: "#f1efe8", borderRadius: 6, padding: "5px 8px", fontSize: 11, flex: 1, textAlign: "center" }}>
            <span style={{ fontSize: 9, color: "#737069", display: "block" }}>{label}</span>
            <strong style={{ fontSize: 15, fontWeight: 500, color: col }}>{val ?? "—"}</strong>
          </div>
        ))}
      </div>
      {/* Stats row 2 — demographic counts */}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        {[
          { label: "Children <5", val: s.children, col: "#993556" },
          { label: "Elders",      val: s.elders,   col: "#534AB7" },
          { label: "Pregnant",    val: s.pregnant, col: "#0E7490" },
          { label: "Unaccomp.",   val: s.unaccomp, col: "#C2410C" },
        ].map(({ label, val, col }) => (
          <div key={label} style={{ background: "#f1efe8", borderRadius: 6, padding: "5px 8px", fontSize: 11, flex: 1, textAlign: "center" }}>
            <span style={{ fontSize: 9, color: "#737069", display: "block" }}>{label}</span>
            <strong style={{ fontSize: 15, fontWeight: 500, color: col }}>{val ?? "—"}</strong>
          </div>
        ))}
      </div>
      {/* Stats row 3 — % Clear prominent tile */}
      <div style={{ marginTop: 6, background: "#f1efe8", borderRadius: 6, padding: "10px 14px", textAlign: "center" }}>
        <span style={{ fontSize: 9, color: "#737069", display: "block", letterSpacing: "0.04em", textTransform: "uppercase" }}>% Clear</span>
        <strong style={{ fontSize: 28, fontWeight: 500, color: "#0F6E56", lineHeight: 1.2 }}>
          {(s.pctClear ?? "—") + (stats ? "%" : "")}
        </strong>
      </div>

      {/* Event log */}
      <div style={{ maxHeight: 120, overflowY: "auto", fontSize: 11, lineHeight: 1.75, color: "#737069", background: "#f1efe8", borderRadius: 6, padding: "7px 10px", marginTop: 8 }}>
        {logs.map((l, i) => <div key={i}>{l}</div>)}
      </div>

      {/* End-of-run summary */}
      {finished && runSummary && (() => {
        const prev       = runHistory[1] ?? null;
        const pinnedRun  = pinnedRunId ? runHistory.find(r => r.id === pinnedRunId) : null;
        const maxTotal   = Math.max(...runSummary.familyData.map(f => f.total), 1);
        const diffVsPrev = prev ? runSummary.totalTicks - prev.totalTicks : null;
        const diffVsPin  = pinnedRun && pinnedRun.id !== runSummary.id
          ? runSummary.totalTicks - pinnedRun.totalTicks : null;
        const diffColor  = d => d < 0 ? "#0F6E56" : d > 0 ? "#A32D2D" : "#737069";
        const diffText   = (d, label) =>
          `${Math.abs(d)} tick${Math.abs(d) !== 1 ? "s" : ""} ${d < 0 ? "faster" : d > 0 ? "slower" : "same"} than ${label}`;

        return (
          <div style={{ marginTop: 10, background: "#f1efe8", borderRadius: 10, padding: "12px 14px" }}>
            {/* Header */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                Complete — {runSummary.totalTicks} ticks
              </span>
              {runSummary.seed != null && (
                <span style={{ fontSize: 11, color: "#737069" }} title="Re-enter this seed with the same settings to reproduce this run">
                  seed {runSummary.seed}
                </span>
              )}
              {diffVsPrev !== null && (
                <span style={{ fontSize: 11, color: diffColor(diffVsPrev) }}>
                  {diffText(diffVsPrev, "previous")}
                </span>
              )}
              {diffVsPin !== null && (
                <span style={{ fontSize: 11, color: diffColor(diffVsPin) }}>
                  📌 {diffText(diffVsPin, "pinned")}
                </span>
              )}
            </div>

            {/* Phase averages + slowest family */}
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {[
                { label: "Avg. seeking", val: runSummary.avgSeeking, col: "#185FA5" },
                { label: "Avg. milling", val: runSummary.avgMilling, col: "#BA7517" },
                { label: "Avg. evac",    val: runSummary.avgEvac,    col: "#A32D2D" },
              ].map(({ label, val, col }) => (
                <div key={label} style={{ flex: 1, background: "#fff", borderRadius: 6, padding: "5px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#737069" }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: col }}>{val}t</div>
                </div>
              ))}
              <div style={{ flex: 1.6, background: "#fff", borderRadius: 6, padding: "5px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#737069" }}>Slowest family</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{runSummary.slowestFamily}</div>
                <div style={{ fontSize: 9, color: "#737069" }}>{runSummary.bottleneck}</div>
              </div>
            </div>

            {/* Family timeline bar chart */}
            <div style={{ fontSize: 9, color: "#737069", marginBottom: 5 }}>
              Family timelines — avg. ticks per phase
            </div>
            {runSummary.familyData.map(fd => (
              <div key={fd.name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: fd.col, minWidth: 52 }}>{fd.name}</div>
                <div style={{ flex: 1, display: "flex", height: 14, borderRadius: 3, overflow: "hidden", background: "rgba(0,0,0,0.06)" }}>
                  <div style={{ width: `${(fd.seek / maxTotal) * 100}%`, background: "#378ADD" }} title={`Seeking: ${fd.seek}t`} />
                  <div style={{ width: `${(fd.mill / maxTotal) * 100}%`, background: "#EF9F27" }} title={`Milling: ${fd.mill}t`} />
                  <div style={{ width: `${(fd.evac / maxTotal) * 100}%`, background: "#E24B4A" }} title={`Evac: ${fd.evac}t`} />
                </div>
                <div style={{ fontSize: 9, color: "#737069", minWidth: 28, textAlign: "right" }}>
                  {fd.total}t
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 5, fontSize: 9, color: "#737069" }}>
              {[["#378ADD","Seeking"],["#EF9F27","Milling"],["#E24B4A","Evac"]].map(([col, label]) => (
                <span key={label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{ width: 8, height: 8, background: col, display: "inline-block", borderRadius: 1 }} />
                  {label}
                </span>
              ))}
            </div>

            {/* Neighbour influence summary */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "0.5px solid rgba(0,0,0,0.08)" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#737069", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                Neighbour Influence
              </div>

              {/* Top stats row */}
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <div style={{ flex: 1, background: "#fff", borderRadius: 6, padding: "5px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#737069" }}>Social events fired</div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: "#D97706" }}>{runSummary.socialEvents}</div>
                </div>
                <div style={{ flex: 1, background: "#fff", borderRadius: 6, padding: "5px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#737069" }}>Socially confirmed</div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: "#D97706" }}>{runSummary.sociallyConfirmed}</div>
                </div>
                {runSummary.humanitarianConfirmed > 0 && (
                  <div style={{ flex: 1, background: "#fff", borderRadius: 6, padding: "5px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "#737069" }}>Aid confirmed</div>
                    <div style={{ fontSize: 16, fontWeight: 500, color: "#1D9E75" }}>{runSummary.humanitarianConfirmed}</div>
                  </div>
                )}
                <div style={{ flex: 1, background: "#fff", borderRadius: 6, padding: "5px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#737069" }}>Officially confirmed</div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: "#185FA5" }}>{runSummary.officiallyConfirmed}</div>
                </div>
                <div style={{ flex: 1.4, background: "#fff", borderRadius: 6, padding: "5px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#737069" }}>Dominant channel</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: runSummary.dominantChannel === 'social' ? "#D97706" : runSummary.dominantChannel === 'humanitarian' ? "#1D9E75" : runSummary.dominantChannel === 'misinfo' ? "#DC2626" : "#185FA5" }}>
                    {runSummary.dominantChannel === 'misinfo' ? '🔴 Misinfo' : runSummary.dominantChannel === 'social' ? '🟡 Social' : runSummary.dominantChannel === 'humanitarian' ? '🟢 Humanitarian' : '🔵 Official'}
                  </div>
                </div>
              </div>

              {/* Three-channel split bar */}
              {(() => {
                const total = runSummary.sociallyConfirmed + runSummary.officiallyConfirmed + runSummary.humanitarianConfirmed + (runSummary.misinfoConfirmed ?? 0);
                if (total === 0) return null;
                const socialPct   = (runSummary.sociallyConfirmed      / total) * 100;
                const humPct      = (runSummary.humanitarianConfirmed  / total) * 100;
                const officialPct = (runSummary.officiallyConfirmed    / total) * 100;
                const misinfoPct  = ((runSummary.misinfoConfirmed ?? 0) / total) * 100;
                return (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 9, color: "#737069", marginBottom: 4 }}>
                      Channel split — final confirmation source per member
                    </div>
                    <div style={{ display: "flex", height: 14, borderRadius: 4, overflow: "hidden", background: "rgba(0,0,0,0.05)" }}>
                      <div style={{ width: `${officialPct}%`, background: "#378ADD" }} title={`Official: ${runSummary.officiallyConfirmed}`} />
                      <div style={{ width: `${humPct}%`,      background: "#1D9E75" }} title={`Aid: ${runSummary.humanitarianConfirmed}`} />
                      <div style={{ width: `${socialPct}%`,   background: "#D97706" }} title={`Social: ${runSummary.sociallyConfirmed}`} />
                      <div style={{ width: `${misinfoPct}%`,  background: "#DC2626" }} title={`Misinfo: ${runSummary.misinfoConfirmed}`} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#737069", marginTop: 3 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <span style={{ width: 7, height: 7, background: "#378ADD", display: "inline-block", borderRadius: 1 }} />
                        Official {Math.round(officialPct)}%
                      </span>
                      {humPct > 0 && (
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          <span style={{ width: 7, height: 7, background: "#1D9E75", display: "inline-block", borderRadius: 1 }} />
                          Aid {Math.round(humPct)}%
                        </span>
                      )}
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        Social {Math.round(socialPct)}%
                        <span style={{ width: 7, height: 7, background: "#D97706", display: "inline-block", borderRadius: 1 }} />
                      </span>
                      {misinfoPct > 0 && (
                        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                          Misinfo {Math.round(misinfoPct)}%
                          <span style={{ width: 7, height: 7, background: "#DC2626", display: "inline-block", borderRadius: 1 }} />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Per-family breakdown */}
              <div style={{ fontSize: 9, color: "#737069", marginBottom: 5 }}>
                Per-family channel breakdown
              </div>
              {runSummary.neighbourFamilyData.map(fd => {
                const total = fd.social + fd.official + (fd.humanitarian ?? 0) + (fd.misinfo ?? 0);
                if (total === 0) return null;
                return (
                  <div key={fd.name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 500, color: fd.col, minWidth: 52 }}>{fd.name}</div>
                    <div style={{ flex: 1, display: "flex", height: 10, borderRadius: 3, overflow: "hidden", background: "rgba(0,0,0,0.05)" }}>
                      <div style={{ width: `${(fd.official / total) * 100}%`, background: "#378ADD" }} title={`Official: ${fd.official}`} />
                      <div style={{ width: `${((fd.humanitarian ?? 0) / total) * 100}%`, background: "#1D9E75" }} title={`Aid: ${fd.humanitarian ?? 0}`} />
                      <div style={{ width: `${(fd.social / total) * 100}%`, background: "#D97706" }} title={`Social: ${fd.social}`} />
                      <div style={{ width: `${((fd.misinfo ?? 0) / total) * 100}%`, background: "#DC2626" }} title={`Misinfo: ${fd.misinfo ?? 0}`} />
                    </div>
                    <div style={{ fontSize: 9, color: "#737069", minWidth: 72, textAlign: "right" }}>
                      {fd.official}off{(fd.humanitarian ?? 0) > 0 ? ` · ${fd.humanitarian}aid` : ""} · {fd.social}soc{(fd.misinfo ?? 0) > 0 ? ` · ${fd.misinfo}mis` : ""}
                    </div>
                  </div>
                );
              })}

              {/* Channel Trust Metric */}
              {runSummary.params?.humanitarianAccess > 0 && (
                <div style={{ marginTop: 12, background: "#E6F7F0", borderRadius: 8, padding: "11px 14px", border: "0.5px solid rgba(15,110,86,0.2)" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#0F6E56", marginBottom: 5 }}>
                    Channel Trust Metric
                  </div>
                  {(() => {
                    const hum  = runSummary.humanitarianConfirmed;
                    const off  = runSummary.officiallyConfirmed;
                    const inst = hum + off;
                    const humPct = inst > 0 ? Math.round((hum / inst) * 100) : 0;
                    const govPct = 100 - humPct;
                    return (
                      <div>
                        <p style={{ fontSize: 11, lineHeight: 1.7, color: "#1D5C4A", margin: "0 0 8px 0" }}>
                          {hum === 0
                            ? `Humanitarian actor reached households but drove no final confirmations — the official broadcast arrived first or access was insufficient to close confirmations.`
                            : hum >= off
                              ? `Humanitarian actor drove ${humPct}% of institutional confirmations — high field access and community trust.`
                              : `Government broadcast drove ${govPct}% of institutional confirmations — humanitarian actor influence below official reach. ${hum > 0 ? `Aid reached ${hum} member${hum !== 1 ? "s" : ""} but access constraints limited its impact.` : ""}`}
                        </p>
                        {inst > 0 && (
                          <>
                            <div style={{ display: "flex", height: 10, borderRadius: 3, overflow: "hidden", background: "rgba(0,0,0,0.07)" }}>
                              <div style={{ width: `${govPct}%`, background: "#378ADD" }} title={`Government: ${off}`} />
                              <div style={{ width: `${humPct}%`, background: "#1D9E75" }} title={`Humanitarian: ${hum}`} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#5a5a55", marginTop: 3 }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                <span style={{ width: 7, height: 7, background: "#378ADD", display: "inline-block", borderRadius: 1 }} />
                                Govt {govPct}%
                              </span>
                              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                Aid {humPct}%
                                <span style={{ width: 7, height: 7, background: "#1D9E75", display: "inline-block", borderRadius: 1 }} />
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Conflict metrics */}
            {(runSummary.coercedCount > 0 || runSummary.checkpointedCount > 0 || runSummary.misinfoConfirmed > 0) && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "0.5px solid rgba(0,0,0,0.08)" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#737069", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  Conflict metrics
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {runSummary.coercedCount > 0 && (
                    <div style={{ flex: 1, minWidth: 80, background: "#FEE2E2", borderRadius: 6, padding: "5px 8px", textAlign: "center", border: "0.5px solid rgba(220,38,38,0.2)" }}>
                      <div style={{ fontSize: 9, color: "#991B1B" }}>Forced displacement</div>
                      <div style={{ fontSize: 16, fontWeight: 500, color: "#DC2626" }}>{runSummary.coercedCount}</div>
                      <div style={{ fontSize: 8, color: "#991B1B" }}>Art. 17 AP II violation</div>
                    </div>
                  )}
                  {runSummary.checkpointedCount > 0 && (
                    <div style={{ flex: 1, minWidth: 80, background: "#FEF3E2", borderRadius: 6, padding: "5px 8px", textAlign: "center", border: "0.5px solid rgba(217,119,6,0.2)" }}>
                      <div style={{ fontSize: 9, color: "#92400E" }}>Checkpoint delays</div>
                      <div style={{ fontSize: 16, fontWeight: 500, color: "#D97706" }}>{runSummary.checkpointedCount}</div>
                      <div style={{ fontSize: 8, color: "#92400E" }}>members screened</div>
                    </div>
                  )}
                  {runSummary.misinfoConfirmed > 0 && (
                    <div style={{ flex: 1, minWidth: 80, background: "#FEE2E2", borderRadius: 6, padding: "5px 8px", textAlign: "center", border: "0.5px solid rgba(220,38,38,0.2)" }}>
                      <div style={{ fontSize: 9, color: "#991B1B" }}>Misinfo-confirmed</div>
                      <div style={{ fontSize: 16, fontWeight: 500, color: "#DC2626" }}>{runSummary.misinfoConfirmed}</div>
                      <div style={{ fontSize: 8, color: "#991B1B" }}>may be misdirected</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Communications recommendations */}
            {(() => {
              const advice = generateCommsAdvice(runSummary);
              if (!advice.length) return null;
              return (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "0.5px solid rgba(0,0,0,0.08)" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#737069", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
                    Communications Recommendations
                  </div>
                  <div style={{ fontSize: 10, color: "#999895", marginBottom: 10 }}>
                    Practical advice for humanitarian communicators, based on this run's outcomes.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {advice.map((a, i) => (
                      <div key={i} style={{ background: a.bg, borderRadius: 8, padding: "10px 12px", borderLeft: `3px solid ${a.col}` }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 8, fontWeight: 700, color: a.col, textTransform: "uppercase", letterSpacing: "0.05em", background: "rgba(0,0,0,0.07)", borderRadius: 3, padding: "1px 5px", flexShrink: 0 }}>
                            {a.tag}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#0f1e36", lineHeight: 1.3 }}>{a.title}</span>
                        </div>
                        <div style={{ fontSize: 11, lineHeight: 1.72, color: "#5a5a55" }}>{a.body}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Run history */}
      {runHistory.length > 0 && (
        <div style={{ marginTop: 10, background: "#fff", border: "0.5px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 8 }}>Run history</div>
          {runHistory.map((run, i) => {
            const sc       = SCENARIOS[run.scenario];
            const isPinned = pinnedRunId === run.id;
            const isLatest = i === 0;
            return (
              <div key={run.id} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "5px 8px",
                borderRadius: 6, marginBottom: 4,
                background: isPinned ? "rgba(24,95,165,0.06)" : "transparent",
                border: isPinned ? "0.5px solid rgba(24,95,165,0.2)" : "0.5px solid transparent",
              }}>
                <span style={{ fontSize: 13 }}>{sc?.icon}</span>
                <span style={{ fontSize: 10, color: "#737069", flex: 1 }}>
                  T:{run.params.threat} C:{run.params.infoClar} E:{run.params.elderPct}% N:{run.params.nbrInfluence}%
                </span>
                <span style={{ fontSize: 11, fontWeight: 500, minWidth: 52, textAlign: "right" }}>
                  {run.totalTicks} ticks
                </span>
                {isLatest && (
                  <span style={{ fontSize: 9, color: "#0F6E56", minWidth: 30 }}>latest</span>
                )}
                <button
                  onClick={() => setPinnedRunId(isPinned ? null : run.id)}
                  style={{
                    fontSize: 10, padding: "2px 7px", borderRadius: 4, cursor: "pointer",
                    background: isPinned ? "#185FA5" : "#f1efe8",
                    color: isPinned ? "#fff" : "#737069",
                    border: "0.5px solid rgba(0,0,0,0.12)",
                  }}
                >
                  {isPinned ? "📌 Pinned" : "Pin"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Sliders — collapsible panel at bottom */}
      <div style={{ marginTop: 10 }}>
        <button
          onClick={() => setShowSliders(v => !v)}
          style={{
            width: "100%", padding: "6px 12px", fontSize: 11, cursor: "pointer",
            borderRadius: showSliders ? "8px 8px 0 0" : 8,
            background: "#f1efe8", color: "#737069",
            border: "0.5px solid rgba(0,0,0,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            userSelect: "none",
          }}
        >
          <span>⚙ Parameters</span>
          <span>{showSliders ? "▴" : "▾"}</span>
          {running && !showSliders && (
            <span style={{ marginLeft: 6, color: "#BA7517" }}>· hidden while running</span>
          )}
        </button>
        {showSliders && (
          <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.12)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "12px 14px" }}>
            {running && (
              <div style={{ fontSize: 11, color: "#BA7517", background: "#FEF3E2", borderRadius: 6, padding: "6px 10px", marginBottom: 10 }}>
                ⚠ Simulation is running — changing a parameter will reset it.
              </div>
            )}
            {sliderGroups.map(({ group, items }) => (
              <div key={group} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: "#737069", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  {group}
                </div>
                {items.map(({ key, label, min, max, suffix, hint }) => (
                  <div key={key} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <label style={{ fontSize: 11, color: "#737069", minWidth: 130 }}>{label}</label>
                      <input
                        type="range" min={min} max={max} step={1}
                        value={params[key]}
                        onChange={handleSlider(key)}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: 11, minWidth: 32, textAlign: "right" }}>
                        {params[key]}{suffix}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: "#999895", marginTop: 2, paddingLeft: 138 }}>
                      {hint(params[key], scenario)}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
