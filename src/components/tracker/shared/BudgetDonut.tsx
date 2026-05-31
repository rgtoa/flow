"use client";
/**
 * BudgetDonut — shared donut chart + slider allocation UI.
 * Used by ThrishaWizard (initial setup) and DivisionSheet (add-pocket realloc).
 */
import { fmtMoney } from "@/lib/engine";
import type { Currency } from "@/lib/types";

// ── Geometry helpers ──────────────────────────────────────────────────────────
function polar(cx: number, cy: number, r: number, ang: number) {
  const a = (ang - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function donutArc(cx: number, cy: number, rO: number, rI: number, a0: number, a1: number) {
  if (a1 - a0 >= 359.999) a1 = a0 + 359.999;
  const oS = polar(cx, cy, rO, a1), oE = polar(cx, cy, rO, a0);
  const iS = polar(cx, cy, rI, a0), iE = polar(cx, cy, rI, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${oS.x} ${oS.y} A${rO} ${rO} 0 ${large} 0 ${oE.x} ${oE.y} L${iS.x} ${iS.y} A${rI} ${rI} 0 ${large} 1 ${iE.x} ${iE.y} Z`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AllocPocket {
  id: string;
  name: string;
  color: string;
  mode: string;
}

// ── Donut chart ───────────────────────────────────────────────────────────────
export function BudgetDonut({ income, pockets, budgets, currency }: {
  income: number;
  pockets: AllocPocket[];
  budgets: Record<string, number>;
  currency: Currency;
}) {
  const total   = pockets.reduce((s, p) => s + (budgets[p.id] || 0), 0);
  const unalloc = Math.max(0, income - total);
  const over    = total > income;
  const cx = 130, cy = 130, rO = 120, rI = 76;
  let acc = 0;
  const denom = Math.max(income, total, 1);
  const slices: { id: string; color: string; a0: number; a1: number; ghost?: boolean }[] = [];
  for (const p of pockets) {
    const v = budgets[p.id] || 0;
    if (v <= 0) continue;
    const frac = v / denom;
    slices.push({ id: p.id, color: p.color, a0: acc * 360, a1: (acc + frac) * 360 });
    acc += frac;
  }
  const leftFrac = unalloc / denom;
  if (leftFrac > 0.0001) slices.push({ id: "__left", color: "var(--line)", a0: acc * 360, a1: (acc + leftFrac) * 360, ghost: true });

  return (
    <div style={{ position: "relative", width: 260, height: 260, margin: "0 auto" }}>
      <svg viewBox="0 0 260 260" width="260" height="260">
        {slices.length === 0 && <circle cx={cx} cy={cy} r={(rO + rI) / 2} fill="none" stroke="var(--line)" strokeWidth={rO - rI} />}
        {slices.map((s) => (
          <path key={s.id} d={donutArc(cx, cy, rO, rI, s.a0, s.a1)} fill={s.color} opacity={s.ghost ? 0.4 : 1}
            style={{ filter: s.ghost ? "none" : `drop-shadow(0 2px 6px color-mix(in oklch,${s.color} 40%,transparent))` }} />
        ))}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <span className="muted" style={{ fontSize: 11, fontWeight: 600 }}>{over ? "over income 😬" : unalloc > 0 ? "left to budget" : "all budgeted ✨"}</span>
        <span className="num display" style={{ fontSize: 30, color: over ? "var(--neg)" : unalloc > 0 ? "var(--txt)" : "var(--pos)" }}>{fmtMoney(over ? income - total : unalloc, currency)}</span>
        <span className="muted" style={{ fontSize: 11 }}>of {fmtMoney(income, currency)}/mo</span>
      </div>
    </div>
  );
}

// ── Slider list ───────────────────────────────────────────────────────────────
export function BudgetSliders({ income, pockets, budgets, setBudgets, currency, highlightId }: {
  income: number;
  pockets: AllocPocket[];
  budgets: Record<string, number>;
  setBudgets: (fn: (b: Record<string, number>) => Record<string, number>) => void;
  currency: Currency;
  highlightId?: string; // optionally highlight the new pocket
}) {
  const totalBudget = pockets.reduce((s, p) => s + (budgets[p.id] || 0), 0);
  return (
    <div className="stack" style={{ gap: 16 }}>
      {pockets.map((p) => {
        const v      = budgets[p.id] || 0;
        const others = totalBudget - v;
        const max    = Math.max(0, income - others);
        const pct    = income > 0 ? Math.round((v / income) * 100) : 0;
        const isNew  = p.id === highlightId;
        return (
          <div key={p.id} className="stack" style={{ gap: 7, padding: isNew ? "10px 12px" : 0, borderRadius: isNew ? 10 : 0, background: isNew ? "color-mix(in oklch,var(--accent) 8%,var(--surface))" : "transparent", border: isNew ? "1px solid color-mix(in oklch,var(--accent) 30%,var(--line))" : "none" }}>
            <div className="between">
              <div className="row" style={{ gap: 8 }}>
                <span className="dot" style={{ width: 12, height: 12, background: p.color }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name || "New pocket"}</span>
                {isNew && <span className="chip" style={{ fontSize: 9, padding: "2px 7px", color: "var(--accent)", borderColor: "var(--accent)" }}>new</span>}
                {!isNew && <span className="chip" style={{ fontSize: 9, padding: "2px 7px" }}>{p.mode}</span>}
              </div>
              <div className="row" style={{ gap: 8 }}>
                <span className="num" style={{ fontWeight: 700, fontSize: 14, color: v > 0 ? "var(--txt)" : "var(--txt-3)" }}>{fmtMoney(v, currency)}</span>
                <span className="chip" style={{ fontSize: 10, padding: "3px 8px" }}>{pct}%</span>
              </div>
            </div>
            <input type="range" min="0" max={income || 1} step="10" value={v}
              onChange={(e) => setBudgets((b) => ({ ...b, [p.id]: Math.min(max, parseInt(e.target.value, 10)) }))}
              className="alloc-range" style={{ width: "100%" }} />
          </div>
        );
      })}
    </div>
  );
}
