"use client";
import { useRef, useState, useMemo } from "react";
import { fmtMoney, fmtShort, fmtDate, RANGE_OPTIONS, COPY } from "@/lib/engine";
import type { Projection, RangeOption, Theme, Currency } from "@/lib/types";

const CHART_PAL = {
  billionaire: {
    line: "oklch(0.82 0.11 84)", fill0: "rgba(205,170,98,0.30)", fill1: "rgba(205,170,98,0.0)",
    grid: "rgba(255,255,255,0.06)", axis: "rgba(235,225,205,0.55)",
    pos: "oklch(0.78 0.13 152)", neg: "oklch(0.65 0.18 26)", dot: "oklch(0.88 0.06 84)", glowId: "glowGold",
  },
  girly: {
    line: "oklch(0.7 0.16 5)", fill0: "rgba(245,150,190,0.34)", fill1: "rgba(200,190,255,0.04)",
    grid: "rgba(190,110,150,0.12)", axis: "rgba(150,90,120,0.6)",
    pos: "oklch(0.7 0.13 165)", neg: "oklch(0.66 0.19 12)", dot: "oklch(0.78 0.13 350)", glowId: "glowRose",
  },
};

interface StatProps { label: string; value: string; tone?: "pos" | "neg" | null }
function Stat({ label, value, tone }: StatProps) {
  return (
    <div className="card" style={{ padding: "14px 16px", boxShadow: "none" }}>
      <div className="eyebrow" style={{ fontSize: 10 }}>{label}</div>
      <div className="num" style={{ fontSize: 19, fontWeight: 700, marginTop: 4, color: tone === "pos" ? "var(--pos)" : tone === "neg" ? "var(--neg)" : "var(--txt)" }}>{value}</div>
    </div>
  );
}

interface ChartProps { projection: Projection; theme: Theme; currency: Currency }
function VizChart({ projection, theme, currency }: ChartProps) {
  const pal = CHART_PAL[theme];
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number } | null>(null);
  const { days } = projection;
  const n = days.length;
  const W = 1000, H = 380, padL = 64, padR = 22, padT = 26, padB = 38;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const { min, max } = useMemo(() => {
    let mn = Infinity, mx = -Infinity;
    for (const d of days) { if (d.balance < mn) mn = d.balance; if (d.balance > mx) mx = d.balance; }
    if (mn === mx) { mn -= 1; mx += 1; }
    const pad = (mx - mn) * 0.14;
    return { min: mn - pad * 1.2, max: mx + pad };
  }, [days]);

  const xAt = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => padT + (1 - (v - min) / (max - min)) * plotH;

  const sampleIdx = useMemo(() => {
    const target = 360;
    if (n <= target) return days.map((_, i) => i);
    const step = (n - 1) / (target - 1);
    return Array.from({ length: target }, (_, k) => Math.round(k * step));
  }, [n, days]);

  const linePath = useMemo(() =>
    sampleIdx.map((i, k) => `${k === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(days[i].balance).toFixed(1)}`).join(" "),
    [sampleIdx, days, min, max] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const areaPath = linePath + `L${xAt(sampleIdx[sampleIdx.length - 1]).toFixed(1)},${(H - padB).toFixed(1)} L${xAt(sampleIdx[0]).toFixed(1)},${(H - padB).toFixed(1)} Z`;

  const ticks = useMemo(() => {
    const out: { i: number; label: string }[] = []; let last = -1;
    const stride = Math.max(1, Math.ceil((n / 30) / 8));
    let mc = 0;
    for (let i = 0; i < n; i++) {
      const d = days[i].date;
      if ((d.getDate() === 1 || i === 0) && d.getMonth() !== last) {
        if (mc % stride === 0) out.push({ i, label: d.toLocaleDateString("en-US", { month: "short", ...(n > 400 ? { year: "2-digit" } : {}) }) });
        last = d.getMonth(); mc++;
      }
    }
    return out;
  }, [days, n]);

  const yLines = useMemo(() => Array.from({ length: 5 }, (_, k) => min + (k / 4) * (max - min)), [min, max]);
  const zeroY = min < 0 && max > 0 ? yAt(0) : null;

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    const r = wrapRef.current!.getBoundingClientRect();
    const t = "touches" in e ? e.touches[0] : e;
    const frac = Math.max(0, Math.min(1, (t.clientX - r.left - (padL / W) * r.width) / ((plotW / W) * r.width)));
    setHover({ i: Math.round(frac * (n - 1)) });
  };

  const hi = hover ? days[Math.max(0, Math.min(n - 1, hover.i))] : null;
  const hx = hover ? xAt(Math.max(0, Math.min(n - 1, hover.i))) : 0;

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}
      onMouseMove={onMove} onMouseLeave={() => setHover(null)}
      onTouchStart={onMove} onTouchMove={onMove}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id={`fill-${theme}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={pal.fill0} /><stop offset="100%" stopColor={pal.fill1} />
          </linearGradient>
          <filter id={pal.glowId} x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="3.4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {yLines.map((v, k) => (
          <g key={k}>
            <line x1={padL} x2={W - padR} y1={yAt(v)} y2={yAt(v)} stroke={pal.grid} strokeWidth="1" />
            <text x={padL - 10} y={yAt(v) + 4} textAnchor="end" fontSize="13" fill={pal.axis} fontFamily="var(--font-num)">{fmtShort(v, currency)}</text>
          </g>
        ))}
        {zeroY != null && <line x1={padL} x2={W - padR} y1={zeroY} y2={zeroY} stroke={pal.neg} strokeWidth="1.4" strokeDasharray="2 5" opacity="0.7" />}
        {ticks.map((t, k) => (
          <text key={k} x={xAt(t.i)} y={H - padB + 22} textAnchor="middle" fontSize="12.5" fill={pal.axis} fontFamily="var(--font-num)">{t.label}</text>
        ))}
        <path d={areaPath} fill={`url(#fill-${theme})`} />
        <path d={linePath} fill="none" stroke={pal.line} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" filter={`url(#${pal.glowId})`} />
        {hi && (
          <g>
            <line x1={hx} x2={hx} y1={padT} y2={H - padB} stroke={pal.line} strokeWidth="1" strokeDasharray="3 4" opacity="0.6" />
            <circle cx={hx} cy={yAt(hi.balance)} r="6" fill={pal.dot} stroke="var(--bg)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hi && (
        <div style={{
          position: "absolute", top: 6,
          left: `calc(${(hx / W) * 100}%)`,
          transform: `translateX(${hx > W * 0.62 ? "-105%" : "8px"})`,
          background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)",
          padding: "10px 13px", pointerEvents: "none", boxShadow: "var(--shadow)", minWidth: 150, zIndex: 4,
        }}>
          <div className="muted" style={{ fontSize: 11, fontWeight: 600 }}>{fmtDate(hi.date)}</div>
          <div className="num" style={{ fontSize: 19, fontWeight: 700, color: hi.balance < 0 ? "var(--neg)" : "var(--txt)" }}>{fmtMoney(hi.balance, currency)}</div>
          {hi.net !== 0 && <div className="num" style={{ fontSize: 12, fontWeight: 600, color: hi.net > 0 ? "var(--pos)" : "var(--neg)" }}>{fmtMoney(hi.net, currency, { sign: true })} today</div>}
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

interface VizProps {
  projection: Projection; theme: Theme; currency: Currency;
  range: string; setRange: (r: string) => void;
  stats?: { label: string; value: string; tone?: "pos" | "neg" | null }[];
  headline?: string;
  headLabel?: string; headValue?: number; headDelta?: number;
}
export default function Visualization({ projection, theme, currency, range, setRange, stats, headline, headLabel, headValue, headDelta }: VizProps) {
  const c = COPY[theme];
  const delta    = headDelta  != null ? headDelta  : projection.end - projection.opening;
  const bigVal   = headValue  != null ? headValue  : projection.end;
  const bigLabel = headLabel  ?? c.netLabel;
  const months   = RANGE_OPTIONS.find((r: RangeOption) => r.key === range)?.months ?? 6;

  const defaultStats = [
    { label: "Inflow",   value: fmtMoney(projection.totalIn,  currency), tone: "pos" as const },
    { label: "Outflow",  value: fmtMoney(projection.totalOut, currency), tone: "neg" as const },
    { label: "Peak",     value: fmtMoney(projection.peak,     currency) },
    { label: "Lowest",   value: fmtMoney(projection.trough,   currency), tone: projection.trough < 0 ? "neg" as const : null },
  ];
  const shown = stats ?? defaultStats;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="between" style={{ flexWrap: "wrap", gap: 14 }}>
        <div className="stack" style={{ gap: 3 }}>
          <span className="eyebrow">{bigLabel}</span>
          <div className="row" style={{ gap: 12, alignItems: "baseline" }}>
            <span className="num display" style={{ fontSize: "clamp(30px,6vw,46px)", color: bigVal < 0 ? "var(--neg)" : "var(--txt)" }}>{fmtMoney(bigVal, currency)}</span>
            <span className="num" style={{ fontWeight: 700, fontSize: 15, color: delta >= 0 ? "var(--pos)" : "var(--neg)" }}>{fmtMoney(delta, currency, { sign: true })}</span>
          </div>
          {headline && <span className="muted" style={{ fontSize: 12.5 }}>{headline}</span>}
        </div>
        <div className="seg" style={{ flexWrap: "wrap" }}>
          {RANGE_OPTIONS.map((r: RangeOption) => (
            <button key={r.key} className={range === r.key ? "on" : ""} onClick={() => setRange(r.key)}>{r.label}</button>
          ))}
        </div>
      </div>
      <VizChart projection={projection} theme={theme} currency={currency} />
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
        {shown.map((s, i) => <Stat key={i} label={s.label} value={s.value} tone={s.tone} />)}
      </div>
    </div>
  );
}
