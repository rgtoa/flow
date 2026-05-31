/* ============================================================
   auth.jsx — playful Pattern lock + Profile select
   ============================================================ */

// ordered patterns on a 3x3 grid (indices 0..8 left→right, top→bottom)
const PATTERNS = {
  Rafael:  [0, 1, 2, 5, 8],   // a sharp "7" — clean money move
  Thrisha: [1, 5, 7, 3],      // a little diamond ♦
};
// node that sits between two collinear nodes (android-style pass-through)
const MIDPOINT = { "0-2": 1, "2-0": 1, "3-5": 4, "5-3": 4, "6-8": 7, "8-6": 7, "0-6": 3, "6-0": 3, "1-7": 4, "7-1": 4, "2-8": 5, "8-2": 5, "0-8": 4, "8-0": 4, "2-6": 4, "6-2": 4 };

function PatternLock({ onSolve }) {
  const gridRef = useRef(null);
  const [sel, setSel] = useState([]);
  const [pointer, setPointer] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [status, setStatus] = useState(null); // 'bad' | who
  const centers = useRef([]);

  const computeCenters = useCallback(() => {
    const g = gridRef.current; if (!g) return;
    const r = g.getBoundingClientRect();
    const cell = r.width / 3;
    centers.current = Array.from({ length: 9 }, (_, i) => ({
      x: (i % 3) * cell + cell / 2,
      y: Math.floor(i / 3) * cell + cell / 2,
    }));
  }, []);

  useEffect(() => { computeCenters(); window.addEventListener("resize", computeCenters); return () => window.removeEventListener("resize", computeCenters); }, [computeCenters]);

  const localPt = (e) => {
    const g = gridRef.current; const r = g.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  const hitNode = (pt) => {
    const cell = gridRef.current.getBoundingClientRect().width / 3;
    const rad = cell * 0.36;
    for (let i = 0; i < 9; i++) {
      const c = centers.current[i];
      if (Math.hypot(pt.x - c.x, pt.y - c.y) < rad) return i;
    }
    return -1;
  };

  const addNode = (i, cur) => {
    if (cur.includes(i)) return cur;
    const next = [...cur];
    const last = cur[cur.length - 1];
    if (last != null) {
      const mid = MIDPOINT[`${last}-${i}`];
      if (mid != null && !next.includes(mid)) next.push(mid);
    }
    next.push(i);
    return next;
  };

  const start = (e) => {
    if (status && status !== "bad") return;
    computeCenters();
    setStatus(null);
    const pt = localPt(e);
    const i = hitNode(pt);
    setDrawing(true);
    setPointer(pt);
    setSel(i >= 0 ? [i] : []);
  };
  const move = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const pt = localPt(e);
    setPointer(pt);
    const i = hitNode(pt);
    if (i >= 0) setSel((s) => addNode(i, s));
  };
  const end = () => {
    if (!drawing) return;
    setDrawing(false);
    setPointer(null);
    const seq = sel.join(",");
    let who = null;
    for (const k of Object.keys(PATTERNS)) if (PATTERNS[k].join(",") === seq) who = k;
    if (who) {
      setStatus(who);
      setTimeout(() => onSolve(who), 720);
    } else if (sel.length > 0) {
      setStatus("bad");
      setTimeout(() => { setSel([]); setStatus(null); }, 650);
    } else {
      setSel([]);
    }
  };

  const lineColor = status === "bad" ? "var(--neg)" : status ? "var(--pos)" : "var(--accent)";
  const pathPts = sel.map((i) => centers.current[i]).filter(Boolean);

  return (
    <div className="screen" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="wrap" style={{ maxWidth: 460, display: "flex", flexDirection: "column", alignItems: "center", gap: 26, paddingTop: 24, paddingBottom: 24 }}>
        <div className="center" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div className="chip"><Icon name="lock" size={14} /> secure entry</div>
          <h1 className="display" style={{ fontSize: "clamp(34px,8vw,52px)" }}>
            Draw to unlock
          </h1>
          <p className="muted" style={{ fontSize: 15, maxWidth: 320 }}>
            Two people, two patterns. Your shape tells us whose money flow to open.
          </p>
        </div>

        <div
          ref={gridRef}
          className="no-sel"
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end}
          style={{
            position: "relative", width: "min(78vw, 320px)", aspectRatio: "1",
            touchAction: "none", cursor: "pointer",
            animation: status === "bad" ? "shake .5s" : "none",
          }}
        >
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
            {pathPts.length > 0 && (
              <polyline
                points={pathPts.map((p) => `${p.x},${p.y}`).join(" ") + (drawing && pointer ? ` ${pointer.x},${pointer.y}` : "")}
                fill="none" stroke={lineColor} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
                style={{ filter: "drop-shadow(0 0 8px " + lineColor + ")", transition: "stroke .3s" }}
              />
            )}
          </svg>
          {Array.from({ length: 9 }).map((_, i) => {
            const on = sel.includes(i);
            const order = sel.indexOf(i);
            return (
              <div key={i} style={{
                position: "absolute",
                left: `${(i % 3) * 33.333 + 16.666}%`,
                top: `${Math.floor(i / 3) * 33.333 + 16.666}%`,
                transform: "translate(-50%,-50%)",
                width: "22%", height: "22%", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px solid " + (on ? lineColor : "var(--line)"),
                background: on ? "color-mix(in oklch, " + lineColor + " 22%, var(--surface))" : "var(--surface)",
                boxShadow: on ? "0 0 18px -2px " + lineColor : "none",
                transition: "all .18s",
              }}>
                <div className="dot" style={{
                  width: on ? "42%" : "28%", height: on ? "42%" : "28%",
                  background: on ? lineColor : "var(--line)", transition: "all .18s",
                }} />
              </div>
            );
          })}
        </div>

        <div style={{ height: 22 }}>
          {status === "bad" && <span className="t-expense" style={{ fontWeight: 600, fontSize: 14 }}>Hmm, that's not a known pattern. Try again.</span>}
          {status && status !== "bad" && <span className="t-income pop-in" style={{ fontWeight: 700, fontSize: 15 }}>✓ Welcome back, {status} — opening your flow…</span>}
        </div>

      </div>
    </div>
  );
}

function MiniPattern({ seq }) {
  const size = 76, pad = 14;
  const c = (i) => ({ x: pad + (i % 3) * ((size - 2 * pad) / 2), y: pad + Math.floor(i / 3) * ((size - 2 * pad) / 2) });
  const pts = seq.map(c);
  return (
    <svg width={size} height={size} style={{ overflow: "visible" }}>
      <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {Array.from({ length: 9 }).map((_, i) => {
        const p = c(i); const on = seq.includes(i);
        return <circle key={i} cx={p.x} cy={p.y} r={on ? 4.5 : 2.5} fill={on ? "var(--accent)" : "var(--line)"} />;
      })}
    </svg>
  );
}

// ---------- PROFILE SELECT ----------
function ProfileSelect({ me, onOpen }) {
  const people = ["Rafael", "Thrisha"];
  return (
    <div className="screen" style={{ justifyContent: "center" }}>
      <div className="wrap" style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 30, paddingTop: 30, paddingBottom: 30 }}>
        <div className="center stack" style={{ gap: 8, alignItems: "center" }}>
          <div className="chip"><Avatar who={me} size={18} /> signed in as {me}</div>
          <h1 className="display" style={{ fontSize: "clamp(30px,7vw,46px)" }}>Whose flow today?</h1>
          <p className="muted" style={{ fontSize: 15, maxWidth: 420 }}>
            Open your own to edit everything. Peek at {me === "Rafael" ? "Thrisha" : "Rafael"}'s — you can look, but not touch.
          </p>
        </div>
        <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
          {people.map((p) => {
            const mine = p === me;
            const themed = p === "Rafael" ? "billionaire" : "girly";
            return (
              <button key={p} className="card" onClick={() => onOpen(p)} data-theme={themed} style={{
                padding: 26, textAlign: "left", display: "flex", flexDirection: "column", gap: 16,
                background: "var(--surface)", color: "var(--txt)", cursor: "pointer",
                transition: "transform .18s, box-shadow .2s", position: "relative", overflow: "hidden",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; }}>
                <div className="between">
                  <Avatar who={p} size={56} ring={mine} />
                  <span className="chip" style={{ fontSize: 11 }}>
                    {mine ? <><Icon name="edit" size={12} /> can edit</> : <><Icon name="eye" size={12} /> view only</>}
                  </span>
                </div>
                <div className="stack" style={{ gap: 4 }}>
                  <span className="display" style={{ fontSize: 26 }}>{p}</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {p === "Rafael" ? "Private wealth · cards, banks & transfers" : "cozy budgets · divisions & blooms ✿"}
                  </span>
                </div>
                <div className="row" style={{ color: "var(--accent)", fontWeight: 700, fontSize: 13, marginTop: 4 }}>
                  open {p === me ? "my" : "their"} {p === "Rafael" ? "portfolio" : "garden"} <Icon name="chevR" size={15} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PatternLock, ProfileSelect, PATTERNS });
