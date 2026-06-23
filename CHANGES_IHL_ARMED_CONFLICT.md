# IHL Armed-Conflict & Protected-Population Extensions

*Changes merged to `main` — June 2026*

---

## Overview

This update extends the evacuation simulation with five armed-conflict mechanics grounded in International Humanitarian Law (IHL), two new IHL-protected population categories, updated canvas symbols for every population type, and a restructured stats panel. A new guide section on the About page documents each feature with its IHL legal basis.

---

## 1. Armed-Conflict Simulation Mechanics

### 1.1 Humanitarian Corridor — Time-Limited Access (`opensAtTick`)

Corridors can now be configured to open at a specific tick rather than being open from the start, modelling negotiated humanitarian windows. A corridor with `opensAtTick` set begins closed (`pendingOpen: true`) and automatically opens when the simulation reaches that tick, logging a timestamped event and emitting a visual pulse on the canvas.

**IHL basis:** Customary IHL Rule 99; AP II Art. 17.

### 1.2 Checkpoint Delays (`checkpointDelay`)

A slider (0–15 ticks) adds a random per-member delay when a household enters the evacuation phase, representing document checks, security screening, and processing time at military or police checkpoints. Higher values reflect more burdensome checkpoint regimes.

**IHL basis:** Customary IHL Rule 99 (checkpoints may not disproportionately impede civilian evacuation).

### 1.3 Misinformation Channel (`misinfoRate`)

A slider (0–100 %) injects false confirmation signals into the seeking phase. Members receive spurious confirmations that count toward their `confirmNeeded` threshold but originate from a hostile or unreliable source (`confirmedByChannel: 'misinfo'`), rendered as crimson arcs on the canvas. This models deliberate disinformation about evacuation routes or safe zones.

**IHL basis:** AP I Art. 37 (prohibition on perfidy); AP I Art. 38 (prohibition on misuse of emblems).

### 1.4 Infrastructure Degradation (`infraDegradeRate`)

A slider (0–20) progressively reduces `effectiveInfoClar` each tick, modelling the destruction of telecommunications infrastructure as the conflict intensifies. As clarity falls, the information node's reliability drops and households need more confirmations before acting.

**IHL basis:** AP I Art. 52 (prohibition on attacking civilian objects).

### 1.5 Coercion Risk (`coercionRisk`)

A slider (0–100 %) gives unaware households a per-tick chance of being forced into evacuation before completing the seeking phase (`confirmedByChannel: 'coerced'`). Coerced households skip normal confirmation logic, modelling unlawful forced displacement. Events are logged with an Art. 17 AP II citation.

**IHL basis:** AP II Art. 17(1); Customary IHL Rule 129 (prohibition on forced displacement).

---

## 2. IHL-Protected Population Categories

Two new population types have been added alongside the existing elders and children under 5.

### 2.1 Pregnant Women (`pregnantPct` slider, 0–30 %)

- Milling delay: `[2, 5]` ticks extra (pedestrian), comparable to elders
- Movement speed: 2.0 px/tick (pedestrian) — between elder and adult
- Canvas symbol: **teal circle with white cross** (medical/maternity symbol)
- Colour: `#0891B2` fill / `#0E7490` stroke
- `confirmNeeded` unchanged from adult baseline
- Log tag: `[pregnant]`

**IHL basis:** AP I Art. 16; GC IV Art. 23.

### 2.2 Unaccompanied Minors (`unaccompChildPct` slider, 0–20 %)

- Milling delay: `[6, 12]` ticks extra (pedestrian) — the longest of all categories, reflecting reunification and tracing requirements before departure
- Movement speed: 1.5 px/tick (child speed)
- `confirmNeeded` receives +2 extra confirmations (escort/reunification authority required)
- Canvas symbol: **orange upward triangle** (distinct from the child <5 diamond)
- Colour: `#EA580C` fill / `#C2410C` stroke
- Log tag: `[unaccomp. minor]`

**IHL basis:** AP I Art. 78 (evacuation of children requires family consent and ICRC notification); ICRC family reunification mandate.

---

## 3. Canvas Symbol Encoding

Each population type now has a distinct shape on the simulation canvas:

| Population | Shape | Colour |
|---|---|---|
| Adult | Circle (status colour) | Phase-dependent |
| Elder | Circle | Purple `#7F77DD` |
| Child <5 | Rotated diamond | Pink `#D4537E` |
| Pregnant woman | Circle + white cross | Teal `#0891B2` |
| Unaccompanied minor | Upward triangle | Orange `#EA580C` |

Shapes revert to a plain grey circle when a member reaches DONE status, consistent with existing behaviour.

---

## 4. Stats Panel Restructure

The stats bar below the canvas has been reorganised into three rows:

- **Row 1 — Phase counts:** Unaware · Seeking · Milling · Evacuating · Evacuated
- **Row 2 — Demographic counts:** Children <5 · Elders · Pregnant · Unaccomp.
- **Row 3 — % Clear:** Full-width prominent tile showing the percentage of all members who have completed evacuation

The `getStats()` function now returns `pregnant` and `unaccomp` counts alongside the existing `elders` and `children` fields.

---

## 5. About Page — Guide Sections

### 5.1 Armed Conflict Guide (`ArmedConflictGuide` component)

A new guide section explains all five armed-conflict mechanics with:
- Functional description of each slider
- Simulation effect on household behaviour
- IHL legal basis with article citations
- Practical interpretation guidance for humanitarian planners

Inserted between `DynamicThreatGuide` and `HowToUse` in the render order.

### 5.2 Phase Illustration — Corridor Gates and Aid Node

The sticky phase SVG illustration (`PhaseIllustration`) was updated to show:
- Four corridor gate rectangles at N/S/E/W canvas edges, highlighted green from phase 3 (Evacuating)
- An Aid node circle (upper-left) representing the humanitarian actor channel, active at phase 2 (Seeking) with a dashed green arc to the featured agent

### 5.3 Population Factors — Updated Legend

The `PopulationFactors` bar charts now include all five population types with correct shape swatches rendered by a new `ShapeSwatch` component. The section heading was updated to "Vulnerability shapes the timeline" and the introductory paragraph references all IHL-protected categories.

---

## Legal References

| Concept | IHL Basis |
|---|---|
| Pregnant women / new mothers | AP I Art. 16; GC IV Art. 23 |
| Unaccompanied minors | AP I Art. 78 |
| Humanitarian corridors / safe passage | Customary IHL Rule 99; AP II Art. 17 |
| Prohibition on forced displacement | AP II Art. 17(1); Customary IHL Rule 129 |
| Prohibition on perfidy / misinformation | AP I Art. 37 |
| Prohibition on attacking civilian objects | AP I Art. 52 |
| Checkpoints and freedom of movement | Customary IHL Rule 99 |

*AP I: 1977 Additional Protocol I to the Geneva Conventions*
*AP II: 1977 Additional Protocol II to the Geneva Conventions*
*GC IV: 1949 Geneva Convention IV (Protection of Civilian Persons)*
*Customary IHL Rules: ICRC Customary IHL Study (Henckaerts & Doswald-Beck, 2005)*
