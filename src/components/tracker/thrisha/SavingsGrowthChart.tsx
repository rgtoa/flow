"use client";
/**
 * SavingsGrowthChart
 * Shows the projected growth of each savings goal as individual lines,
 * plus a "Total savings" line. Toggled from the money bloom card.
 */
import { useMemo, useRef, useState } from "react";
import { fmtMoney, fmtShort, RANGE_OPTIONS } from "@/lib/engine";
import type { Division, Currency, RangeOption } from "@/lib/types";

// CSS custom property colors work in inline SVG because the SVG inherits
// the document's computed styles. These map 1:1 to GIRLY_COLORS.
const FALLBACK_COLORS = [
  "oklch(0.72 0.13 165)",  // --pos  (green/mint)
  "oklch(0.72 0.16 5)",    // --accent (rose)
  "oklch(0.75 0.11 295)",  // --lav
  "oklch(0.82 0.08 230)",  // --blue
  "oklch(0.72 0.12 285)",  // --transfer
  "oklch(0.66 0.19 12)",   // --neg
];

interface Props {
  savings: Division;
  range: string;
  setRange: (r: string) => void;
  currency: Currency;
}

export default function SavingsGrowthChart({ savings, range, setRange, currency }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ i: number } | null>(null);
  const months = RANGE_OPTIONS.find((r: RangeOption) => r.key === range)?.months ?? 6;
  const goals  = savings.pockets ?? [];

  // Build one projected series per goal + one total
  const totalStart   = savings.balance || 0;
  const totalMonthly = savings.limit   || 0;

  const series = useMemo(() => {
    const goalSeries = goals.map((g, idx) => ({
      id:      g.id,
      name:    g.name,
      color:   FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
      cssVar:  g.color, // for legend dot
      points:  Array.from({ length: months + 1 }, (_, i) => (g.amount || 0) + (g.monthly || 0) * i),
    }));
    const totalSeries = {
      id:     "__total",
      name:   "Total savings",
      color:  FALLBACK_COLORS[0], // mint
      cssVar: "var(--pos)",
      points: Array.from({ length: months + 1 }, (_, i) => totalStart + totalMonthly * i),
    };
    return [...goalSeries, totalSeries];
  }, [goals, months, totalStart, totalMonthly]);

  const n = months + 1;
  const W = 1000, H = 340, padL = 70, padR = 28, padT = 24, padB = 36;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const maxVal = useMemo(() => {
    let mx = 0;
    for (const s of series) for (const v of s.points) if (v > mx) mx = v;
    return mx || 1;
  }, [series]);

  const xAt = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => padT + (1 - v / maxVal) * plotH;

  const ticks = useMemo(() => {
    const out: { i: number; label: string }[] = [];
    const stride = Math.max(1, Math.round(months / 8));
    for (let i = 0; i <= months; i += stride) {
      const y = Math.floor(i / 12), m = i % 12;
      out.push({ i, label: y > 0 ? `${y}y${m > 0 ? m + "m" : ""}` : `${i}m` });
    }
    return out;
  }, [months]);

  const yLines = useMemo(() => Array.from({ length: 5 }, (_, k) => (k / 4) * maxVal), [maxVal]);

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    const r = wrapRef.current!.getBoundingClientRect();
    const t = "touches" in e ? e.touches[0] : e;
    const frac = Math.max(0, Math.min(1, (t.clientX - r.left - (padL / W) * r.width) / ((plotW / W) * r.width)));
    setHover({ i: Math.round(frac * (n - 1)) });
  };

  const hi = hover ? Math.max(0, Math.min(n - 1, hover.i)) : null;
  const hx = hi != null ? xAt(hi) : 0;

  return (
    <div className="stack" style={{ gap: 18 }}>
      {/* Header row */}
      <div className="between" style={{ flexWrap: "wrap", gap: 14 }}>
        <div className="stack" style={{ gap: 3 }}>
          <span className="eyebrow">savings growth by goal</span>
          <span className="num display" style={{ fontSize: "clamp(30px,6vw,46px)" }}>
            {fmtMoney(totalStart + totalMonthly * months, currency)}
          </span>
          <span className="muted" style={{ fontSize: 12.5 }}>
            projected total in {months >= 12 ? (months / 12) + " yr" : months + " mo"} · +{fmtMoney(totalMonthly * months, currency)} from savings
          </span>
        </div>
        <div className="seg" style={{ flexWrap: "wrap" }}>
          {RANGE_OPTIONS.map((r: RangeOption) => (
            <button key={r.key} className={range === r.key ? "on" : ""} onClick={() => setRange(r.key)}>{r.label}</button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div ref={wrapRef} style={{ position: "relative", width: "100%" }}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}
        onTouchStart={onMove} onTouchMove={onMove}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
          {/* Grid lines */}
          {yLines.map((v, k) => (
            <g key={k}>
              <line x1={padL} x2={W - padR} y1={yAt(v)} y2={yAt(v)} stroke="rgba(190,110,150,0.12)" strokeWidth="1" />
              <text x={padL - 10} y={yAt(v) + 4} textAnchor="end" fontSize="13" fill="rgba(150,90,120,0.6)" fontFamily="var(--font-num)">{fmtShort(v, currency)}</text>
            </g>
          ))}
          {/* X ticks */}
          {ticks.map((t, k) => (
            <text key={k} x={xAt(t.i)} y={H - padB + 22} textAnchor="middle" fontSize="12.5" fill="rgba(150,90,120,0.6)" fontFamily="var(--font-num)">{t.label}</text>
          ))}
          {/* Lines — goals first, then total on top */}
          {series.map((s, si) => {
            const isTotal = s.id === "__total";
            const pts = s.points.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
            return (
              <path key={s.id} d={pts} fill="none"
                stroke={s.color}
                strokeWidth={isTotal ? 3 : 1.8}
                strokeDasharray={isTotal ? undefined : "6 3"}
                strokeLinejoin="round" strokeLinecap="round"
                opacity={isTotal ? 1 : 0.85}
                style={{ filter: isTotal ? `drop-shadow(0 0 6px ${s.color})` : "none" }}
              />
            );
          })}
          {/* Hover line */}
          {hi != null && (
            <g>
              <line x1={hx} x2={hx} y1={padT} y2={H - padB} stroke="rgba(150,90,120,0.35)" strokeWidth="1" strokeDasharray="3 4" />
              {series.map((s) => (
                <circle key={s.id} cx={hx} cy={yAt(s.points[hi])} r="5"
                  fill={s.color} stroke="var(--surface)" strokeWidth="2" />
              ))}
            </g>
          )}
        </svg>

        {/* Hover tooltip */}
        {hi != null && (
          <div style={{
            position: "absolute", top: 6,
            left: `calc(${(hx / W) * 100}%)`,
            transform: `translateX(${hx > W * 0.6 ? "-105%" : "8px"})`,
            background: "var(--bg-2)", border: "1px solid var(--line)",
            borderRadius: "var(--radius)", padding: "10px 13px",
            pointerEvents: "none", boxShadow: "var(--shadow)", minWidth: 200, zIndex: 4,
          }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 600 }}>
              month {hi}{hi >= 12 ? ` · yr ${(hi / 12).toFixed(1)}` : ""}
            </div>
            {series.map((s) => (
              <div key={s.id} className="between" style={{ gap: 12, marginTop: 5, fontSize: 12 }}>
                <div className="row" style={{ gap: 6, minWidth: 0 }}>
                  <span className="dot" style={{ background: s.color, width: 9, height: 9, flexShrink: 0 }} />
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
                </div>
                <span className="num" style={{ fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>{fmtMoney(s.points[hi], currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
        {series.map((s) => (
          <div key={s.id} className="chip" style={{ gap: 7, fontSize: 11.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, display: "inline-block", flexShrink: 0 }} />
            {s.name}
            {s.id !== "__total" && <span className="muted">· +{fmtMoney(
              (goals.find(g => g.id === s.id)?.monthly || 0), currency)}/mo</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
