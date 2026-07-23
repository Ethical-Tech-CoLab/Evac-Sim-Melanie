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

      {/* Corridor gates — exit routes at canvas edges */}
      {[
        { id: 'N', cx: 140, cy: 11,  w: 20, h:  9 },
        { id: 'S', cx: 140, cy: 257, w: 20, h:  9 },
        { id: 'E', cx: 270, cy: 140, w:  9, h: 20 },
        { id: 'W', cx: 10,  cy: 140, w:  9, h: 20 },
      ].map(g => {
        const active = step >= 3;
        return (
          <g key={g.id} style={{ opacity: active ? 1 : 0.28, transition: "opacity 0.5s" }}>
            <rect
              x={g.cx - g.w / 2} y={g.cy - g.h / 2}
              width={g.w} height={g.h} rx={2}
              fill={active ? "rgba(29,158,117,0.22)" : "rgba(140,138,130,0.1)"}
              stroke={active ? "#1D9E75" : "rgba(140,138,130,0.35)"}
              strokeWidth={active ? 1.2 : 0.8}
              style={{ transition: "all 0.5s" }}
            />
            <text x={g.cx} y={g.cy} textAnchor="middle" dominantBaseline="middle"
              fontSize="6" fontWeight="700"
              fill={active ? "#0F6E56" : "#9a9891"}
              style={{ transition: "fill 0.5s" }}
            >{g.id}</text>
          </g>
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
      {/* Aid arc — humanitarian confirmation (step 2) */}
      {step === 2 && (
        <line x1={18} y1={26} x2={featured.x} y2={featured.y}
          stroke="#1D9E75" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.8} />
      )}

      {/* Aid node — humanitarian actor (upper-left) */}
      <g>
        <circle cx={18} cy={18}
          r={step === 2 ? 10 : 8}
          fill={step === 2 ? "#1D9E75" : "rgba(29,158,117,0.12)"}
          stroke="#1D9E75"
          strokeWidth={step >= 1 ? 1.4 : 0.7}
          style={{ transition: "all 0.5s" }}
        />
        <text x={18} y={18} textAnchor="middle" dominantBaseline="middle"
          fontSize="7" fontWeight="600"
          fill={step === 2 ? "#fff" : "#0F6E56"}
          style={{ transition: "fill 0.5s" }}
        >Aid</text>
      </g>

      {/* Info node hexagon */}
      <polygon points={hexPts(CX, CY, step === 1 ? 18 : 14)}
        fill={step === 1 ? "#185FA5" : "rgba(55,138,221,0.15)"}
        stroke="#185FA5" strokeWidth={step === 1 ? 1.8 : 0.8}
        style={{ transition: "all 0.5s" }}
      />
      <text x={CX} y={CY + 4} textAnchor="middle" fontSize="9" fontWeight="500"
        fill={step === 1 ? "#fff" : "#0C447C"}>Govt</text>

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

function ShapeSwatch({ fill, str, shape }) {
  if (shape === "diamond") return (
    <span style={{ width: 10, height: 10, flexShrink: 0, display: "inline-block",
      background: fill, transform: "rotate(45deg)", border: `1px solid ${str}`, boxSizing: "border-box" }} />
  );
  if (shape === "triangle") return (
    <span style={{ width: 10, height: 10, flexShrink: 0, display: "inline-block",
      background: fill, clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" }} />
  );
  if (shape === "circle-cross") return (
    <span style={{ position: "relative", width: 11, height: 11, flexShrink: 0, display: "inline-block" }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: fill, border: `1px solid ${str}` }} />
      <svg viewBox="0 0 11 11" style={{ position: "absolute", inset: 0, width: 11, height: 11 }}>
        <line x1="3" y1="5.5" x2="8" y2="5.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="5.5" y1="3" x2="5.5" y2="8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  );
  return (
    <span style={{ width: 10, height: 10, flexShrink: 0, display: "inline-block",
      background: fill, borderRadius: "50%", border: `1px solid ${str}` }} />
  );
}

function PopulationFactors() {
  const bars = [
    { label: "Adult",           millingExtra: 0,   speed: 2.6, fill: "#888780", str: "#5F5E5A",  shape: "circle" },
    { label: "Elder",           millingExtra: 3.5, speed: 1.8, fill: "#7F77DD", str: "#534AB7",  shape: "circle" },
    { label: "Child <5",        millingExtra: 4.5, speed: 1.5, fill: "#D4537E", str: "#993556",  shape: "diamond" },
    { label: "Pregnant",        millingExtra: 3.5, speed: 2.0, fill: "#0891B2", str: "#0E7490",  shape: "circle-cross" },
    { label: "Unaccomp. minor", millingExtra: 9.0, speed: 1.5, fill: "#EA580C", str: "#C2410C",  shape: "triangle" },
  ];
  const maxMill = 9.0, maxSpeed = 2.6;

  return (
    <div style={{ background: "#fff", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Population factors
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 8, letterSpacing: "-0.3px" }}>
            Vulnerability shapes the timeline
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "#5a5a55", marginBottom: 32, maxWidth: 520 }}>
            IHL-protected population categories — elders, children under 5, pregnant women, and unaccompanied minors — each have distinct mobility and preparation constraints that extend milling time and slow movement. The hub waits for its slowest member, so a single vulnerable individual can delay an entire household. Each type has its own canvas symbol.
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
                  <ShapeSwatch fill={b.fill} str={b.str} shape={b.shape} />
                  <span style={{ fontSize: 11, color: "#3d3d3a", minWidth: 90 }}>{b.label}</span>
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
                  <ShapeSwatch fill={b.fill} str={b.str} shape={b.shape} />
                  <span style={{ fontSize: 11, color: "#3d3d3a", minWidth: 90 }}>{b.label}</span>
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

function HumanitarianActorGuide() {
  return (
    <div style={{ background: "#fff", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#0F6E56", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Humanitarian actor
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 8, letterSpacing: "-0.3px" }}>
            A third information channel
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "#5a5a55", marginBottom: 28, maxWidth: 560 }}>
            The <strong>Humanitarian access</strong> slider introduces a distinct humanitarian actor node alongside the official government broadcast. It represents neutral actors such as the ICRC, UNHCR, or NGO coordination bodies — organisations with their own comms networks, higher inherent reliability, but operational reach constrained by access negotiations with parties to the conflict.
          </p>
        </FadeIn>

        {/* Humanitarian vs official comparison */}
        <FadeIn delay={60}>
          <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
            {[
              {
                icon: "🔵",
                title: "Official broadcast",
                col: "#185FA5",
                bg: "#E6F1FB",
                points: [
                  "Reliability set by the Info clarity slider",
                  "Reaches all households simultaneously",
                  "Represents government / military authority channel",
                  "May be contested, weaponised, or ignored",
                ],
              },
              {
                icon: "🟢",
                title: "Humanitarian actor",
                col: "#0F6E56",
                bg: "#E6F7F0",
                points: [
                  "Fixed higher reliability (75%) independent of clarity",
                  "Reach limited by the Humanitarian access slider",
                  "Represents ICRC / UNHCR / humanitarian coordination",
                  "High access = full reach; low access = constrained by parties",
                ],
              },
            ].map(c => (
              <FadeIn key={c.title} style={{ flex: 1 }}>
                <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid rgba(0,0,0,0.1)", overflow: "hidden", height: "100%" }}>
                  <div style={{ background: c.bg, padding: "12px 16px", borderBottom: "0.5px solid rgba(0,0,0,0.07)" }}>
                    <span style={{ fontSize: 18, marginRight: 7 }}>{c.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: c.col }}>{c.title}</span>
                  </div>
                  <ul style={{ margin: 0, padding: "12px 16px 14px 28px", listStyle: "disc" }}>
                    {c.points.map(p => (
                      <li key={p} style={{ fontSize: 11, lineHeight: 1.75, color: "#5a5a55" }}>{p}</li>
                    ))}
                  </ul>
                </div>
              </FadeIn>
            ))}
          </div>
        </FadeIn>

        {/* How to configure */}
        <FadeIn delay={100}>
          <div style={{ background: "#f8f7f4", borderRadius: 12, padding: "18px 20px", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f1e36", marginBottom: 12 }}>How to configure it</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                {
                  step: "1", col: "#0F6E56",
                  title: "Set Humanitarian access (0–100%)",
                  body: "Open ⚙ Parameters and drag the Humanitarian access slider. At 0% the feature is off — only the official broadcast and social channel operate. At 40% roughly four in ten household members can be reached by the humanitarian actor. At 100% the actor reaches every member.",
                },
                {
                  step: "2", col: "#0F6E56",
                  title: "Run — watch for green arcs",
                  body: "When the simulation runs, green arcs flow from the Aid node (upper-left corner of the canvas) to reachable members. Green confirmation flashes at a member's position mean the humanitarian actor drove their final confirmation. Blue flashes remain for officially-confirmed members.",
                },
                {
                  step: "3", col: "#0F6E56",
                  title: "Read the Channel Trust Metric",
                  body: "After the run, the summary panel's Neighbour Influence section includes a Channel Trust Metric block. It shows the government-vs-humanitarian institutional split and interprets the result: high humanitarian share signals strong access and trust; low share signals access restrictions or credibility deficits.",
                },
              ].map((s, i) => (
                <div key={s.step} style={{ display: "flex", gap: 14, paddingBottom: i < 2 ? 10 : 0, borderBottom: i < 2 ? "0.5px solid rgba(0,0,0,0.06)" : "none" }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    background: s.col, color: "#fff",
                    fontSize: 11, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{s.step}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#0f1e36", marginBottom: 3 }}>{s.title}</div>
                    <div style={{ fontSize: 12, lineHeight: 1.7, color: "#5a5a55" }}>{s.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Canvas visuals */}
        <FadeIn delay={150}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0f1e36", marginBottom: 10 }}>What you see on the canvas</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
            {[
              { swatch: "#1D9E75", label: "Aid node (upper-left)", desc: "The humanitarian actor node. Idle when no reachable members are active; pulses and fills green when households it can reach have entered seeking or milling. Shows the configured access percentage below it." },
              { swatch: "#1D9E75", label: "Green arcs",            desc: "Dashed arcs from the Aid node to a member mean the humanitarian actor sent that member an alert or a confirmation. Green flashes at a member's position confirm the aid channel drove their final confirmation." },
              { swatch: "#378ADD", label: "Blue arcs / flashes",   desc: "Unchanged — still indicate official government broadcast alerts and confirmations, as before." },
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

        {/* Channel Trust Metric */}
        <FadeIn delay={200}>
          <div style={{ background: "#f8f7f4", borderRadius: 12, padding: "16px 18px", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f1e36", marginBottom: 8 }}>Channel Trust Metric — reading the summary</div>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: "#5a5a55", margin: "0 0 10px 0" }}>
              The post-run summary adds a <strong>Channel Trust Metric</strong> block inside the Neighbour Influence section. It compares only the two <em>institutional</em> channels — government broadcast and humanitarian actor — and shows which drove the greater share of final confirmations.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                {
                  state: "Humanitarian dominant",
                  col: "#0F6E56",
                  bg: "#E6F7F0",
                  desc: "The aid actor drove more final confirmations than the official broadcast. This models a situation of high field access and strong community trust in the humanitarian organisation — households found the aid channel more persuasive than the government channel.",
                },
                {
                  state: "Government dominant",
                  col: "#185FA5",
                  bg: "#E6F1FB",
                  desc: "The official broadcast drove more confirmations. The humanitarian actor had lower impact — either because access was constrained (low slider setting) or because the official channel was sufficiently clear and credible that the aid channel could not add further confirmations before members crossed the threshold.",
                },
                {
                  state: "Aid confirmed = 0",
                  col: "#737069",
                  bg: "#f1efe8",
                  desc: "The humanitarian actor reached households but drove no final confirmations at all. The official broadcast or social channel always got there first. This can happen even at moderate access levels if Info clarity is high — it models a situation where aid organisations are present but their information adds nothing to what official channels already delivered.",
                },
              ].map(s => (
                <div key={s.state} style={{ display: "flex", gap: 12, padding: "10px 12px", background: s.bg, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: s.col, minWidth: 150, flexShrink: 0, paddingTop: 1 }}>{s.state}</div>
                  <div style={{ fontSize: 11, lineHeight: 1.7, color: "#5a5a55" }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* IHL callout */}
        <FadeIn delay={260}>
          <div style={{ background: "#FEF3E2", borderRadius: 10, padding: "14px 16px", border: "0.5px solid rgba(217,119,6,0.2)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#92400E", marginBottom: 6 }}>Humanitarian relevance</div>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: "#78350F", margin: 0 }}>
              Under AP I Art. 70 and Customary IHL Rule 55, parties must allow and facilitate the passage of humanitarian relief for civilians in need. In practice this means operational access for ICRC, UNHCR, and other neutral actors — access that is frequently denied, delayed, or conditionalised. The Humanitarian access slider directly models this: setting it below 100% represents a party restricting the humanitarian actor's reach. The Channel Trust Metric then shows what that restriction costs: fewer households reached, more reliance on official or social channels, and — where official clarity is also low — a slower, incomplete evacuation cascade. The gap between "humanitarian actor present" and "humanitarian actor influential" is the operational cost of access restrictions made visible.
            </p>
          </div>
        </FadeIn>
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
                {
                  label: "opens t: field",
                  col: "#185FA5",
                  body: "Enter a tick number to schedule a corridor opening. The corridor starts the run closed and automatically opens at that tick — shown on canvas as an amber gate with an \"opens t:N\" label. Combine with a closes t: value to model a full ceasefire window: e.g. opens t:15, closes t:35 gives a 20-tick humanitarian window. Families who do not complete milling before the window closes may be trapped.",
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
              { swatch: "#F59E0B", label: "Amber gate (closing soon)",   desc: "Corridor is open but will close within 5 ticks. A closing-time label (e.g. \"closes t:20\") appears near the gate." },
              { swatch: "#D97706", label: "Amber gate + opens t:N",   desc: "Corridor has a scheduled opening — it starts closed and will open at the stated tick. Used to model ceasefire windows. The gate turns green with a ripple when the tick arrives." },
              { swatch: "#DC2626", label: "Red gate + ✕", desc: "Corridor is closed or has been closed mid-run. A BLOCKED label appears alongside it." },
              { swatch: "#DC2626", label: "Red ripple",   desc: "Emitted from the gate at the moment of mid-run closure — a brief visual alert so the event is never missed." },
              { swatch: "#1D9E75", label: "Green ripple", desc: "Emitted from the gate when a scheduled corridor opens — the ceasefire window is now active." },
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
              In armed conflict, corridors are negotiated under IHL (GC IV Art. 17; Customary Rules 55-56; Art. 17 AP II) and may close at any moment due to ceasefire collapse, military advance, or checkpoint shutdown. The dynamic closing mechanic makes this time pressure visible and measurable: families that spend too long milling — because of elders, young children, or low information clarity — may never reach safety before the window closes. The gap between "finished milling" and "corridor still open" is the core humanitarian planning problem this feature models.
            </p>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function DynamicThreatGuide() {
  return (
    <div style={{ background: "#f8f7f4", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Dynamic threat
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 8, letterSpacing: "-0.3px" }}>
            Simulating an escalating emergency
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "#5a5a55", marginBottom: 28, maxWidth: 560 }}>
            By default the threat level stays fixed for the whole run. The <strong>Threat rise rate</strong> slider changes that: the effective threat increases every tick, compressing the window in which families can safely evacuate. Households that delay — because of milling, low information clarity, or vulnerable members — face a progressively more dangerous environment.
          </p>
        </FadeIn>

        {/* How to set it */}
        <FadeIn delay={60}>
          <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid rgba(0,0,0,0.1)", padding: "18px 20px", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f1e36", marginBottom: 12 }}>How to use it</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                {
                  step: "1",
                  title: "Open the Parameters panel",
                  body: "Click ⚙ Parameters at the bottom of the simulation page to expand the slider panel.",
                },
                {
                  step: "2",
                  title: "Set your base Threat level",
                  body: "Choose a starting threat using the Threat level slider (1–10). With dynamic escalation active, this is the level at tick 0 — the threat will rise from here.",
                },
                {
                  step: "3",
                  title: "Set the Threat rise rate",
                  body: "Drag the Threat rise rate slider (0–20). The live hint below the slider shows how many ticks it takes for the threat to rise by one level at the chosen rate. A rate of 0 leaves threat static.",
                },
                {
                  step: "4",
                  title: "Press Run and watch the canvas",
                  body: "When the rise rate is above 0, a red ▲ Threat N.N/10 indicator appears at the top-right of the canvas and grows brighter as the threat climbs. Families that are still milling or seeking when threat reaches 9–10 will find alerts spreading to the remaining unaware households very rapidly.",
                },
              ].map((s, i) => (
                <div key={s.step} style={{ display: "flex", gap: 14, paddingBottom: i < 3 ? 10 : 0, borderBottom: i < 3 ? "0.5px solid rgba(0,0,0,0.06)" : "none" }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    background: "#185FA5", color: "#fff",
                    fontSize: 11, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{s.step}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#0f1e36", marginBottom: 3 }}>{s.title}</div>
                    <div style={{ fontSize: 12, lineHeight: 1.7, color: "#5a5a55" }}>{s.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Rate guide */}
        <FadeIn delay={120}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#0f1e36", marginBottom: 10 }}>Choosing a rise rate</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
            {[
              { range: "0",    label: "Static",   col: "#737069", desc: "No escalation. Threat stays at the base level for the full run. Default behaviour." },
              { range: "1–5",  label: "Slow",     col: "#185FA5", desc: "Threat rises roughly +1 level every 20–100 ticks. Good for long runs where the pressure builds gradually — useful for studying whether social contagion can drive evacuations before the official alert becomes critical." },
              { range: "6–12", label: "Moderate", col: "#BA7517", desc: "Threat rises +1 level every 8–16 ticks. The most informative range for most scenarios. Families with elders or young children who mill for 6–10 extra ticks will noticeably fall behind families without." },
              { range: "13–20",label: "Fast",     col: "#A32D2D", desc: "Threat surges rapidly — +1 level every 5 ticks or faster. Models a front line advancing quickly or an imminent aerial threat. Most families must evacuate very early or risk being caught at maximum threat level." },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", gap: 12, padding: "8px 12px", background: "#fff", borderRadius: 8, alignItems: "center" }}>
                <div style={{ minWidth: 40, fontSize: 10, color: "#737069", textAlign: "center", background: "#f8f7f4", borderRadius: 4, padding: "3px 6px", fontFamily: "monospace" }}>{row.range}</div>
                <div style={{ minWidth: 60, fontSize: 11, fontWeight: 700, color: row.col }}>{row.label}</div>
                <div style={{ fontSize: 11, lineHeight: 1.65, color: "#5a5a55" }}>{row.desc}</div>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Combining with corridors */}
        <FadeIn delay={180}>
          <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid rgba(0,0,0,0.1)", padding: "16px 18px", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f1e36", marginBottom: 8 }}>Combining with corridor blocking</div>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: "#5a5a55", margin: 0 }}>
              The most powerful use of dynamic threat is in combination with the corridor closing mechanic. Set a moderate rise rate, then set one or two corridors to close mid-run. Families that begin milling late — because of elders, children, or low info clarity — may find both the threat rising around them and their nearest corridor closing. This directly models the compressing humanitarian window: escalating danger plus shrinking exit options. The trapped-member count in the summary shows exactly how many households could not escape before both constraints converged.
            </p>
          </div>
        </FadeIn>

        {/* IHL callout */}
        <FadeIn delay={240}>
          <div style={{ background: "#FEF3E2", borderRadius: 10, padding: "14px 16px", border: "0.5px solid rgba(217,119,6,0.2)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#92400E", marginBottom: 6 }}>Humanitarian relevance</div>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: "#78350F", margin: 0 }}>
              Dynamic threat models situations where the warning period is finite and shrinking — a front line advancing toward a civilian area, an aerial campaign intensifying, or a siege tightening. Under AP I Art. 57(2)(c), parties must give effective advance warning before attacks that may affect civilians. A high rise rate with low starting threat models a situation where the warning was issued, but so late — or so unclearly — that vulnerable households could not complete the milling phase before the threat became critical. The simulation makes the cost of delayed or unclear warning immediately visible.
            </p>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function ArmedConflictGuide() {
  const features = [
    {
      num: "1",
      col: "#185FA5",
      bg: "#E6F1FB",
      tag: "Ceasefire corridor window",
      title: "Corridors that open on a schedule",
      where: "Corridor controls panel — each gate card has an \"opens t:\" field",
      body: `By default corridors start open (or permanently closed). Setting an "opens t:" value changes this: the corridor starts the run closed — shown as an amber gate with an "opens t:N" label — and opens automatically when the simulation reaches that tick, emitting a green ripple. Combine it with a "closes t:" value to model a full ceasefire window. For example, opens t:15, closes t:35 gives a 20-tick humanitarian passage. Families who have not finished milling by tick 35 face a closed gate when they try to evacuate. This makes milling delays directly consequential: the elder slowdown that costs 8 ticks in a static run can mean the difference between evacuation and entrapment when the window is narrow.`,
      visuals: [
        { swatch: "#D97706", label: "Amber gate + opens t:N", desc: "Corridor not yet open — will open at the stated tick." },
        { swatch: "#1D9E75", label: "Green ripple",           desc: "Fired when the window opens. Canvas logs: \"✅ North corridor opened — humanitarian window in effect\"." },
        { swatch: "#F59E0B", label: "Amber gate (closing soon)", desc: "Window is open but closes within 5 ticks — urgency indicator." },
      ],
      ihl: "No rule of IHL creates a general civilian right to leave a besieged area. GC IV Art. 17 requires parties to endeavour to conclude local agreements for the removal of the wounded, sick, infirm, aged, children and maternity cases; Customary Rules 55-56 require rapid and unimpeded passage of humanitarian relief and relief personnel; and Art. 17 AP II prohibits the forced movement of civilians in non-international armed conflict. The opens t: / closes t: window directly models a negotiated passage with a fixed validity — and shows what happens when it expires before every vulnerable household has completed the milling phase.",
    },
    {
      num: "2",
      col: "#D97706",
      bg: "#FEF3E2",
      tag: "Checkpoint delays",
      title: "Screening that slows evacuation",
      where: "Armed conflict sliders → Checkpoint delay (0–15 t)",
      body: `When this slider is above zero, 55% of members face a random delay of 1 to N ticks when they transition from milling to evacuation — representing security screening at a checkpoint on the route. The delay is added to their evacuation time before they begin moving. A value of 5 adds up to 5 ticks of hold. A value of 15 models a severely obstructed route where some members wait a long time before being cleared to move. The obstruction index in the Conflict metrics panel shows how many members were held.`,
      visuals: [
        { swatch: "#D97706", label: "Amber dot badge",        desc: "A small amber circle on any member currently in EVAC status who was held at a checkpoint." },
        { swatch: "#D97706", label: "Log entry",              desc: "\"t12 Baraka (Kim) held at checkpoint (+4t)\" — the exact delay is recorded per member." },
      ],
      ihl: "GC IV Art. 17 and Customary Rules 55-56 require parties to facilitate the removal of vulnerable civilians from besieged areas and the unimpeded passage of relief. Checkpoints are lawful for security screening but must not be used to block civilian evacuation. The slider models the operational reality: even \"lawful\" screening imposes delay that compounds across a population, and households with elders or young children — who are already slower — absorb the greatest harm from any added hold time.",
    },
    {
      num: "3",
      col: "#DC2626",
      bg: "#FEE2E2",
      tag: "Misinformation",
      title: "False confirmations that misdirect evacuees",
      where: "Armed conflict sliders → Misinformation (0–100%)",
      body: `During the SEEKING phase, each tick there is a probability (misinfoRate × 35%) that a member receives a false confirmation. False confirmations count toward the member's confirmation threshold just like genuine ones — they appear to satisfy the household's need for corroboration. But members whose final confirmation came from the misinformation channel are misdirected: when they transition to EVAC in a scenario with multiple open corridors, they are routed to a random non-nearest gate rather than the optimal one. This models being sent the wrong way — toward a blocked route or a longer path — because the information they acted on was false. At high misinformation rates, most confirmations are fabricated and most evacuees are misdirected. The channel split bar in the summary shows the misinformation share in red.`,
      visuals: [
        { swatch: "#DC2626", label: "Solid crimson arcs",    desc: "Misinformation confirmations are drawn as solid (not dashed) red arcs from the info node — visually distinct from dashed blue official arcs." },
        { swatch: "#DC2626", label: "Red flash",             desc: "A red confirmation flash at a member's position when the misinformation channel drives their final confirmation." },
        { swatch: "#DC2626", label: "Red segment in channel bar", desc: "The post-run channel split bar shows a red segment for misinfo-confirmed members alongside blue (official), green (humanitarian), and amber (social)." },
      ],
      ihl: "Article 37 AP I prohibits perfidy — acts designed to kill or injure by feigning civilian status or using protected symbols. Article 38 prohibits misuse of the Red Cross emblem. Deliberate false information about evacuation routes — issuing false \"all-clear\" messages or false corridor directions — falls squarely within this prohibition. The misinformation slider makes the consequence visible: households that received corroborated but false information may evacuate faster than those who received no information at all, but toward the wrong destination.",
    },
    {
      num: "4",
      col: "#737069",
      bg: "#F1EFE8",
      tag: "Infrastructure damage",
      title: "Degrading information clarity over time",
      where: "Armed conflict sliders → Infrastructure damage (0–20)",
      body: `Communication infrastructure — cell towers, broadcast transmitters, internet exchanges — is frequently destroyed in conflict. This slider models the progressive degradation of information clarity over the course of a run. At zero, clarity stays fixed. At higher values, effective clarity falls each tick: at a rate of 10, a starting clarity of 7/10 will have fallen to around 4/10 by tick 45. This means confirmations become harder to obtain as the run progresses. Families that delay — for any reason — find it increasingly difficult to receive the confirmations they need. The info node label on the canvas shows the current effective clarity with a ▼ indicator when degradation is active.`,
      visuals: [
        { swatch: "#737069", label: "clarity X.X/10 ▼",     desc: "The info node label shows degraded effective clarity. The value updates each tick." },
        { swatch: "#737069", label: "Slower confirmations",  desc: "Members in SEEKING phase receive confirmations less frequently as the run progresses — visible as longer gaps between confirmation log entries." },
      ],
      ihl: "Article 52 AP I and Customary IHL Rule 10 prohibit attacks on civilian objects (Rule 9 defines what a civilian object is; Rule 10 carries the prohibition), including communication infrastructure. When telecommunications infrastructure is destroyed — whether unlawfully targeted or as incidental damage — the information blackout that follows is a predictable humanitarian consequence. The infrastructure damage slider models this blackout and its compounding effect on late-moving households who are still seeking confirmation when clarity collapses.",
    },
    {
      num: "5",
      col: "#991B1B",
      bg: "#FEE2E2",
      tag: "Coercion risk",
      title: "Forced displacement — evacuation before voluntary confirmation",
      where: "Armed conflict sliders → Coercion risk (0–100%)",
      body: `IHL distinguishes sharply between voluntary evacuation — a household that chooses to leave after receiving and acting on information — and forced displacement, which is prohibited. When this slider is above zero, some UNAWARE members are bypassed into MILLING directly, without completing the information-seeking phase. The probability scales with the effective threat level: at low threat it rarely fires; at maximum threat with high coercion risk, a significant fraction of households depart before they have confirmed the situation. Coerced members appear immediately in MILLING at the tick they are forced out. They may evacuate faster than voluntary evacuees — but they left without completing preparation, without confirming the route was safe, and without choosing to go. Each coercion event is logged with the member's name, household, and the Art. 17 AP II reference. The Conflict metrics panel counts total forced displacements for the run.`,
      visuals: [
        { swatch: "#DC2626", label: "Solid red ring",        desc: "A persistent red circle around any member who was coerced — visible throughout MILLING and EVAC status." },
        { swatch: "#DC2626", label: "Red flash at coercion", desc: "A red flash fires at the member's position at the moment of forced departure." },
        { swatch: "#DC2626", label: "Log entry",             desc: "\"t8 ⚠ Amara (Hassan) [elder] coerced into evacuation — forced displacement (Art. 17 AP II)\"" },
      ],
      ihl: "Article 17(1) AP II and Customary IHL Rule 129 prohibit ordering the displacement of civilians unless required for their own security or imperative military reasons, and even then only temporarily. Forced displacement is a war crime under the Rome Statute (Art. 8(2)(e)(viii)). The coercion risk slider models the scenario where this violation is occurring: households are being moved before they have chosen to go. The Conflict metrics panel's \"Forced displacement\" count is the direct humanitarian performance indicator — a non-zero value represents documented IHL violations in the simulated scenario.",
    },
  ];

  return (
    <div style={{ background: "#fff", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#991B1B", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Armed conflict mechanics
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 8, letterSpacing: "-0.3px" }}>
            Checkpoints, misinformation, coercion, and ceasefire windows
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "#5a5a55", marginBottom: 28, maxWidth: 560 }}>
            The <strong>Armed conflict</strong> parameter group adds five mechanics that shift the simulation from a general disaster model to a conflict displacement model. Each can be used alone or combined. All five are grounded in IHL frameworks and humanitarian operational contexts. Find them in ⚙ Parameters under <em>Armed conflict</em>, and in the individual corridor gate controls.
          </p>
        </FadeIn>

        {features.map((f, i) => (
          <FadeIn key={f.num} delay={i * 80}>
            <div style={{ background: f.bg, borderRadius: 12, padding: "18px 20px", marginBottom: 14, border: `0.5px solid ${f.col}22` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  background: f.col, color: "#fff",
                  fontSize: 12, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{f.num}</div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: f.col, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{f.tag}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f1e36", lineHeight: 1.3 }}>{f.title}</div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: "#737069", marginBottom: 8, fontStyle: "italic" }}>Control: {f.where}</div>

              <p style={{ fontSize: 12, lineHeight: 1.8, color: "#5a5a55", margin: "0 0 14px 0" }}>{f.body}</p>

              <div style={{ fontSize: 11, fontWeight: 700, color: "#3d3d3a", marginBottom: 6 }}>Canvas visuals</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
                {f.visuals.map(v => (
                  <div key={v.label} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: v.swatch, flexShrink: 0, marginTop: 3 }} />
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#3d3d3a" }}>{v.label} — </span>
                      <span style={{ fontSize: 11, color: "#5a5a55", lineHeight: 1.6 }}>{v.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: `0.5px solid ${f.col}33`, paddingTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: f.col, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>IHL relevance</div>
                <p style={{ fontSize: 11, lineHeight: 1.7, color: "#5a5a55", margin: 0 }}>{f.ihl}</p>
              </div>
            </div>
          </FadeIn>
        ))}

        {/* Combined effects */}
        <FadeIn delay={460}>
          <div style={{ background: "#f8f7f4", borderRadius: 12, padding: "16px 18px", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f1e36", marginBottom: 8 }}>Combining the features</div>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: "#5a5a55", margin: "0 0 8px 0" }}>
              The most instructive runs combine multiple armed conflict mechanics. Try:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { label: "Ceasefire window + coercion", desc: "Set opens t:10, closes t:30 on one corridor; set coercion risk to 40%. Coerced households depart immediately and use the corridor while it's open. Voluntary households that take time to mill may find the window closed when they're ready to go — and potentially trapped." },
                { label: "Misinformation + corridor blocking", desc: "Close two corridors before the run; set misinformation to 50%. Misinfo-confirmed members are routed to a random open corridor, but the misdirection is more likely to send them toward a blocked gate — increasing the trapped count sharply." },
                { label: "Infrastructure damage + low clarity start", desc: "Set Info clarity to 4/10 and infrastructure damage to 12. Clarity collapses quickly, meaning confirmations become rare by tick 20. Only households that received early alerts and confirmed fast will complete evacuation. Late-moving households with elders will be unable to confirm at all." },
                { label: "Full armed conflict scenario", desc: "Dynamic threat rise rate 8 + ceasefire window + checkpoint delay 6 + misinformation 30% + coercion 25%. This stacks all the IHL-relevant mechanics simultaneously: forced departure, obstructed routes, false information, degrading comms, and an escalating threat. The Conflict metrics panel shows all four violation indicators at once." },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", gap: 10, padding: "8px 12px", background: "#fff", borderRadius: 8, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#0f1e36", minWidth: 170, flexShrink: 0, paddingTop: 1 }}>{item.label}</div>
                  <div style={{ fontSize: 11, lineHeight: 1.65, color: "#5a5a55" }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* Conflict metrics panel */}
        <FadeIn delay={540}>
          <div style={{ background: "#FEE2E2", borderRadius: 10, padding: "14px 16px", border: "0.5px solid rgba(220,38,38,0.2)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#991B1B", marginBottom: 6 }}>Reading the Conflict metrics panel</div>
            <p style={{ fontSize: 12, lineHeight: 1.75, color: "#7F1D1D", margin: "0 0 8px 0" }}>
              When any armed conflict mechanic produces an IHL-relevant outcome, a <strong>Conflict metrics</strong> section appears at the bottom of the post-run summary. It shows:
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: "Forced displacement", col: "#DC2626", desc: "Count of members coerced into evacuation — each is an Art. 17 AP II violation in the simulated scenario." },
                { label: "Checkpoint delays",   col: "#D97706", desc: "Count of members held at a checkpoint during evacuation — the obstruction index." },
                { label: "Misinfo-confirmed",   col: "#DC2626", desc: "Count of members whose final confirmation came from the misinformation channel — may have been misdirected." },
              ].map(m => (
                <div key={m.label} style={{ flex: 1, minWidth: 140, background: "#fff", borderRadius: 8, padding: "8px 10px", border: `0.5px solid ${m.col}44` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: m.col, marginBottom: 3 }}>{m.label}</div>
                  <div style={{ fontSize: 11, lineHeight: 1.6, color: "#5a5a55" }}>{m.desc}</div>
                </div>
              ))}
            </div>
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
              ref: "GC IV Arts. 16, 24, 50 — AP I Arts. 8(a), 70(1), 76, 77 — Customary Rule 138",
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
            How information flow shapes who evacuates and when
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
      <HumanitarianActorGuide />
      <PopulationFactors />
      <ScenariosSection />
      <CorridorGuide />
      <DynamicThreatGuide />
      <ArmedConflictGuide />
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
