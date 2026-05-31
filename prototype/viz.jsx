/* ============================================================
   viz.jsx — day-by-day flow visualization (themed by CSS vars + CHART)
   ============================================================ */

function VizChart({ projection, theme, who }) {
  const pal = CHART[theme];
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null); // {i, x}
  const days = projection.days;
  const n = days.length;

  const W = 1000, H = 380, padL = 64, padR = 22, padT = 26, padB = 38;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const { min, max } = useMemo(() => {
    let mn = Infinity, mx = -Infinity;
    for (const d of days) { if (d.balance < mn) mn = d.balance; if (d.balance > mx) mx = d.balance; }
    if (mn === mx) { mn -= 1; mx += 1; }
    const pad = (mx - mn) * 0.14;
    mn = Math.min(mn - pad, 0 <= mx && 0 >= mn ? mn - pad : mn - pad);
    return { min: mn - pad * 0.2, max: mx + pad };
  }, [days]);

  const xAt = (i) => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const yAt = (v) => padT + (1 - (v - min) / (max - min)) * plotH;

  // downsample for path (keep <= ~360 pts)
  const sampleIdx = useMemo(() => {
    const target = 360;
    if (n <= target) return days.map((_, i) => i);
    const step = (n - 1) / (target - 1);
    return Array.from({ length: target }, (_, k) => Math.round(k * step));
  }, [n, days]);

  const linePath = useMemo(() => sampleIdx.map((i, k) => `${k === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(days[i].balance).toFixed(1)}`).join(" "), [sampleIdx, days, min, max]);
  const areaPath = useMemo(() => linePath + `L${xAt(sampleIdx[sampleIdx.length - 1]).toFixed(1)},${(H - padB).toFixed(1)} L${xAt(sampleIdx[0]).toFixed(1)},${(H - padB).toFixed(1)} Z`, [linePath, sampleIdx]);

  // month ticks
  const ticks = useMemo(() => {
    const out = []; let last = -1;
    const maxTicks = 8;
    const stride = Math.max(1, Math.ceil((n / 30) / maxTicks));
    let mc = 0;
    for (let i = 0; i < n; i++) {
      const d = days[i].date;
      if (d.getDate() === 1 || i === 0) {
        if (d.getMonth() !== last) {
          if (mc % stride === 0) out.push({ i, label: d.toLocaleDateString("en-US", { month: "short", ...(n > 400 ? { year: "2-digit" } : {}) }) });
          last = d.getMonth(); mc++;
        }
      }
    }
    return out;
  }, [days, n]);

  // y gridlines
  const yLines = useMemo(() => {
    const count = 4; const out = [];
    for (let k = 0; k <= count; k++) out.push(min + (k / count) * (max - min));
    return out;
  }, [min, max]);

  const zeroY = min < 0 && max > 0 ? yAt(0) : null;

  const onMove = (e) => {
    const r = wrapRef.current.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    const frac = Math.max(0, Math.min(1, (t.clientX - r.left - (padL / W) * r.width) / ((plotW / W) * r.width)));
    const i = Math.round(frac * (n - 1));
    setHover({ i: Math.max(0, Math.min(n - 1, i)) });
  };

  const hi = hover ? days[hover.i] : null;
  const hx = hover ? xAt(hover.i) : 0;

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}
      onMouseMove={onMove} onMouseLeave={() => setHover(null)}
      onTouchStart={onMove} onTouchMove={onMove}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id={`fill-${theme}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={pal.fill0} />
            <stop offset="100%" stopColor={pal.fill1} />
          </linearGradient>
          <filter id={pal.glowId} x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="3.4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* y gridlines + labels */}
        {yLines.map((v, k) => (
          <g key={k}>
            <line x1={padL} x2={W - padR} y1={yAt(v)} y2={yAt(v)} stroke={pal.grid} strokeWidth="1" />
            <text x={padL - 10} y={yAt(v) + 4} textAnchor="end" fontSize="13" fill={pal.axis} fontFamily="var(--font-num)">{fmtShort(v)}</text>
          </g>
        ))}
        {zeroY != null && <line x1={padL} x2={W - padR} y1={zeroY} y2={zeroY} stroke={pal.neg} strokeWidth="1.4" strokeDasharray="2 5" opacity="0.7" />}

        {/* x ticks */}
        {ticks.map((t, k) => (
          <text key={k} x={xAt(t.i)} y={H - padB + 22} textAnchor="middle" fontSize="12.5" fill={pal.axis} fontFamily="var(--font-num)">{t.label}</text>
        ))}

        {/* area + line */}
        <path d={areaPath} fill={`url(#fill-${theme})`} />
        <path d={linePath} fill="none" stroke={pal.line} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" filter={`url(#${pal.glowId})`} />

        {/* hover guide */}
        {hi && (
          <g>
            <line x1={hx} x2={hx} y1={padT} y2={H - padB} stroke={pal.line} strokeWidth="1" strokeDasharray="3 4" opacity="0.6" />
            <circle cx={hx} cy={yAt(hi.balance)} r="6" fill={pal.dot} stroke="var(--bg)" strokeWidth="2" />
          </g>
        )}
      </svg>

      {/* tooltip */}
      {hi && (
        <div style={{
          position: "absolute", top: 6,
          left: `calc(${(hx / W) * 100}% )`, transform: `translateX(${hx > W * 0.62 ? "-105%" : "8px"})`,
          background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
          padding: "10px 13px", pointerEvents: "none", boxShadow: "var(--shadow)", minWidth: 150, zIndex: 4,
        }}>
          <div className="muted" style={{ fontSize: 11, fontWeight: 600 }}>{fmtDate(hi.date)}</div>
          <div className="num" style={{ fontSize: 19, fontWeight: 700, color: hi.balance < 0 ? "var(--neg)" : "var(--txt)" }}>{fmtMoney(hi.balance)}</div>
          {hi.net !== 0 && <div className="num" style={{ fontSize: 12, fontWeight: 600, color: hi.net > 0 ? "var(--pos)" : "var(--neg)" }}>{fmtMoney(hi.net, { sign: true })} today</div>}
          {hi.events.slice(0, 3).map((ev, k) => (
            <div key={k} className="row" style={{ gap: 6, fontSize: 11, marginTop: 4 }}>
              <span className="dot" style={{ background: ev.amount > 0 ? "var(--pos)" : "var(--neg)" }} />
              <span className="grow" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.entry.category || ev.entry.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Full visualization panel with range control + stat summary
function Visualization({ projection, theme, who, range, setRange, headline, stats, headLabel, headValue, headDelta }) {
  const c = COPY[theme];
  const delta = headDelta != null ? headDelta : (projection.end - projection.opening);
  const bigVal = headValue != null ? headValue : projection.end;
  const bigLabel = headLabel || c.netLabel;
  const defaultStats = [
    { label: "Inflow", value: fmtMoney(projection.totalIn), tone: "pos" },
    { label: "Outflow", value: fmtMoney(projection.totalOut), tone: "neg" },
    { label: "Peak", value: fmtMoney(projection.peak) },
    { label: "Lowest point", value: fmtMoney(projection.trough), tone: projection.trough < 0 ? "neg" : null },
  ];
  const shown = stats || defaultStats;
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="between" style={{ flexWrap: "wrap", gap: 14 }}>
        <div className="stack" style={{ gap: 3 }}>
          <span className="eyebrow">{bigLabel}</span>
          <div className="row" style={{ gap: 12, alignItems: "baseline" }}>
            <span className="num display" style={{ fontSize: "clamp(30px,6vw,46px)", color: bigVal < 0 ? "var(--neg)" : "var(--txt)" }}>{fmtMoney(bigVal)}</span>
            <span className="num" style={{ fontWeight: 700, fontSize: 15, color: delta >= 0 ? "var(--pos)" : "var(--neg)" }}>
              {fmtMoney(delta, { sign: true })}
            </span>
          </div>
          <span className="muted" style={{ fontSize: 12.5 }}>{headline}</span>
        </div>
        <div className="seg" style={{ flexWrap: "wrap" }}>
          {RANGE_OPTIONS.map((r) => (
            <button key={r.key} className={range === r.key ? "on" : ""} onClick={() => setRange(r.key)}>{r.label}</button>
          ))}
        </div>
      </div>

      <VizChart projection={projection} theme={theme} who={who} />

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
        {shown.map((s, i) => <Stat key={i} label={s.label} value={s.value} tone={s.tone} />)}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="card" style={{ padding: "14px 16px", boxShadow: "none" }}>
      <div className="eyebrow" style={{ fontSize: 10 }}>{label}</div>
      <div className="num" style={{ fontSize: 19, fontWeight: 700, marginTop: 4, color: tone === "pos" ? "var(--pos)" : tone === "neg" ? "var(--neg)" : "var(--txt)" }}>{value}</div>
    </div>
  );
}

Object.assign(window, { VizChart, Visualization, Stat });
