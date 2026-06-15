# Blocked Corridor Simulation — Design Suggestions

*Suggestions for implementing blocked corridor mechanics in the Pedestrian and Car evacuation scenarios.*

---

## Background

The current simulation evacuates all members radially outward from their position toward the nearest canvas edge. There is no concept of named routes, exit gates, or blocked paths. Every point on the canvas boundary is equally accessible.

Humanitarian evacuations in armed conflict are defined by the opposite condition: movement is funnelled through a small number of negotiated corridors, some of which may be closed, congested, or actively dangerous. Blocked corridors are among the most consequential operational factors in conflict displacement — and the one most directly regulated by IHL (customary IHL Rule 99; Art. 17 AP II).

Adding blocked corridor mechanics to the Pedestrian and Car scenarios would make the simulation substantially more relevant to humanitarian planning and IHL training.

---

## Core Concept

### What is a corridor in this simulation?

A corridor is a named exit gate at a specific point on the canvas edge. Families would evacuate toward their nearest **open** gate rather than toward the canvas boundary in general. A blocked corridor means families must reroute to the next available gate — at a cost in time and, for vulnerable members, in safety.

Replace the current radial evacuation logic:
```
// Current: evacuate radially outward from canvas centre
const ang = Math.atan2(mem.y - canvasH / 2, mem.x - canvasW / 2);
mem.tx = mem.x + Math.cos(ang) * 300;
mem.ty = mem.y + Math.sin(ang) * 300;
```

With corridor-aware routing:
```
// Proposed: evacuate toward nearest open corridor gate
const openCorridors = sim.corridors.filter(c => c.open);
const nearest = openCorridors.reduce((best, c) =>
  Math.hypot(mem.x - c.x, mem.y - c.y) < Math.hypot(mem.x - best.x, mem.y - best.y) ? c : best
);
mem.tx = nearest.x;
mem.ty = nearest.y;
mem.corridorId = nearest.id;
```

---

## Design Decisions

### 1. Number and placement of corridors

**Recommended: 4 fixed gates** positioned at the midpoint of each canvas edge (North, South, East, West). This is the simplest configuration that creates meaningful route choices and visible bottlenecks.

```
         [N — Corridor A]
              ▲
              │
[W — Corridor D] ◄──── canvas ────► [E — Corridor B]
              │
              ▼
         [S — Corridor C]
```

Each gate is represented visually as a small arch or opening in the canvas border, coloured green (open) or red (blocked). Labels are displayed alongside each gate.

An extended version could allow the user to place gates manually by clicking the canvas edge, supporting irregular or scenario-specific corridor configurations. This adds significant UI complexity and is best treated as a follow-on feature.

---

### 2. Static vs dynamic blocking

**Static blocking**
The user sets which corridors are open or closed before starting the simulation. Toggle buttons for each corridor are shown in the UI. This is the simplest implementation and is appropriate for exploring fixed questions such as "what happens if the northern route is cut off?"

**Dynamic blocking (recommended addition)**
Corridors can open or close mid-run on a configurable timer. Each corridor has an optional "closes at tick N" value. When that tick is reached during a run, the corridor closes, any families in transit reroute, and a visual alert fires on the canvas.

This mechanic is especially valuable for humanitarian training because it models:
- Ceasefire windows expiring before all vulnerable households can complete evacuation
- Road closures due to military advance
- Checkpoint shutdowns in response to security incidents

Families that have not yet begun milling when a corridor closes may find themselves unable to reach any exit — directly illustrating the humanitarian consequence of milling delays for elders and households with young children.

**Suggested UI for dynamic blocking:**
A small "closes at t:" field next to each corridor toggle, left blank for corridors that stay open/closed for the full run.

---

### 3. Congestion and capacity

When multiple families are rerouted toward a single open corridor, a queue can form. Two implementation approaches:

**Simple (no capacity limit)**
All families route toward the same open gate with no additional penalty. The bottleneck is visible spatially on the canvas but does not add extra ticks.

**Capacity-limited (recommended)**
Each corridor has a throughput parameter: the maximum number of members that can pass through per tick. When more than that number are simultaneously evacuating through the same gate, the excess members pause in place and wait — adding a per-member delay proportional to the queue depth. This models checkpoint processing speed, road width, and convoy management.

A single "Corridor capacity" slider (members per tick per gate) would control this globally. Default value of 0 disables capacity limiting (simple mode).

---

### 4. Stuck members

If **all corridors are blocked**, members in EVAC status have nowhere to go. The simulation should detect this state and visually mark affected members as "trapped" — a distinct colour or pulsing indicator — rather than leaving them in motion toward a closed gate. A log entry would record when each household became trapped.

This directly models the consequence of siege — a war crime under IHL — making the legal stakes operationally visible.

---

## Pedestrian vs Car Differences

The blocked corridor mechanic has asymmetric consequences across scenarios, which is itself a research finding.

| Factor | Pedestrian | Car |
|---|---|---|
| **Rerouting cost** | High — walking to a distant open gate adds significant ticks | Low — driving around is fast; distance matters much less |
| **Elder/child impact on rerouting** | Severe — a longer route may exceed the safe window for slow members | Mild — vehicle compensates for the extra distance |
| **Congestion sensitivity** | High — pedestrian queues build quickly and are hard to clear | Moderate — cars queue but clear faster |
| **Corridor visual** | Footpath gap with barrier marker | Road segment with checkpoint/barrier marker |
| **Train scenario** | Not applicable — train uses a fixed rail line and station | Not applicable | 

This asymmetry is important: blocking a corridor in the Pedestrian scenario may trap elders and households with young children who cannot reach a distant alternative in time, while the same blockage in the Car scenario causes only minor delay. Comparing runs across these two scenarios under identical corridor configurations would make the mobility-equity dimension of humanitarian evacuation planning immediately legible.

---

## Rerouting Behaviour

When a corridor closes mid-run, members currently evacuating toward it should:

1. **Detect** the closure (their target `corridorId` is now blocked)
2. **Recalculate** their target to the nearest remaining open corridor
3. **Update** `tx`, `ty` to the new gate position
4. **Log** the rerouting event with the tick number and member name
5. **Emit** a brief amber arc from the member toward the new gate, visually showing the reroute

Members who have already passed through a gate (status DONE) are unaffected. Members still in MILLING or SEEKING when a corridor closes continue their current phase — but their eventual evacuation route will be recalculated when they enter EVAC.

---

## Visual Design

### Corridor gate markers

Each gate is drawn on the canvas border as:

- **Open gate**: a small green arch or notch cut into the border, labelled "Corridor A / B / C / D"
- **Blocked gate**: the same notch filled with a red barrier symbol (horizontal lines or an X), label shown in red
- **Closing soon** (within 5 ticks of dynamic close): amber pulsing outline on the gate

### Mid-run closure event

When a corridor closes during a run:
1. The gate marker switches from green to red with a brief flash
2. A red ripple expands outward from the gate across the canvas (similar to the existing broadcast ripple)
3. An event log entry records: `t[N] Corridor [X] closed — [K] families rerouting`

### Queue visualisation

When congestion limiting is active, a small depth counter appears beside the gate label showing how many members are currently queuing: `Corridor A [▶▶▶ 4 queued]`.

### Family rerouting arc

When a family's target corridor closes and they reroute, a dashed amber arc briefly connects the family hub to the new target gate — distinguishing rerouting from normal evacuation arcs.

---

## New Summary Metrics

The end-of-run summary panel should add a **Corridor Summary** section showing:

| Metric | Description |
|---|---|
| Families rerouted | Number of families that had to change their target corridor mid-run |
| Members trapped | Members who reached EVAC status but had no open corridor available |
| Corridor utilisation | How many members exited through each gate (useful for spotting bottlenecks) |
| Avg. rerouting delay | Extra ticks added due to rerouting, averaged across affected members |
| Closed-before-exit | Members who were still milling when their nearest corridor closed |

---

## Recommended Implementation Order

### Phase 1 — Static corridors
1. Add a `corridors` array to sim state with 4 gates (N/S/E/W) and an `open` boolean each
2. Add toggle buttons to the UI (one per corridor, shown before Run is pressed)
3. Update `stepSimulation` MILLING→EVAC transition to route toward nearest open corridor
4. Draw gate markers on the canvas in `drawSimulation`
5. Handle the all-blocked edge case (trapped state)

### Phase 2 — Dynamic blocking
1. Add `closesAtTick` field to each corridor (null = stays open/closed for full run)
2. In `stepSimulation`, check each tick whether any corridor should close
3. On closure: reroute affected EVAC members, emit closure event, add log entry
4. Add "closes at t:" input fields to the UI corridor controls

### Phase 3 — Congestion
1. Add `capacityPerTick` parameter (global slider)
2. Track how many members are passing through each gate each tick
3. Pause excess members in a "queuing" sub-state within EVAC
4. Add queue depth indicator to gate label on canvas

---

## IHL Grounding

| Mechanic | IHL Basis |
|---|---|
| Corridor blocking | Customary IHL Rule 99 — civilians must be allowed to leave conflict areas |
| Dynamic closure (ceasefire window) | Art. 17 AP II — temporary humanitarian pauses for civilian movement |
| Trapped / all corridors blocked | Customary IHL Rule 129B — prohibition on displacing civilians by cutting off escape routes |
| Forced rerouting toward dangerous area | Art. 51(7) AP I — prohibition on using civilian movement as a shield |
| Congestion at single open corridor | Operational planning obligation under Art. 58 AP I (precautionary measures) |

*AP I: 1977 Additional Protocol I | AP II: 1977 Additional Protocol II*
*Customary IHL Rules refer to the ICRC Customary IHL Study (Henckaerts & Doswald-Beck, 2005)*
