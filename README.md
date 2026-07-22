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

An independent academic peer review of this report is available in [`peer-review/`](peer-review/) ([Word](peer-review/evacuation-simulation-Peer-Review.docx) &middot; [Markdown](peer-review/evacuation-simulation-Peer-Review.md)).

**Recommendation:** Major revisions

**What the review found:**

- No empirical output anywhere: not a single run, figure, or distribution is reported, yet the paper insists multi-run comparison is the only valid use (S7.6/S8.4-8.5).
- Designed-in assumptions are presented as findings: the "car equalizes vulnerability" result is a hard-coded identical speed, not an emergent discovery (S5.5, S12.1).
- The IHL grounding is a core selling point yet S9.3-9.7 documents four load-bearing citations as wrong and leaves them uncorrected.

**Noted strength:** The vulnerability-as-time framing (S8.2, S12.2) is genuinely elegant, and the legal corrections in S9 are careful and, on verification, substantively correct.
