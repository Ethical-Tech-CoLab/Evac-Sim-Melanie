import { useState, useEffect, useRef } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useFadeIn(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function FadeIn({ children, delay = 0, style = {} }) {
  const [ref, visible] = useFadeIn();
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(22px)",
      transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      ...style,
    }}>
      {children}
    </div>
  );
}

function hexPts(cx, cy, r) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
}

// ─── Phase illustration (sticky SVG) ─────────────────────────────────────────

const NODES = [
  { id: 0, x: 62,  y: 62,  label: "Rivera", members: [{ dx: -14, dy: 12 }, { dx: 14, dy: 12 }] },
  { id: 1, x: 210, y: 55,  label: "Kim",    members: [{ dx: -12, dy: 14 }, { dx: 10, dy: 16, isElder: true }] },
  { id: 2, x: 258, y: 155, label: "Okafor", members: [{ dx: -16, dy: -4 }, { dx: -8, dy: 16, isChild: true }] },
  { id: 3, x: 205, y: 240, label: "Hassan", members: [{ dx: -14, dy: -10 }, { dx: 10, dy: -14, isElder: true }] },
  { id: 4, x: 68,  y: 240, label: "Novak",  members: [{ dx: 14, dy: -12 }] },
  { id: 5, x: 24,  y: 150, label: "Tanaka", members: [{ dx: 14, dy: -10 }, { dx: 16, dy: 10 }] },
];

const EDGES = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,2],[1,3]];

const PHASE_STATUS = ["unaware","seeking","milling","evac","done","social"];
const STATUS_FILL  = { unaware:"#888780", seeking:"#378ADD", milling:"#EF9F27", evac:"#E24B4A", done:"#1D9E75" };
const STATUS_STR   = { unaware:"#5F5E5A", seeking:"#185FA5", milling:"#BA7517", evac:"#A32D2D", done:"#0F6E56" };
const ELDER_FILL = "#7F77DD", ELDER_STR = "#534AB7";
const CHILD_FILL = "#D4537E", CHILD_STR = "#993556";

function PhaseIllustration({ step }) {
  const CX = 140, CY = 152;
  // step 0–5 maps to phases; "featured" family is Kim (id=1) and Hassan (id=3)
  const featuredId  = step <= 2 ? 1 : 3;
  const featured    = NODES.find(n => n.id === featuredId);
  const socialStep  = step === 5;

  function nodeStatus(id) {
    if (step === 0) return "unaware";
    if (id === featuredId) return PHASE_STATUS[Math.min(step, 4)];
    if (step >= 4 && id === 0) return "done";  // Rivera also done by step 4
    if (step >= 3 && id === 2) return "milling"; // Okafor milling
    return "unaware";
  }

  // Evac offset for featured node at step 3+
  function nodeOffset(id) {
    if (id === featuredId && step === 3) return { dx: 22, dy: -18 };
    if (id === featuredId && step >= 4)  return { dx: 38, dy: -30 };
    return { dx: 0, dy: 0 };
  }

  return (
    <svg viewBox="0 0 280 280" style={{ width: "100%", borderRadius: 12, background: "#f8f7f4", border: "0.5px solid rgba(0,0,0,0.08)" }}>
      {/* Edges */}
      {EDGES.map(([a, b]) => {
        const na = NODES[a], nb = NODES[b];
        const oa = nodeOffset(a), ob = nodeOffset(b);
        const active = socialStep && (a === 0 || b === 0 || a === featuredId || b === featuredId);
        return (
          <line key={`${a}-${b}`}
            x1={na.x + oa.dx} y1={na.y + oa.dy}
            x2={nb.x + ob.dx} y2={nb.y + ob.dy}
            stroke={active ? "#EF9F27" : "rgba(150,148,142,0.3)"}
            strokeWidth={active ? 1.5 : 1}
            strokeDasharray="3 3"
            style={{ transition: "stroke 0.5s, stroke-width 0.5s" }}
          />
        );
      })}

      {/* Info arc (seeking step) */}
      {step === 1 && (
        <line x1={CX} y1={CY} x2={featured.x} y2={featured.y}
          stroke="#378ADD" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.8} />
      )}
      {/* Social arc (social step) */}
      {socialStep && (
        <line x1={NODES[0].x} y1={NODES[0].y} x2={NODES[5].x} y2={NODES[5].y}
          stroke="#EF9F27" strokeWidth={2} opacity={0.7} />
      )}

      {/* Info node hexagon */}
      <polygon points={hexPts(CX, CY, step === 1 ? 18 : 14)}
        fill={step === 1 ? "#185FA5" : "rgba(55,138,221,0.15)"}
        stroke="#185FA5" strokeWidth={step === 1 ? 1.8 : 0.8}
        style={{ transition: "all 0.5s" }}
      />
      <text x={CX} y={CY + 4} textAnchor="middle" fontSize="9" fontWeight="500"
        fill={step === 1 ? "#fff" : "#0C447C"}>Info</text>

      {/* Family nodes */}
      {NODES.map(n => {
        const st    = nodeStatus(n.id);
        const off   = nodeOffset(n.id);
        const nx    = n.x + off.dx, ny = n.y + off.dy;
        const fill  = STATUS_FILL[st], str = STATUS_STR[st];

        return (
          <g key={n.id} style={{ transition: "transform 0.6s ease" }}>
            {/* Seeking progress ring */}
            {st === "seeking" && (
              <circle cx={nx} cy={ny} r={14} fill="rgba(55,138,221,0.1)"
                stroke="#378ADD" strokeWidth={2} strokeDasharray="22 66" strokeLinecap="round"
                transform={`rotate(-90 ${nx} ${ny})`} />
            )}
            {/* Milling glow */}
            {st === "milling" && (
              <circle cx={nx} cy={ny} r={14} fill="rgba(239,159,39,0.15)" />
            )}
            {/* Evac arrow */}
            {st === "evac" && (() => {
              const ang = Math.atan2(ny - CY, nx - CX);
              const tx = nx + Math.cos(ang) * 17, ty = ny + Math.sin(ang) * 17;
              return (
                <polygon
                  points={`${tx},${ty} ${tx - Math.cos(ang-0.5)*6},${ty - Math.sin(ang-0.5)*6} ${tx - Math.cos(ang+0.5)*6},${ty - Math.sin(ang+0.5)*6}`}
                  fill={STATUS_STR.evac}
                />
              );
            })()}
            {/* Hub circle */}
            <circle cx={nx} cy={ny} r={9} fill={fill} stroke={str} strokeWidth={1.5}
              style={{ transition: "fill 0.5s, stroke 0.5s" }} />
            {/* Hub label — positioned above */}
            <text x={nx} y={ny - 13} textAnchor="middle" fontSize="8" fontWeight="500"
              fill={str} style={{ transition: "fill 0.5s" }}>{n.label}</text>
            {/* Members */}
            {n.members.map((mem, mi) => {
              const mx = nx + mem.dx, my = ny + mem.dy;
              const mfill = mem.isElder ? ELDER_FILL : mem.isChild ? CHILD_FILL : fill;
              const mstr  = mem.isElder ? ELDER_STR  : mem.isChild ? CHILD_STR  : str;
              if (mem.isChild) {
                return (
                  <rect key={mi} x={mx - 4} y={my - 4} width={8} height={8}
                    fill={mfill} stroke={mstr} strokeWidth={0.8}
                    transform={`rotate(45 ${mx} ${my})`}
                    style={{ transition: "fill 0.5s" }} />
                );
              }
              return (
                <circle key={mi} cx={mx} cy={my} r={5} fill={mfill} stroke={mstr} strokeWidth={0.8}
                  style={{ transition: "fill 0.5s" }} />
              );
            })}
          </g>
        );
      })}

      {/* Phase label */}
      <text x={140} y={272} textAnchor="middle" fontSize="9" fill="#737069">
        {["All unaware","Alert received","Seeking confirmation","Milling — preparing","Evacuating","Social influence"][step] ?? ""}
      </text>
    </svg>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

const PHASE_STEPS = [
  {
    tag: "Phase 0",
    title: "A community before the emergency",
    body: "The simulation models six households — each with a hub member (the family name) and 1–3 individuals. At the start, everyone is unaware. Grey nodes. Nothing happening yet.",
  },
  {
    tag: "Phase 1 — Alert",
    title: "An official warning is issued",
    body: "A central information node broadcasts an alert. Whether a household receives it depends on threat level and information clarity. Low clarity means a weak, ambiguous signal that not everyone picks up.",
  },
  {
    tag: "Phase 2 — Seeking",
    title: "People don't act on a single alert",
    body: "Most households seek confirmation from multiple sources before accepting the threat as real. The progress ring shows how many confirmations have been received. Elders require one extra confirmation before they believe it.",
  },
  {
    tag: "Phase 3 — Milling",
    title: "Confirmed — but not yet moving",
    body: "Once confirmed, households enter the milling phase: gathering belongings, contacting family, completing routines. This is normal behaviour, not panic. Families with elders or young children take significantly longer.",
  },
  {
    tag: "Phase 4 — Evacuating",
    title: "The hub waits for everyone",
    body: "The family hub only departs when its slowest member is ready. On foot, elders move at 1.8 px/tick and children at 1.5 — compared to 2.6 for adults. In a car or on a train, this gap largely disappears.",
  },
  {
    tag: "Phase 5 — Social influence",
    title: "Neighbours accelerate the cascade",
    body: "Seeing a neighbour prepare or evacuate can count as an additional social confirmation. The Neighbour influence slider controls how powerful this effect is. At high values, one family departing can cascade through the entire network.",
  },
];

function StickyPhases() {
  const [activeStep, setActiveStep] = useState(0);
  const stepRefs = useRef([]);

  useEffect(() => {
    const observers = stepRefs.current.map((el, i) => {
      if (!el) return null;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveStep(i); },
        { rootMargin: "-30% 0px -50% 0px", threshold: 0 }
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach(o => o?.disconnect());
  }, []);

  return (
    <div style={{ background: "#fff", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            How it works
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 40, letterSpacing: "-0.3px" }}>
            The evacuation cycle
          </h2>
        </FadeIn>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 28 }}>
          {/* Sticky illustration */}
          <div style={{ position: "sticky", top: "15vh", width: 240, flexShrink: 0 }}>
            <PhaseIllustration step={activeStep} />
            {/* Step dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
              {PHASE_STEPS.map((_, i) => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: i === activeStep ? "#185FA5" : "rgba(24,95,165,0.2)",
                  transition: "background 0.3s",
                }} />
              ))}
            </div>
          </div>
          {/* Scrolling text */}
          <div style={{ flex: 1 }}>
            {PHASE_STEPS.map((s, i) => (
              <div key={i} ref={el => stepRefs.current[i] = el}
                style={{ minHeight: "68vh", display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: i === 0 ? 0 : 16 }}>
                <div style={{
                  opacity: activeStep === i ? 1 : 0.35,
                  transform: activeStep === i ? "translateX(0)" : "translateX(-6px)",
                  transition: "opacity 0.4s, transform 0.4s",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                    {s.tag}
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 600, color: "#0f1e36", marginBottom: 10, lineHeight: 1.35 }}>
                    {s.title}
                  </h3>
                  <p style={{ fontSize: 13, lineHeight: 1.8, color: "#5a5a55", margin: 0 }}>
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Channels() {
  return (
    <div style={{ background: "#f8f7f4", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Information pathways
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 8, letterSpacing: "-0.3px" }}>
            Two channels drive evacuations
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "#5a5a55", marginBottom: 32, maxWidth: 520 }}>
            Whether a household evacuates — and how quickly — depends on which channel reaches it first and how reliable that channel is perceived to be.
          </p>
        </FadeIn>
        <div style={{ display: "flex", gap: 14 }}>
          <FadeIn delay={0} style={{ flex: 1 }}>
            <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid rgba(0,0,0,0.1)", padding: "20px 20px 24px", height: "100%" }}>
              <div style={{ fontSize: 22, marginBottom: 10 }}>🔵</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#185FA5", marginBottom: 8 }}>Official channel</div>
              <p style={{ fontSize: 12, lineHeight: 1.75, color: "#5a5a55", margin: 0 }}>
                The central information node broadcasts alerts to all households simultaneously. The quality of this channel is controlled by the <strong>Info clarity</strong> slider. Low clarity means families need more confirmations before they believe the threat.
              </p>
              <div style={{ marginTop: 14, padding: "8px 10px", background: "#E6F1FB", borderRadius: 6, fontSize: 11, color: "#0C447C" }}>
                Represented by blue arcs from the hexagon node
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={120} style={{ flex: 1 }}>
            <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid rgba(0,0,0,0.1)", padding: "20px 20px 24px", height: "100%" }}>
              <div style={{ fontSize: 22, marginBottom: 10 }}>🟡</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#BA7517", marginBottom: 8 }}>Social channel</div>
              <p style={{ fontSize: 12, lineHeight: 1.75, color: "#5a5a55", margin: 0 }}>
                Seeing a neighbour milling or evacuating acts as a powerful social confirmation. The <strong>Neighbour influence</strong> slider controls the strength of this effect. At high values, it can cascade through the entire network independently of the official broadcast.
              </p>
              <div style={{ marginTop: 14, padding: "8px 10px", background: "#FEF3E2", borderRadius: 6, fontSize: 11, color: "#854F0B" }}>
                Represented by amber pulses along neighbour edges
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}

function PopulationFactors() {
  const bars = [
    { label: "Adult",      millingExtra: 0, speed: 2.6, fill: "#888780", str: "#5F5E5A" },
    { label: "Elder",      millingExtra: 3.5, speed: 1.8, fill: "#7F77DD", str: "#534AB7", shape: "circle" },
    { label: "Child <5",   millingExtra: 4.5, speed: 1.5, fill: "#D4537E", str: "#993556", shape: "diamond" },
  ];
  const maxMill = 4.5, maxSpeed = 2.6;

  return (
    <div style={{ background: "#fff", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Population factors
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 8, letterSpacing: "-0.3px" }}>
            Age shapes the timeline
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "#5a5a55", marginBottom: 32, maxWidth: 520 }}>
            Elders and young children affect both how long households take to prepare and how fast they can move. The hub waits for its slowest member — so one elder can delay an entire family.
          </p>
        </FadeIn>
        <div style={{ display: "flex", gap: 24 }}>
          <FadeIn delay={0} style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#737069", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
              Extra milling delay (avg. ticks)
            </div>
            {bars.map(b => (
              <div key={b.label} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{
                    width: 10, height: 10, flexShrink: 0, display: "inline-block",
                    background: b.fill, borderRadius: b.shape === "diamond" ? 0 : "50%",
                    transform: b.shape === "diamond" ? "rotate(45deg)" : "none",
                  }} />
                  <span style={{ fontSize: 11, color: "#3d3d3a", minWidth: 62 }}>{b.label}</span>
                  <span style={{ fontSize: 10, color: "#737069" }}>{b.millingExtra === 0 ? "none" : `+${b.millingExtra}t avg.`}</span>
                </div>
                <div style={{ height: 10, background: "rgba(0,0,0,0.06)", borderRadius: 5, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 5,
                    width: `${(b.millingExtra / maxMill) * 100 || 4}%`,
                    background: b.str,
                    transition: "width 0.8s ease",
                  }} />
                </div>
              </div>
            ))}
          </FadeIn>
          <FadeIn delay={120} style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#737069", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
              Movement speed (px / tick, pedestrian)
            </div>
            {bars.map(b => (
              <div key={b.label} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{
                    width: 10, height: 10, flexShrink: 0, display: "inline-block",
                    background: b.fill, borderRadius: b.shape === "diamond" ? 0 : "50%",
                    transform: b.shape === "diamond" ? "rotate(45deg)" : "none",
                  }} />
                  <span style={{ fontSize: 11, color: "#3d3d3a", minWidth: 62 }}>{b.label}</span>
                  <span style={{ fontSize: 10, color: "#737069" }}>{b.speed} px/t</span>
                </div>
                <div style={{ height: 10, background: "rgba(0,0,0,0.06)", borderRadius: 5, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 5,
                    width: `${(b.speed / maxSpeed) * 100}%`,
                    background: b.str,
                    transition: "width 0.8s ease",
                  }} />
                </div>
              </div>
            ))}
          </FadeIn>
        </div>
      </div>
    </div>
  );
}

function ScenariosSection() {
  const cards = [
    {
      icon: "🚶", key: "pedestrian", title: "Pedestrian",
      color: "#534AB7",
      points: ["Age strongly affects speed", "Elders +3–7t evac delay", "Children slowest at 1.5 px/t", "Social influence most impactful"],
    },
    {
      icon: "🚗", key: "car", title: "Car",
      color: "#185FA5",
      points: ["Vehicle equalises mobility", "All ages travel same speed", "Short prep time (1–3t base)", "Age effect nearly eliminated"],
    },
    {
      icon: "🚆", key: "train", title: "Train",
      color: "#0F6E56",
      points: ["Long wait for departure (4–8t)", "All passengers same speed", "Info clarity critical (platform?)", "Once aboard: fastest mode"],
    },
  ];
  return (
    <div style={{ background: "#f8f7f4", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Scenarios
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 8, letterSpacing: "-0.3px" }}>
            Context changes everything
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "#5a5a55", marginBottom: 32, maxWidth: 520 }}>
            The same community, threat level, and information quality can produce very different outcomes depending on the available mode of evacuation.
          </p>
        </FadeIn>
        <div style={{ display: "flex", gap: 12 }}>
          {cards.map((c, i) => (
            <FadeIn key={c.key} delay={i * 100} style={{ flex: 1 }}>
              <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid rgba(0,0,0,0.1)", overflow: "hidden" }}>
                <div style={{ background: c.color, padding: "14px 16px", color: "#fff" }}>
                  <span style={{ fontSize: 20, marginRight: 8 }}>{c.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{c.title}</span>
                </div>
                <ul style={{ margin: 0, padding: "14px 16px 16px 26px", listStyle: "disc" }}>
                  {c.points.map(p => (
                    <li key={p} style={{ fontSize: 11, lineHeight: 1.75, color: "#5a5a55" }}>{p}</li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </div>
  );
}

function CorridorGuide() {
  return (
    <div style={{ background: "#fff", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Corridor blocking
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 8, letterSpacing: "-0.3px" }}>
            Simulating blocked and closing exit routes
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "#5a5a55", marginBottom: 28, maxWidth: 560 }}>
            Available in the <strong>Pedestrian</strong> and <strong>Car</strong> scenarios, the corridor system replaces the default radial evacuation with four named exit gates — North, South, East, and West. Families route toward their nearest open gate. Closing a gate mid-run forces rerouting, models ceasefire window expiry, and may trap the most vulnerable households.
          </p>
        </FadeIn>

        {/* UI explainer */}
        <FadeIn delay={60}>
          <div style={{ background: "#f8f7f4", borderRadius: 12, padding: "18px 20px", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f1e36", marginBottom: 14 }}>The corridor controls panel</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                {
                  label: "Open / Closed toggle",
                  col: "#1D9E75",
                  body: "Each corridor starts Open. Click the button to close it before the simulation begins. Closed corridors are blocked for the entire run — families must reroute to a remaining open gate. If all four corridors are closed, all families will be trapped.",
                },
                {
                  label: "closes t: field",
                  col: "#D97706",
                  body: "Enter a tick number to close the corridor dynamically mid-run. Leave blank to keep the corridor open for the full simulation. When the simulation reaches that tick, the gate closes, a red ripple fires on the canvas, and any families already evacuating toward it automatically reroute to the nearest remaining open gate.",
                },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", gap: 14, padding: "12px 14px", background: "#fff", borderRadius: 8, borderLeft: `3px solid ${item.col}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: item.col, minWidth: 140, flexShrink: 0, paddingTop: 1 }}>{item.label}</div>
                  <div style={{ fontSize: 12, lineHeight: 1.75, color: "#5a5a55" }}>{item.body}</div>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Canvas visuals */}
        <FadeIn delay={120}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0f1e36", marginBottom: 10 }}>What you see on the canvas</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
            {[
              { swatch: "#1D9E75", label: "Green gate",   desc: "Corridor is open. Families evacuating toward it are shown moving in this direction." },
              { swatch: "#F59E0B", label: "Amber gate",   desc: "Corridor is open but will close within 5 ticks. A closing-time label (e.g. \"closes t:20\") appears near the gate." },
              { swatch: "#DC2626", label: "Red gate + ✕", desc: "Corridor is closed or has been closed mid-run. A BLOCKED label appears alongside it." },
              { swatch: "#DC2626", label: "Red ripple",   desc: "Emitted from the gate at the moment of mid-run closure — a brief visual alert so the event is never missed." },
              { swatch: "#D97706", label: "Amber arc",    desc: "Drawn from a rerouting member toward their new target gate when their original corridor closes." },
              { swatch: "#DC2626", label: "Red dashed ring", desc: "A pulsing ring around any member who is trapped — their milling phase complete but all corridors blocked. They cannot evacuate." },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ width: 12, height: 12, borderRadius: "50%", background: row.swatch, flexShrink: 0, marginTop: 3 }} />
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#3d3d3a" }}>{row.label} — </span>
                  <span style={{ fontSize: 11, color: "#5a5a55", lineHeight: 1.65 }}>{row.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Pedestrian vs Car difference */}
        <FadeIn delay={180}>
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            {[
              {
                icon: "🚶", title: "Pedestrian",
                body: "Rerouting to a distant gate adds significant ticks. For households with elders or young children, a mid-run closure may mean they cannot reach any alternative gate before the simulation ends — directly illustrating why milling delays have life-or-death consequences in conflict evacuations.",
              },
              {
                icon: "🚗", title: "Car",
                body: "Vehicle speed makes rerouting much cheaper. The same corridor closure that traps pedestrian households causes only minor delay in the Car scenario. Running both scenarios with identical corridor settings shows how access to transport changes the humanitarian calculus.",
              },
            ].map(c => (
              <div key={c.title} style={{ flex: 1, background: "#f8f7f4", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{c.icon} {c.title}</div>
                <p style={{ fontSize: 12, lineHeight: 1.75, color: "#5a5a55", margin: 0 }}>{c.body}</p>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* IHL callout */}
        <FadeIn delay={240}>
          <div style={{ background: "#FEF3E2", borderRadius: 10, padding: "14px 16px", border: "0.5px solid rgba(217,119,6,0.2)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#92400E", marginBottom: 6 }}>Humanitarian relevance</div>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: "#78350F", margin: 0 }}>
              In armed conflict, corridors are negotiated under IHL (Customary Rule 99; Art. 17 AP II) and may close at any moment due to ceasefire collapse, military advance, or checkpoint shutdown. The dynamic closing mechanic makes this time pressure visible and measurable: families that spend too long milling — because of elders, young children, or low information clarity — may never reach safety before the window closes. The gap between "finished milling" and "corridor still open" is the core humanitarian planning problem this feature models.
            </p>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function HowToUse() {
  const steps = [
    { n: 1, title: "Choose a scenario", body: "Select Pedestrian, Car, or Train. Each changes milling times and movement speeds." },
    { n: 2, title: "Set your parameters", body: "Open the ⚙ Parameters panel and adjust sliders. Each shows a live hint describing the effect." },
    { n: 3, title: "Run the simulation", body: "Press ▶ Run. Use Step for tick-by-tick observation. Hover a family to highlight it; click a node to inspect it. In Pedestrian and Car scenarios, configure exit corridors — toggle gates open/closed and set optional closing ticks — before pressing Run." },
    { n: 4, title: "Read the summary", body: "When complete, a summary panel shows per-phase timing, the slowest family, a bar chart of family timelines, and a Neighbour Influence section breaking down how the social and official channels drove evacuations." },
    { n: 5, title: "Compare runs", body: "Pin any run in the Run History panel. Subsequent runs show whether they are faster or slower than the pinned baseline." },
  ];
  return (
    <div style={{ background: "#fff", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Getting started
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 32, letterSpacing: "-0.3px" }}>
            How to use the simulation
          </h2>
        </FadeIn>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {steps.map((s, i) => (
            <FadeIn key={s.n} delay={i * 80}>
              <div style={{ display: "flex", gap: 16, paddingBottom: 24, borderLeft: i < steps.length - 1 ? "1.5px solid rgba(24,95,165,0.15)" : "none", paddingLeft: 24, position: "relative" }}>
                <div style={{
                  position: "absolute", left: -12, top: 0,
                  width: 22, height: 22, borderRadius: "50%",
                  background: "#185FA5", color: "#fff",
                  fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1e36", marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 12, lineHeight: 1.7, color: "#5a5a55" }}>{s.body}</div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </div>
  );
}

function NeighbourInfluenceGuide() {
  const metrics = [
    {
      label: "Social events fired",
      color: "#D97706",
      body: "The total number of times the neighbour influence mechanism triggered during the run — i.e., how many times a member received a social confirmation from seeing an adjacent family mill or evacuate. A high count relative to total members suggests the social channel was very active. A count of zero means the Neighbour influence slider had no effect, or no families became active early enough to influence others.",
    },
    {
      label: "Socially confirmed",
      color: "#D97706",
      body: "The number of members whose final confirmation — the one that pushed them from Seeking into Milling — came from the social channel. This is the most meaningful metric: it counts how many people would not have evacuated (or would have evacuated later) without neighbour influence. High values mean the social channel was decision-critical, not just supplementary.",
    },
    {
      label: "Officially confirmed",
      color: "#185FA5",
      body: "Members whose final confirmation came from the official information node. When this number is high relative to social confirmations, it means households were persuaded primarily by the broadcast rather than by watching neighbours. This typically occurs when Info clarity is high or Neighbour influence is low.",
    },
    {
      label: "Dominant channel",
      color: "#3d3d3a",
      body: "A single label — 🔵 Official or 🟡 Social — indicating which channel drove more final confirmations across the whole run. This is the headline finding for the information-flow question the simulation is designed to explore. Varying the Neighbour influence and Info clarity sliders changes which channel dominates and how that affects total evacuation time.",
    },
    {
      label: "Channel split bar",
      color: "#3d3d3a",
      body: "A horizontal bar divided into blue (official) and amber (social) segments, proportional to the share of members confirmed by each channel. A bar that is mostly blue means the broadcast drove evacuations; mostly amber means social contagion dominated. Compare this bar across runs with different Neighbour influence settings to see how sensitive the community is to social dynamics.",
    },
    {
      label: "Per-family breakdown",
      color: "#3d3d3a",
      body: "One bar per family showing that family's own official-vs-social split. Families with many elders tend to rely more on official confirmations (they need one extra and are slower to be influenced socially). Families that are well-connected in the neighbour network — positioned between several milling households — are more likely to be socially driven. This view reveals which specific households were the social tipping points.",
    },
  ];

  return (
    <div style={{ background: "#fff", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#D97706", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Reading the results
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 8, letterSpacing: "-0.3px" }}>
            Neighbour influence summary panel
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "#5a5a55", marginBottom: 32, maxWidth: 560 }}>
            After the simulation completes, the summary panel includes a <strong>Neighbour Influence</strong> section that answers the core research question: was it the official broadcast or social contagion that actually drove evacuations? Here is what each metric means.
          </p>
        </FadeIn>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {metrics.map((m, i) => (
            <FadeIn key={m.label} delay={i * 60}>
              <div style={{ display: "flex", gap: 16, padding: "14px 16px", background: "#f8f7f4", borderRadius: 10, borderLeft: `3px solid ${m.color}` }}>
                <div style={{ minWidth: 160, flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: m.color, lineHeight: 1.4 }}>{m.label}</div>
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.75, color: "#5a5a55" }}>{m.body}</div>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={400}>
          <div style={{ marginTop: 24, background: "#FEF3E2", borderRadius: 10, padding: "14px 16px", border: "0.5px solid rgba(217,119,6,0.2)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#92400E", marginBottom: 6 }}>Research tip</div>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: "#78350F", margin: 0 }}>
              To isolate the social channel's effect: run once with Neighbour influence at 0%, then again at a high value (70–100%) with all other parameters identical. The difference in total ticks and dominant channel between those two runs directly quantifies how much social contagion is accelerating — or could accelerate — evacuation in your modelled community.
            </p>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function TicksGuide() {
  return (
    <div style={{ background: "#f8f7f4", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Reading the results
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 8, letterSpacing: "-0.3px" }}>
            Understanding ticks
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "#5a5a55", marginBottom: 32, maxWidth: 560 }}>
            Every timing number in the simulation — summary stats, event log entries, phase durations — is expressed in ticks. Here is what that means and how to use those numbers.
          </p>
        </FadeIn>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            {
              title: "What is a tick?",
              body: "A tick is the simulation's discrete time step. On each tick, every member is checked for a status transition: could they receive an alert? Have they collected enough confirmations? Have they finished milling? Each tick is one pass through that logic for all members simultaneously.",
            },
            {
              title: "Why not real minutes?",
              body: "The timing values in this model — milling delays, confirmation counts, movement speeds — were chosen to produce realistic relative behaviour, not calibrated to measured real-world durations. Labelling ticks as minutes would imply a precision the model does not have. Ticks are honest about that.",
            },
            {
              title: "How fast is a tick?",
              body: "At normal speed, the simulation advances one tick every 200 ms of real time — roughly 5 ticks per second. The Step button advances one tick at a time. The total tick count when a run completes is shown in the summary header and in the Run History panel.",
            },
            {
              title: "What do tick counts tell you?",
              body: "Tick counts are most meaningful as relative comparisons. A run that completes in 28 ticks is faster than one that completes in 42 ticks under the same parameters. The summary's average phase durations (e.g. \"Avg. milling 6t\") show where time is being lost — large milling values point to preparation bottlenecks, large seeking values to information bottlenecks.",
            },
          ].map((c, i) => (
            <FadeIn key={c.title} delay={i * 60}>
              <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid rgba(0,0,0,0.1)", padding: "16px 18px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f1e36", marginBottom: 6 }}>{c.title}</div>
                <p style={{ fontSize: 12, lineHeight: 1.75, color: "#5a5a55", margin: 0 }}>{c.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={280}>
          <div style={{ background: "#fff", borderRadius: 10, border: "0.5px solid rgba(0,0,0,0.1)", padding: "16px 18px", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f1e36", marginBottom: 8 }}>How ticks appear in the interface</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { where: "Tick counter (controls bar)", what: "Shows the current tick as the simulation runs. Resets to 0 on Reset." },
                { where: "Event log",                   what: "Each entry is prefixed with the tick it occurred on, e.g. t12 Rivera evacuating. Lets you trace the exact sequence of events." },
                { where: "Node tooltip",                what: "\"In phase: 4 ticks\" shows how long the clicked member has been in their current status." },
                { where: "Summary — phase averages",    what: "Avg. seeking, milling, and evac values are the mean ticks each member spent in that phase across the whole run." },
                { where: "Summary — family bar chart",  what: "Bar segment widths are proportional to average ticks per phase. Longer segments = more time spent. Hover for exact values." },
                { where: "Run history",                 what: "Each row shows total ticks to completion, making cross-run comparison instant." },
              ].map(row => (
                <div key={row.where} style={{ display: "flex", gap: 12, paddingBottom: 8, borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", minWidth: 180, flexShrink: 0 }}>{row.where}</span>
                  <span style={{ fontSize: 11, lineHeight: 1.65, color: "#5a5a55" }}>{row.what}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={360}>
          <div style={{ background: "#E6F1FB", borderRadius: 10, padding: "14px 16px", border: "0.5px solid rgba(24,95,165,0.2)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#0C447C", marginBottom: 6 }}>Comparing runs using ticks</div>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: "#185FA5", margin: 0 }}>
              The most productive use of tick counts is parameter comparison. Pin a baseline run, then change a single slider and run again. The summary will show "N ticks faster/slower than pinned." Because all other conditions are identical, that difference isolates the effect of the one parameter you changed — making ticks a reliable unit of comparison even if they do not map to a specific real-world duration.
            </p>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function Research() {
  return (
    <div style={{ background: "#f8f7f4", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Research background
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 24, letterSpacing: "-0.3px" }}>
            Grounded in disaster sociology
          </h2>
        </FadeIn>
        <div style={{ display: "flex", gap: 14 }}>
          {[
            {
              name: "Enrico Quarantelli",
              org: "Disaster Research Center, U. Delaware",
              body: "Established that people rarely panic during disasters — they mill: seeking confirmation from multiple sources before accepting a threat as real. His concept of warning response directly inspired the confirmation-seeking mechanics in this model.",
            },
            {
              name: "Thomas Drabek",
              org: "University of Denver",
              body: "Documented that families evacuate as units, not individuals — they wait until all members are present before departing. His research on household decision-making, tourist evacuations, and elder vulnerability underpins the hub and age mechanics.",
            },
          ].map((r, i) => (
            <FadeIn key={r.name} delay={i * 100} style={{ flex: 1 }}>
              <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid rgba(0,0,0,0.1)", padding: "18px 18px 20px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f1e36", marginBottom: 2 }}>{r.name}</div>
                <div style={{ fontSize: 10, color: "#737069", marginBottom: 10 }}>{r.org}</div>
                <p style={{ fontSize: 12, lineHeight: 1.75, color: "#5a5a55", margin: 0 }}>{r.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={200}>
          <p style={{ fontSize: 11, color: "#999895", marginTop: 20, lineHeight: 1.7 }}>
            Timing values in this simulation are qualitative approximations inspired by this research, not calibrated empirical measurements. For calibrated models, consult FEMA evacuation timing studies and peer-reviewed agent-based evacuation literature.
          </p>
        </FadeIn>
      </div>
    </div>
  );
}

function IHLBackground() {
  return (
    <div style={{ background: "#f8f7f4", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Legal framework
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 8, letterSpacing: "-0.3px" }}>
            International Humanitarian Law and evacuation
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "#5a5a55", marginBottom: 28, maxWidth: 560 }}>
            Humanitarian evacuations in armed conflict are governed by IHL — the body of law that regulates the conduct of hostilities and protects persons who are not, or are no longer, participating in fighting. The simulation's mechanics connect directly to specific IHL obligations.
          </p>
        </FadeIn>

        {/* Primary provisions — two-column cards matching Research section style */}
        <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
          {[
            {
              name: "Voluntary evacuation vs forced displacement",
              ref: "Art. 17(1) AP II — Customary IHL Rule 129",
              body: "IHL strictly distinguishes between voluntary civilian movement for safety and forced displacement ordered by a party to the conflict. Forced displacement is prohibited — it is a war crime. This simulation models only the voluntary case: households decide whether and when to leave based on information received, not coercion. The corridor system can model what happens when the choice is structurally removed.",
            },
            {
              name: "Obligation to facilitate civilian movement",
              ref: "Art. 58 AP I — Art. 17 AP II",
              body: "Parties to a conflict must take precautionary measures to protect civilian populations, including facilitating evacuation when possible. The simulation's information node — broadcasting alerts and delivering confirmations — represents this obligation in practice. Low info clarity models its failure: a party that does not communicate clearly, consistently, or at all.",
            },
          ].map((r, i) => (
            <FadeIn key={r.name} delay={i * 100} style={{ flex: 1 }}>
              <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid rgba(0,0,0,0.1)", padding: "18px 18px 20px", height: "100%" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f1e36", marginBottom: 2 }}>{r.name}</div>
                <div style={{ fontSize: 10, color: "#737069", marginBottom: 10 }}>{r.ref}</div>
                <p style={{ fontSize: 12, lineHeight: 1.75, color: "#5a5a55", margin: 0 }}>{r.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
          {[
            {
              name: "Special protection for vulnerable persons",
              ref: "GC IV Art. 23 — AP I Arts. 8–17 — Customary Rule 138",
              body: "IHL accords specific protection to the wounded and sick, children, pregnant women, and elderly persons — requiring that they receive priority in evacuation and humanitarian assistance. The simulation's elder and child mechanics directly reflect these categories: slower milling, slower movement, and greater sensitivity to information quality and corridor availability.",
            },
            {
              name: "Humanitarian access and the two-channel model",
              ref: "AP I Art. 70 — Customary IHL Rule 55",
              body: "Parties must allow and facilitate the passage of humanitarian relief for civilians in need. In practice this means access for organisations like the ICRC — a distinct, neutral information channel operating alongside official government broadcasts. The simulation's two-channel model (official broadcast and social influence) can be extended to represent this third actor, whose access being granted or denied changes the information environment entirely.",
            },
          ].map((r, i) => (
            <FadeIn key={r.name} delay={i * 100 + 200} style={{ flex: 1 }}>
              <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid rgba(0,0,0,0.1)", padding: "18px 18px 20px", height: "100%" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f1e36", marginBottom: 2 }}>{r.name}</div>
                <div style={{ fontSize: 10, color: "#737069", marginBottom: 10 }}>{r.ref}</div>
                <p style={{ fontSize: 12, lineHeight: 1.75, color: "#5a5a55", margin: 0 }}>{r.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
          {[
            {
              name: "Prohibition on siege as a method of warfare",
              ref: "Customary IHL Rule 53 — AP I Art. 54",
              body: "Deliberately starving or besieging a civilian population — which includes cutting off evacuation routes — is prohibited as a method of warfare. The corridor blocking mechanic models this situation: when all exits are closed, trapped members are precisely those whom this rule is designed to protect. The visual gap between families who evacuated and families who were trapped is a direct representation of what IHL is trying to prevent.",
            },
            {
              name: "Effective advance warning",
              ref: "AP I Art. 57(2)(c) — Customary IHL Rule 20",
              body: "Before an attack that may affect civilians, parties must give effective advance warning unless circumstances do not permit. The simulation's threat level and info clarity sliders together model the quality of this warning: a high-threat, low-clarity scenario represents one where a warning was issued but was too vague or unreliable for households to act on — a pattern well-documented in recent conflicts.",
            },
          ].map((r, i) => (
            <FadeIn key={r.name} delay={i * 100 + 400} style={{ flex: 1 }}>
              <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid rgba(0,0,0,0.1)", padding: "18px 18px 20px", height: "100%" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f1e36", marginBottom: 2 }}>{r.name}</div>
                <div style={{ fontSize: 10, color: "#737069", marginBottom: 10 }}>{r.ref}</div>
                <p style={{ fontSize: 12, lineHeight: 1.75, color: "#5a5a55", margin: 0 }}>{r.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={500}>
          <p style={{ fontSize: 11, color: "#999895", marginTop: 6, lineHeight: 1.7 }}>
            Treaty references: AP I — 1977 Additional Protocol I to the Geneva Conventions; AP II — 1977 Additional Protocol II; GC IV — 1949 Geneva Convention IV. Customary IHL Rules refer to the ICRC Customary IHL Study (Henckaerts &amp; Doswald-Beck, 2005). This simulation does not constitute legal advice and is intended for educational and research purposes only.
          </p>
        </FadeIn>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function AboutPage({ onLaunch }) {
  return (
    <div style={{ color: "#3d3d3a" }}>

      {/* Hero */}
      <div style={{ background: "#0f1e36", color: "#fff", padding: "72px 16px 80px", textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(55,138,221,0.9)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
            Agent-based evacuation model
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1.2, marginBottom: 18 }}>
            How information flow shapes who evacuates — and when
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.85, opacity: 0.78, marginBottom: 32, maxWidth: 460, margin: "0 auto 32px" }}>
            An interactive simulation showing that evacuation failures are rarely about the will to leave. They happen when alerts arrive late, confirmations are scarce, and households with elders or young children can't keep pace.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onLaunch} style={{
              padding: "10px 24px", fontSize: 13, fontWeight: 700, borderRadius: 8,
              border: "none", cursor: "pointer", background: "#378ADD", color: "#fff",
            }}>
              ▶ Open Simulation
            </button>
            <a href="#how-it-works" onClick={e => { e.preventDefault(); document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" }); }}
              style={{ padding: "10px 24px", fontSize: 13, fontWeight: 500, borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.85)", cursor: "pointer", textDecoration: "none", display: "inline-block" }}>
              Read the guide ↓
            </a>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div id="how-it-works">
        <StickyPhases />
      </div>
      <Channels />
      <PopulationFactors />
      <ScenariosSection />
      <CorridorGuide />
      <HowToUse />
      <NeighbourInfluenceGuide />
      <TicksGuide />
      <Research />
      <IHLBackground />

      {/* Final CTA */}
      <div style={{ background: "#0f1e36", padding: "56px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 20 }}>
          Ready to explore?
        </p>
        <button onClick={onLaunch} style={{
          padding: "11px 28px", fontSize: 13, fontWeight: 700, borderRadius: 8,
          border: "none", cursor: "pointer", background: "#378ADD", color: "#fff",
        }}>
          ▶ Open Simulation
        </button>
      </div>

    </div>
  );
}
