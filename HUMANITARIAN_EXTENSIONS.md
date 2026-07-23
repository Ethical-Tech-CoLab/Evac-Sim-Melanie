# Humanitarian Extensions — Evacuation Simulation

*Suggestions for adapting the simulation to International Humanitarian Law and humanitarian operations contexts.*

---

## Framing

The current simulation models a generalised community evacuation driven by information spread and household composition. It captures dynamics well-documented in disaster sociology — milling, confirmation-seeking, social contagion — but it abstracts away the legal, operational, and political conditions that define humanitarian evacuations in armed conflict or protracted crisis settings.

Humanitarian evacuations differ from natural-disaster evacuations in several fundamental ways:

- **The threat is often human and deliberate**, not natural and indiscriminate
- **Information is contested and weaponised**, not simply unclear
- **Movement may be legally protected, obstructed, or coerced** under IHL
- **Vulnerability is legally structured** — IHL defines protected categories with specific entitlements
- **Humanitarian actors introduce a third channel** of information and coordination distinct from both official government broadcast and social contagion
- **The simulation may itself constitute a violation** — forced displacement is a war crime under customary IHL and Article 17 AP II

These distinctions suggest a substantial set of extensions, organised below by theme.

---

## 1. IHL-Protected Vulnerability Categories

### Current state
The simulation models two vulnerability types: elders (slower, need extra confirmation) and children under 5 (slowest movement, longest milling). These reflect general mobility constraints.

### Suggested additions

**Wounded and sick**
Under Articles 10–12 AP I and the First Geneva Convention, the wounded and sick have absolute protection and must be prioritised for evacuation. In simulation terms this would mean highest milling delay (they cannot self-prepare) but should have priority access to corridors and transport. Their presence in a household could trigger early alerting from medical networks before the general population receives warnings.

**Unaccompanied minors**
Separated children are among the highest-risk populations in conflict displacement (AP I Art. 77 and GC IV Arts. 24 and 50 govern their protection in internal evacuation; AP I Art. 78, which requires family consent, applies only to evacuation of non-national children abroad, and does not apply here -- see compelling security reasons). In the simulation, they could be modelled as members detached from their family cluster — requiring reunification before the hub can depart, or triggering a separate "tracing" phase before milling begins. This reflects the ICRC's family reunification mandate.

**Pregnant women and new mothers**
IHL (GC IV Art. 16; AP I Arts. 8(a), 70(1) and 76) gives pregnant women and mothers of young children special protection. (Art. 16 AP I concerns general protection of medical duties, and Art. 23 GC IV governs free passage of relief consignments rather than personal status; neither is the correct basis.) Their milling delay and movement speed are comparable to elders, but they also trigger priority access mechanics in humanitarian corridors.

**Persons with disabilities**
Frequently invisible in mass displacement modelling. Their presence should affect household milling time similarly to elders, but with the added mechanic that they may require specific transport (not available in all scenarios), making the Car scenario disproportionately important for their evacuation.

**People with documentation gaps**
Under IHL, civilians should not be required to produce documents to flee, but in practice checkpoints enforce documentation requirements. Modelling some members as lacking valid ID would add checkpoint-delay mechanics (see Section 5).

---

## 2. Dynamic and Directional Threat

### Current state
Threat is a static slider (1–10) that affects the probability of receiving an initial alert. It does not change during the run.

### Suggested additions

**Escalating threat**
In armed conflict, the threat level typically increases over the course of an operation. A dynamic threat that rises each tick (with a configurable escalation rate) would model the compressing decision window that characterises conflict evacuations — families that delay too long find the threat has overtaken them.

**Directional threat (front line)**
Current threat is spatially uniform. A conflict front line should affect families differently depending on their position relative to the line of contact. Families closest to the front should receive alerts earlier and face higher urgency; families further away may not receive credible warnings until the front moves toward them. This spatial asymmetry is a core feature of conflict displacement that the current circular/scatter layout does not capture.

**Threat from specific directions blocking evacuation routes**
If the threat originates from a specific direction, evacuation in that direction becomes impossible or lethal. The current model evacuates all members radially outward from centre. A conflict model would need to block certain route vectors and funnel movement toward specific corridors — making the humanitarian corridor mechanics (Section 4) essential rather than optional.

**Ceasefire windows**
Active hostilities may pause for humanitarian corridors to open (see Section 4). During a ceasefire window, the threat level drops to near-zero, dramatically accelerating evacuations. When the window closes, the threat spikes back and any household still milling may be trapped. This time-pressure mechanic is one of the most important dynamics in conflict evacuation.

---

## 3. Information Environment in Armed Conflict

### Current state
There is one information node with a single clarity and reliability setting. All households receive information from the same source.

### Suggested additions

**Multiple competing information sources**
In conflict settings, households receive information from several actors with different levels of credibility and different interests:

| Actor | Credibility model | IHL basis |
|---|---|---|
| ICRC / ICRC-affiliated networks | High reliability, neutral, no political framing | Art. 5 AP I — ICRC mandate |
| UN OCHA / humanitarian coordination | High reliability, may lag operational reality | UN Charter, OCHA mandate |
| National government | Variable — may have military objectives | State party obligations under GCt |
| Armed non-state actors | Low reliability, potentially coercive | Common Art. 3, AP II |
| Diaspora / social media networks | Variable, fast, often unverified | — |
| Community and religious leaders | High social trust, variable accuracy | — |

In the simulation, this could be modelled as multiple information nodes, each with distinct reliability and clarity values, and distinct connection graphs to families (not all sources reach all households equally).

**Deliberate misinformation**
Article 37 AP I prohibits perfidy; Article 38 prohibits misuse of emblems. In practice, parties to conflict spread false information about evacuation routes, safe zones, and ceasefire timings. A misinformation slider could introduce false confirmations — messages that count toward a household's confirmNeeded threshold but that lead them toward a dangerous route. The simulation could model households being "confirmed" but evacuating toward a blocked or dangerous corridor.

**Communication infrastructure destruction**
Telecommunications infrastructure is frequently destroyed in conflict (often unlawfully under IHL's prohibition on attacking civilian objects — Art. 52 AP I). A parameter for infrastructure degradation would progressively reduce the information node's reach over time, modelling the information blackout that characterises later stages of conflict displacement.

**Language and literacy barriers**
Humanitarian operations frequently involve populations with multiple languages and low literacy rates. Official warnings may not be understood even when received. This could be modelled as an additional confirmation hurdle for specific household types — the message arrives but requires translation or community mediation before it is acted upon.

---

## 4. Humanitarian Corridors and Safe Passage

### Current state
There is no concept of route or directionality. All evacuating members move radially outward and are considered "done" when they leave the canvas edge.

### Suggested additions

**Humanitarian corridor mechanic**
A corridor is a negotiated, time-limited, spatially-defined route for civilian evacuation. Under GC IV Art. 17, Customary Rules 55-56 and Article 17 AP II, parties must endeavour to agree the removal of vulnerable civilians and must allow civilians to leave and may not use them as human shields or obstruct their passage. The simulation could model:
- A specific exit point (not all canvas edges) that represents the corridor
- A corridor validity window (open for N ticks, then closed or uncertain)
- A corridor reliability parameter (probability that the corridor is actually safe when used)
- Families that begin evacuating after the corridor closes face elevated threat

**Humanitarian pause / ceasefire window**
A time-limited ceasefire (e.g., ticks 15–35) during which threat drops to near zero. Families who have not yet begun milling by the time the window opens may not complete their evacuation before it closes. This creates a direct, visible trade-off between milling delay and corridor access — making the milling phase parameters (particularly elder and child delays) more consequential.

**Corridor violations**
IHL prohibits attacking civilians using a corridor in good faith. The simulation could model corridor violations as a random event — with a configurable probability — where the corridor is struck during the window, killing or injuring members in transit. This introduces the humanitarian community's real dilemma: whether to advise population movement when corridor guarantees cannot be verified.

**Convoy formation requirement**
In many humanitarian operations, civilians cannot move as individuals — they must form convoys that are registered and escorted. The simulation could require that families depart in groups rather than individually, adding a coordination step between milling and evacuation and making the social network structure more operationally significant.

---

## 5. Obstruction Mechanics

### Current state
All households can evacuate freely once they begin. There are no external impediments to movement.

### Suggested additions

**Checkpoints**
Checkpoints are one of the most common impediments to civilian movement in conflict. Under IHL, checkpoints may be used for security screening but may not be used to impede civilian evacuation disproportionately. In practice they create significant delays. The simulation could model checkpoints as nodes on evacuation routes that add a random delay (drawn from a configurable distribution) to any member passing through.

**Detention risk at checkpoints**
For some population profiles (men of fighting age, persons without documentation, members of certain ethnic or political groups), checkpoints carry a risk of detention or enforced disappearance — effectively removing that member from the simulation. This is a grave IHL violation (enforced disappearance is prohibited under customary IHL Rule 98) but it is a real operational risk that affects household decision-making about whether to attempt evacuation.

**Deliberate obstruction (siege)**
Article 17(1) AP II and customary IHL Rule 129 prohibit ordering the displacement of civilians. Siege warfare — deliberately preventing civilian evacuation — is a war crime. The simulation could model a "siege" scenario where some families are assigned an obstruction flag, preventing them from entering the evacuation phase regardless of their confirmation status. This would starkly illustrate the humanitarian consequences of siege as a tactic.

**Looting and secondary threat**
Evacuating households may face threats not from the original conflict but from opportunistic looting or violence during movement. A secondary threat parameter affecting households in the EVAC phase would model this, adding a probability of harm during transit that is separate from the conflict threat driving the initial evacuation.

---

## 6. Humanitarian Actor Network

### Current state
The central information node represents an undifferentiated official broadcast. There is no modelling of humanitarian organisations as distinct actors.

### Suggested additions

**ICRC / humanitarian organisation node**
A distinct information node representing ICRC, UNHCR, or humanitarian coordination bodies. This node would have:
- Higher baseline reliability than a government broadcast (reflecting the ICRC's trusted neutral status)
- Slower initial reach (humanitarian actors take time to deploy and establish contact networks)
- Specific mandate to prioritise the most vulnerable (preferential connection to household members flagged as wounded, unaccompanied minors, etc.)
- A "humanitarian access" parameter (set by the armed party) that can block or delay this node's reach — modelling access negotiations

**Aid worker presence as social confirmation**
In the current social channel, confirmation comes from seeing neighbours evacuate. In humanitarian settings, the presence of an aid worker or UN vehicle is a powerful social signal that the situation is serious. Aid worker presence in a neighbourhood could function as a neighbourhood-level social confirmation event that accelerates the confirmation process for multiple households simultaneously.

**Humanitarian coordination (cluster system)**
The UN cluster system coordinates multiple humanitarian actors. A coordination parameter could reflect how well-coordinated the humanitarian response is — high coordination means information from different humanitarian nodes is consistent and mutually reinforcing; low coordination means conflicting messages that increase households' confirmNeeded count.

---

## 7. Forced Displacement and Consent

### Current state
All evacuation is modelled as voluntary — households choose to leave when sufficiently informed and prepared.

### Suggested additions

**Coerced evacuation flag**
IHL (Art. 17(1) AP II, customary IHL Rule 129) distinguishes between voluntary evacuation for civilian safety and forced displacement, which is prohibited. Some households in the simulation could be flagged as "coerced" — they begin milling before they have met their confirmation threshold, driven by immediate physical threat rather than persuasion. This models the IHL violation and its consequences: coerced households skip the information-seeking phase, evacuate faster, but may leave without essential items (higher risk in transit) and may be displaced toward areas that are not safe.

**Refusal to evacuate**
Some populations refuse to leave due to attachment to land and property, fear of not being allowed to return, cultural ties to burial sites, or distrust of the evacuating authority. IHL does not require civilians to accept evacuation offers. A "refusal" mechanic would allow some households to remain even after receiving full confirmations — effectively opting out. Tracking the proportion of households that refuse gives a measure of community trust in the authorities.

**Return and secondary displacement**
Many displaced persons attempt to return before conditions are safe, only to be displaced again. A "return" phase after DONE status, with a probability of re-entry into the SEEKING phase, would model the multiple displacement cycles that characterise protracted conflict — and the cumulative toll they impose on the most vulnerable.

---

## 8. New Scenario: Armed Conflict

### Current state
Three scenarios (Pedestrian, Car, Train) vary the mode of evacuation but all assume a benign movement environment.

### Suggested additions

**Armed conflict scenario**
A fourth scenario that combines:
- Dynamic escalating threat
- Directional threat blocking some route vectors
- Humanitarian corridor (time-limited)
- Checkpoint delays
- Misinformation channel alongside official and social channels
- Reduced info clarity (infrastructure damage)
- Coercion risk for some households
- Higher confirmation requirements (populations are more sceptical of warnings given past false alarms or propaganda)

This scenario would not simply change milling and movement speeds — it would activate an entirely different set of mechanical rules, more directly grounded in IHL frameworks.

**Siege scenario**
A specific variant where all corridor exits are blocked and only a humanitarian pause can open movement. The simulation would show families cycling through SEEKING and MILLING phases with no ability to EVAC until the window opens — and some families never completing evacuation if the window is too short relative to their milling delay.

---

## 9. Metrics and Analytics for Humanitarian Use

### Current state
The end-of-run summary tracks total ticks, per-phase averages, slowest family, and neighbour influence channel split.

### Suggested additions

**Protection gap metric**
The fraction of IHL-protected persons (wounded, unaccompanied minors, pregnant) who did not complete evacuation within the ceasefire window. This is the direct humanitarian performance indicator.

**Channel trust metric**
Which information source drove the most final confirmations — and whether the humanitarian actor node or the government node was more influential. High humanitarian actor influence suggests good access and trust; low influence suggests access restrictions or credibility deficits.

**Obstruction index**
Number of household members delayed or stopped at checkpoints as a fraction of total evacuating members. A high obstruction index indicates IHL compliance concerns around the checkpoint regime.

**Forced displacement ratio**
The fraction of households that began evacuating due to coercion rather than persuasion. A high ratio indicates a pattern consistent with unlawful forced displacement under IHL.

**Time-in-corridor metric**
Average time (ticks) households spent in an active corridor before reaching safety. Long times indicate convoy delays, checkpoint congestion, or corridor narrowing — all operational concerns for humanitarian planners.

---

## 10. Pedagogical and Training Applications

Beyond simulation mechanics, this tool could serve specific IHL and humanitarian training purposes with relatively modest additions:

**Scenario presets tied to historical operations**
Pre-configured parameter sets approximating real operations — Mariupol (siege, blocked corridors), Aleppo (multiple displacement cycles, corridor violations), Cox's Bazar (mass movement, documentation barriers, host community tension). These would not be precise reconstructions but illustrative approximations for classroom use.

**IHL compliance overlay**
A post-run analysis panel that evaluates the simulated conditions against IHL obligations: Were civilians given adequate warning time? Were corridor windows sufficient for the vulnerable population to complete evacuation? Was the threat proportionate? This overlay would make the legal framework operationally tangible for students and practitioners.

**Decision-point mode**
A paused simulation mode where the user is presented with a decision at key moments (corridor window opening, checkpoint delay detected, coercion event detected) and must choose a response — alerting more families, requesting ceasefire extension, rerouting the corridor. Choices feed back into the simulation parameters for the remaining run, making the tool interactive for training exercises.

**Comparative runs across legal regimes**
A split-screen mode showing the same community evacuating under IHL-compliant conditions (full corridor access, no obstruction, reliable humanitarian information) vs. non-compliant conditions (corridor blocked, misinformation active, checkpoints with detention risk). The visual and statistical divergence makes the humanitarian cost of IHL violations immediately legible.

---

## Legal References

| Concept | IHL Basis |
|---|---|
| Civilian protection during evacuation | Art. 58 AP I; Art. 17 AP II |
| Prohibition on forced displacement | Art. 17(1) AP II; Customary IHL Rule 129 |
| Protection of wounded and sick | Arts. 10–12 AP I; GC I Arts. 12–18 |
| Unaccompanied minors | AP I Art. 77; GC IV Arts. 24, 50 |
| Pregnant women and mothers | GC IV Art. 16; AP I Arts. 8(a), 70(1), 76 |
| Prohibition on starvation / siege | Customary IHL Rule 53; Art. 54 AP I |
| Humanitarian access | Art. 70 AP I; Customary IHL Rule 55 |
| Prohibition on attacking civilian objects | Art. 52 AP I; Customary IHL Rule 10 |
| Prohibition on perfidy / misinformation | Art. 37 AP I |
| Checkpoints and freedom of movement | GC IV Art. 17; Customary Rules 55-56 (ICRC Study) |
| Enforced disappearance | Customary IHL Rule 98 |
| ICRC mandate and emblem protection | Art. 5 AP I; GC I Arts. 26–27 |

*AP I: 1977 Additional Protocol I to the Geneva Conventions*
*AP II: 1977 Additional Protocol II to the Geneva Conventions*
*GC I–IV: 1949 Geneva Conventions*
*Customary IHL Rules refer to the ICRC Customary IHL Study (Henckaerts & Doswald-Beck, 2005)*
