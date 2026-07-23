# Evacuation Simulation

**[Live site](https://ethical-tech-colab.github.io/Evac-Sim-Melanie/)** ·
**[Research report](EvacSim-Paper.md)** (plain-language, non-technical)

An interactive agent-based model of community evacuation behavior, built in React.
The Evacuation Simulator is meant to show how information spreads and demographics affect humanitarian evacuations. Rooted in diaster relief scholarship and International Humanitarian Law, this simulation allows students and humanitarians to explore how different demographics and information flows affect humanitarian evacuations. 

Users are able to change demographics, neighnbor influence, humanitarian aid reach, and information clairity to model different evacuation circumstance. Users can then compare runs to better understand how demographics and information spread affect humanitarian evacuations. 

The opening site is a guide page, which takes users through how to use the simulation and explains the foundational research and formulas that the simulation operates undere. 

## What it models

- **Family clusters** — households with a hub node that waits for all members before departing
- **Information-seeking loops** — members hear an alert but must confirm it before milling begins; the single "Info" node's clarity and reliability control how quickly confirmations arrive
- **Neighbor social influence** — seeing adjacent families mill or evacuate counts as a confirmation signal
- **Elder delays** — elders need more confirmations, longer milling time, and slower travel speed
- **Child (<5) delays** — young children require longer milling (gathering, packing) and move slowest during evacuation
-**Pregnancy Delays**- those who are pregnant have delayed travel speed
-**Unaccompanied Minors Delays**- unaccompanied children mill for longer periods of time and take longer to evacuate 

## Status lifecycle

```
UNAWARE → SEEKING → MILLING → EVACUATING → DONE
```

Each transition is probabilistic and depends on threat level, info clarity, and household composition.

## Setup

```bash
npm install
npm run dev        # development server at http://localhost:5173
npm run build      # production bundle → dist/
npm run preview    # preview the production build
```

## Project structure

```
evacuation-sim/
├── src/
│   ├── EvacuationSim.jsx   # Main component + all simulation logic
│   ├── main.jsx            # React entry point
│   └── index.css           # Minimal reset
├── index.html
├── package.json
└── vite.config.js
```

## Extending with Claude Code

The simulation logic is fully separated from the React UI into named exports:

| Export              | Description |
|---------------------|-------------|
| `buildSimulation()` | Creates a fresh sim from params |
| `stepSimulation()`  | Advances by one tick; returns new logs and finished flag |
| `drawSimulation()`  | Renders current state to a canvas context |
| `getStats()`        | Returns status counts and demographic tallies |

Deployed on GitHub pages at https://ethical-tech-colab.github.io/Evac-Sim-Melanie/

---

## Peer Review

The full independent academic peer review of this report is in [PEER-REVIEW.md](PEER-REVIEW.md) (also available as [Word](peer-review/evacuation-simulation-Peer-Review.docx) under [`peer-review/`](peer-review/)).

**Recommendation:** Major revisions

**What the review found:**

- No empirical output anywhere: not a single run, figure, or distribution is reported, yet the paper insists multi-run comparison is the only valid use (S7.6/S8.4-8.5).
- Designed-in assumptions are presented as findings: the "car equalizes vulnerability" result is a hard-coded identical speed, not an emergent discovery (S5.5, S12.1). — **Fixed.**
- The IHL grounding is a core selling point yet S9.3-9.7 documents four load-bearing citations as wrong and leaves them uncorrected. — **Fixed in the tool, not just described.**

### Revisions applied

**The four wrong IHL citations are corrected in the software**, in the React source, the rebuilt `docs/` bundle, and the supporting documentation — so the tool no longer teaches law its own paper shows to be mis-cited:

| Was cited | For | Problem | Now cited |
|---|---|---|---|
| Customary Rule 99 | A right to leave; corridors; checkpoints | Rule 99 governs arbitrary deprivation of liberty; no rule creates a general civilian right to leave | GC IV Art. 17; Customary Rules 55–56; Art. 17 AP II |
| AP I Art. 16 | Pregnant women | Art. 16 AP I concerns general protection of medical duties | GC IV Art. 16; AP I Arts. 8(a), 70(1), 76 |
| AP I Art. 78 | Internal evacuation of children | Art. 78 covers evacuation of non-national children *abroad* | AP I Art. 77; GC IV Arts. 24, 50; tracing under GC IV Arts. 26/140, AP I Art. 74 |
| Customary Rule 9 | Prohibition on attacking civilian objects | Rule 9 is the definition, not the prohibition | Customary Rule 10 (with Art. 52 AP I) |

GC IV Art. 23 has also been dropped as a claimed personal protection status for expectant mothers — it governs free passage of relief consignments. S9.2 is reframed from "errors the reader should be aware of" to a changelog of corrections applied, with S9.3–9.7 moved to past tense.

**Car equalization is relabelled as a designed-in assumption** (S5.5, S11.3). Every category was assigned an identical car speed of 5.5 against foot speeds of 1.5–2.6, so the equalization is arithmetic from the parameter table, not a discovery — the model cannot output anything else. The passage now states the modelling judgement plainly and points instead to the genuinely emergent results: the neighbour-influence cascade, the fixed-delay/closing-window interaction, and channel-split composition under degraded information.

**Noted strength:** The vulnerability-as-time framing (S8.2, S12.2) is genuinely elegant, and the legal corrections in S9 are careful and, on verification, substantively correct.
