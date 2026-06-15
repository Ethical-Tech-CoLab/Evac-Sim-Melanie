# Architecture Plan — Evacuation Simulation

## Overview

An interactive agent-based evacuation model built with React and Vite. Six household clusters receive emergency alerts, seek confirmation, mill (prepare), and evacuate. The simulation visualises how information clarity, social influence, household composition, and evacuation mode interact to determine who leaves — and when.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 (hooks only, no class components) |
| Build tool | Vite 5 |
| Rendering | HTML5 Canvas API (no WebGL, no D3) |
| State management | React `useState` / `useRef` (no Redux or Zustand) |
| Routing | Single-page, manual page state in `App.jsx` |
| Scrollytelling | `IntersectionObserver` API (no external library) |
| GitHub CI | None (static site, no build pipeline configured) |

---

## Directory Structure

```
evacuation-sim/
├── src/
│   ├── main.jsx            Entry point — mounts App into #root
│   ├── App.jsx             Root component: navigation bar + page routing
│   ├── EvacuationSim.jsx   Simulation engine, canvas renderer, and UI
│   ├── AboutPage.jsx       Scrollytelling guide page
│   └── index.css           Minimal global resets only
├── index.html
├── package.json
├── vite.config.js
├── ARCHITECTURE.md         This document
└── UX_SUGGESTIONS.md       Design backlog
```

---

## Component Hierarchy

```
App
├── <nav>                   Sticky nav bar (About & Guide | Simulation)
├── AboutPage               Rendered when page === "about"
│   ├── Hero
│   ├── StickyPhases        Sticky SVG illustration + scrolling text steps
│   │   └── PhaseIllustration   SVG state machine diagram (6 steps)
│   ├── Channels
│   ├── PopulationFactors
│   ├── ScenariosSection
│   ├── HowToUse
│   ├── NeighbourInfluenceGuide
│   ├── TicksGuide
│   └── Research
└── EvacuationSim           Rendered when page === "sim"
    ├── Scenario tabs
    ├── Controls (Run / Step / Reset)
    ├── Legend
    ├── <canvas>            All simulation visuals drawn here
    │   └── Node tooltip    Absolutely positioned div over canvas
    ├── Stats row
    ├── Event log
    ├── End-of-run summary
    │   ├── Phase timelines bar chart
    │   └── Neighbour influence panel
    ├── Run history
    └── Parameters panel    Collapsible, grouped sliders
```

---

## Simulation Engine (`EvacuationSim.jsx`)

The simulation logic is separated into pure, exportable functions. The React component wires them together but contains no simulation logic itself.

### Exported functions

| Function | Purpose |
|---|---|
| `buildSimulation(params)` | Creates a complete fresh sim state object from slider parameters |
| `stepSimulation(sim, W, H)` | Advances the sim one tick in place; returns `{ newLogs, finished }` |
| `drawSimulation(ctx, sim, W, H, darkMode, highlightFamilyIdx)` | Renders the current sim state onto a canvas context |
| `getStats(sim)` | Counts members by status; returns summary numbers for the stats row |
| `computeRunSummary(sim, params)` | Computes per-phase averages, slowest family, and neighbour influence stats at run end |

### Agent state machine

Each household member moves through five statuses in order:

```
UNAWARE ──(alert received)──► SEEKING ──(confirmations met)──► MILLING ──(prep done)──► EVAC ──(travel done)──► DONE
   0               1                  2                3              4
```

Status is stored as an integer (`STATUS` constant object). Transitions are evaluated probabilistically each tick based on threat level, information clarity, and neighbour activity.

### Simulation state object

`buildSimulation` returns and `stepSimulation` mutates the following structure:

```javascript
{
  families: [
    {
      name, fi, col,
      elderCount, childCount,
      members: [
        {
          x, y,           // current canvas position
          ox, oy,         // original position (for reset)
          tx, ty,         // evacuation target position
          isHub, isElder, isChild,
          status,         // 0–4
          seekStart, millingStart, evacStart, doneAt,   // tick timestamps
          confirmNeeded, confirmCount,
          millingTicks, evacTicks,
          lastConfirmSource,   // 'official' | 'social'
          confirmedBySocial,   // boolean, set at SEEKING→MILLING
        }
      ]
    }
  ],
  neighborEdges: [{ a: Family, b: Family }],
  infoNode: { x, y, reliability, clarity },

  // Simulation parameters (carried for reference)
  threat, infoClar, nbrInfluence, scenario,

  // Runtime state
  tick,
  started,
  socialInfluenceEvents,   // cumulative counter

  // Transient visual arrays (expire each tick)
  activeArcs: [{ x1, y1, x2, y2, born, col, social?, cascade? }],
  ripples:    [{ born, clarity }],
  flashes:    [{ x, y, col, born }],
  dashOffset,              // increments each tick for edge animation
}
```

---

## Information Flow Model

Two independent channels can deliver confirmations to a seeking member:

```
                    ┌─────────────┐
                    │  Info node  │  (official broadcast)
                    │  (hexagon)  │
                    └──────┬──────┘
                 blue arc  │  probability: f(infoClar, reliability)
                           ▼
                    [ Member ]  ← confirmCount++, lastConfirmSource = 'official'

  ┌──────────────┐
  │ Active family│  (status === MILLING or EVAC)
  │     hub      │
  └──────┬───────┘
   amber arc  │  probability: nbrInfluence (if neighbor edge exists)
              ▼
       [ Member ]  ← confirmCount++, lastConfirmSource = 'social'
```

When `confirmCount >= confirmNeeded`:
- Member transitions to MILLING
- `confirmedBySocial` is stamped based on `lastConfirmSource`
- A flash is emitted (blue = official, amber = social)
- If social: a cascade arc is pushed to `activeArcs`

---

## Canvas Rendering Pipeline

`drawSimulation` renders layers in this strict order (painter's algorithm):

```
1.  Background fill + grid
2.  Saturation gauge bar       (top 5px: blue=reached, green=evacuated)
3.  Scenario background        (roads / rail / footpaths — very low opacity)
4.  Neighbour edges            (dashed; animated dash offset when active)
5.  Family bonds               (hub → members)
6.  Information arcs           (straight=official, curved bezier=social)
7.  Broadcast ripples          (expanding rings from info hexagon)
8.  Info node hexagon
9.  Member nodes:
      a. Persistent reached halo   (thin ring if seekStart !== null)
      b. Confirmation progress ring (always visible; full when highlighted)
      c. Milling glow
      d. Node shape (circle / diamond for children)
      e. Evacuation direction arrow
      f. Labels (hub name always; detail labels on hover only)
10. Per-family progress bars
11. Confirmation-source flashes (expanding rings — blue or amber)
```

All dimming (when a family is hovered) is achieved by setting `ctx.globalAlpha` per family before drawing that family's elements. The highlighted family draws at `alpha = 1`; others at `alpha = 0.10–0.15`.

---

## React State Architecture

```
EvacuationSim component
│
├── Refs (not reactive — avoid unnecessary re-renders)
│   ├── canvasRef           DOM reference to <canvas>
│   ├── simRef              Mutable sim state (mutated in-place by stepSimulation)
│   ├── timerRef            setInterval handle for Run mode
│   ├── hoveredFamilyIdxRef Current hovered family index (used in draw calls)
│   └── paramsRef           Latest params snapshot (read by step callback)
│
└── State (reactive — trigger re-renders)
    ├── running             Boolean — controls interval timer
    ├── tick                Integer — updated each step to trigger re-render
    ├── stats               Aggregated member counts for stats row
    ├── logs                String[] — event log, capped at 80 entries
    ├── finished            Boolean — disables Run button, shows summary
    ├── selectedNode        Clicked node for tooltip { member, family, x, y }
    ├── showSliders         Collapsible parameters panel visibility
    ├── runSummary          End-of-run analytics object (null until finished)
    ├── runHistory          Last 5 runSummary objects (persists across resets)
    ├── pinnedRunId         ID of pinned run for cross-run comparison
    ├── scenario            "pedestrian" | "car" | "train"
    └── params              { threat, infoClar, avgFamilySize, elderPct,
                              childPct, nbrInfluence }
```

### Why `simRef` instead of state?

`stepSimulation` mutates the sim object in place (members' `x`, `y`, `status`, etc.) every 200 ms. Storing this in React state would trigger a full re-render per tick including VDOM diffing — at 5 ticks/second this is unnecessary overhead. Instead, `simRef.current` is mutated directly, and only a lightweight integer (`tick`) is stored in state to signal the render cycle. The canvas is redrawn imperatively via `drawSimulation` rather than through React's render path.

---

## Scenario System

Scenarios are defined as a constant object `SCENARIOS` in `EvacuationSim.jsx`:

```javascript
SCENARIOS = {
  pedestrian: { millingBase, millingElder, millingChild, evacBase, evacElder, evacChild, speeds },
  car:        { ... },
  train:      { ... },
}
```

`buildSimulation` receives the scenario key and uses the corresponding config to set per-member `millingTicks` and `evacTicks`. `stepSimulation` reads `SCENARIOS[sim.scenario].speeds` to determine movement velocity per tick. `drawSimulation` calls `drawScenarioBackground` to render scenario-specific context behind the canvas.

---

## End-of-Run Summary Data Flow

```
stepSimulation detects finished = true
        │
        ▼
computeRunSummary(simRef.current, paramsRef.current)
        │  reads: member timestamps (seekStart, millingStart, evacStart, doneAt)
        │  reads: confirmedBySocial flags
        │  reads: sim.socialInfluenceEvents
        │
        ▼
returns summary object:
  { totalTicks, avgSeeking, avgMilling, avgEvac,
    slowestFamily, bottleneck, familyData,
    socialEvents, sociallyConfirmed, officiallyConfirmed,
    dominantChannel, neighbourFamilyData,
    scenario, params, id }
        │
        ├──► setRunSummary(summary)      renders summary panel
        └──► setRunHistory(prev => [summary, ...prev].slice(0, 5))
                                         renders run history + enables pinning
```

---

## AboutPage Scrollytelling Architecture

The guide uses `IntersectionObserver` rather than a scroll library:

```
useFadeIn hook
  └── IntersectionObserver on element ref
      └── sets visible = true when threshold crossed (one-way; never un-triggers)
          └── CSS transition: opacity 0→1, translateY 22px→0

StickyPhases component
  ├── activeStep state (0–5)
  ├── stepRefs array (one ref per text block)
  ├── IntersectionObserver on each ref
  │   rootMargin: "-30% 0px -50% 0px"   (triggers at centre of viewport)
  │   └── setActiveStep(i) on intersection
  ├── Left column: position:sticky, top:15vh
  │   └── PhaseIllustration SVG (re-renders on activeStep change)
  └── Right column: 6 text blocks, each minHeight:68vh
```

`PhaseIllustration` is a pure SVG component — it receives `step` as a prop and derives all visual state from it. Node colours, arc visibility, and the caption label are all computed from the step index. No animation library is used; SVG element transitions rely on CSS `transition` on `fill` and `stroke`.

---

## Key Design Decisions

**Canvas over SVG for the simulation:** The simulation redraws the entire scene every tick. SVG with 30–60 elements and React reconciliation at 5 fps would work, but imperative canvas drawing is simpler and faster, and avoids binding React's lifecycle to a tight animation loop.

**Mutation in place:** `stepSimulation` mutates the sim object rather than returning a new one. This avoids allocating a new object tree every 200 ms and simplifies the draw call (which always reads from `simRef.current`).

**No router:** The app has two pages. A hash router or React Router would add dependency weight for a single boolean. `useState("about")` in `App.jsx` is sufficient.

**No CSS framework:** All styling is inline `style` props. The component tree is small and co-located; a CSS file would add indirection without benefit at this scale.

**Abstract time (ticks):** Simulation timing is not calibrated to real-world minutes. Using an abstract tick unit makes it honest that the model shows relative dynamics rather than operational predictions.

---

## Extending the Project

| To add… | Where to change |
|---|---|
| A new scenario | Add entry to `SCENARIOS` constant; `buildSimulation` and `stepSimulation` pick it up automatically |
| A new slider | Add to `sliderGroups` array in `EvacuationSim`; add corresponding key to `params` state |
| A new summary metric | Compute in `computeRunSummary`; render in the summary JSX block |
| A new canvas visual | Add a drawing call inside `drawSimulation` at the appropriate layer position |
| A new guide section | Write a new function component in `AboutPage.jsx`; add it to the render order in `AboutPage` default export |
| Calibrated timing | Replace `irnd(...sc.millingBase)` ranges in `buildSimulation` with values derived from empirical data |
