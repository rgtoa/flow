"use client";
/**
 * Thrisha's full money garden tracker.
 * Port of prototype/thrisha.jsx
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import {
  budgetStatus, fixedStatus, thrishaRemaining, savingsPocket,
  applyDueRollovers, rolloverThrishaOnce, buildProjection,
  fmtMoney, fmtDate, parseDate, RANGE_OPTIONS, COPY, GIRLY_COLORS,
  THRISHA_NOTES, FIXED_NOTES, pick, ordinal, monthKey, isoDate, todayISO,
} from "@/lib/engine";
import Visualization from "../shared/Visualization";
import Icon from "../shared/Icon";
import { BudgetDonut, BudgetSliders } from "../shared/BudgetDonut";
import ThrishaWizard from "./ThrishaWizard";
import SavingsGrowthChart from "./SavingsGrowthChart";
import {
  persistThrishaSettings, persistDivisions, addEntry, deleteEntry, assembleThrishaData, touchLastUpdated,
} from "@/lib/tracker-helpers";
import type { ThrishaData, Division, SavingsGoal, Entry, Recurrence, Theme, Currency, RangeOption } from "@/lib/types";

// ── Partner empty state (shown when canEdit=false and owner has no data) ──────
function PartnerEmptyState({ name, noun }: { name: string; noun: string }) {
  return (
    <div className="scroll grow">
      <div className="wrap center" style={{ paddingTop: "16vh", maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
        <span style={{ fontSize: 48 }}>🌱</span>
        <h2 className="display" style={{ fontSize: 26 }}>{name} hasn&apos;t built their {noun} yet</h2>
        <p className="muted" style={{ fontSize: 14.5 }}>Once {name} sets up their money flow, you&apos;ll be able to peek at it here.</p>
      </div>
    </div>
  );
}

// ── Division Cards ─────────────────────────────────────────────────────────────
function RecurringBody({ d }: { d: Division }) {
  const st = budgetStatus(d);
  const note = st.tone === "bad" ? "babe. you went OVER. that's a no 💔" : pick(THRISHA_NOTES[st.mood] ?? [""]);
  const barCol = st.tone === "bad" ? "var(--neg)" : st.tone === "warn" ? "var(--accent)" : d.color;
  return (
    <>
      <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
        <span className="num" style={{ fontSize: 26, fontWeight: 700, color: st.remaining < 0 ? "var(--neg)" : "var(--txt)" }}>{fmtMoney(st.remaining, "QAR")}</span>
        <span className="muted" style={{ fontSize: 12.5 }}>left of {fmtMoney(st.effective, "QAR")}</span>
      </div>
      {d.carryover > 0 && (
        <span className="chip" style={{ alignSelf: "flex-start", fontSize: 10.5, padding: "4px 9px", color: "var(--pos)", borderColor: "color-mix(in oklch,var(--pos) 40%,var(--line))" }}>
          <Icon name="repeat" size={11} /> {fmtMoney(d.limit, "QAR")} + {fmtMoney(d.carryover, "QAR")} rolled over
        </span>
      )}
      <div style={{ height: 10, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
        <div style={{ width: Math.min(100, st.pct * 100) + "%", height: "100%", borderRadius: 999, background: barCol, transition: "width .5s cubic-bezier(.2,.8,.2,1)", animation: st.tone === "bad" ? "shake .5s" : "none" }} />
      </div>
      <div className="row" style={{ gap: 8 }}>
        <span style={{ fontSize: 18 }}>{st.tone === "bad" ? "💔" : st.tone === "warn" ? "🚧" : st.mood === "comfy" ? "💖" : "🫶"}</span>
        <span suppressHydrationWarning style={{ fontSize: 13, fontWeight: 600, color: st.tone === "bad" ? "var(--neg)" : st.tone === "warn" ? "var(--accent)" : "var(--txt-2)" }}>{note}</span>
      </div>
    </>
  );
}

function FixedBody({ d }: { d: Division }) {
  const fs = fixedStatus(d);
  const pct = d.limit > 0 ? Math.min(100, (d.spent / d.limit) * 100) : 0;
  const note = fs.done ? null : pick(FIXED_NOTES[fs.urgency] ?? FIXED_NOTES.open);
  return (
    <>
      <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
        <span className="num" style={{ fontSize: 26, fontWeight: 700 }}>{fmtMoney(Math.max(0, d.limit - d.spent), "QAR")}</span>
        <span className="muted" style={{ fontSize: 12.5 }}>to pay of {fmtMoney(d.limit, "QAR")}</span>
      </div>
      <span className="chip" style={{ alignSelf: "flex-start", fontSize: 10.5, padding: "4px 9px" }}>
        <Icon name="calendar" size={11} /> due by the {ordinal(d.deadlineDay || 1)}
      </span>
      <div style={{ height: 10, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", borderRadius: 999, background: fs.done ? "var(--pos)" : fs.urgency === "overdue" ? "var(--neg)" : d.color, transition: "width .5s", animation: fs.urgency === "overdue" ? "shake .5s" : "none" }} />
      </div>
      {fs.done
        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", fontSize: 12.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999, background: "color-mix(in oklch,var(--pos) 16%,var(--surface))", color: "var(--pos)", border: "1px solid var(--pos)" }}><Icon name="check" size={13} /> paid — done this month</span>
        : <div className="row" style={{ gap: 8 }}>
            <span style={{ fontSize: 18 }}>{fs.urgency === "overdue" ? "🛑" : fs.urgency === "soon" ? "🔔" : "📌"}</span>
            <span suppressHydrationWarning style={{ fontSize: 13, fontWeight: 600, color: fs.urgency === "overdue" ? "var(--neg)" : "var(--txt-2)" }}>
              {fs.urgency === "overdue" ? `${Math.abs(fs.daysLeft)}d overdue — ` : fs.daysLeft === 0 ? "due today — " : `${fs.daysLeft}d left — `}{note}
            </span>
          </div>}
    </>
  );
}

function DivisionCard({ d, canEdit, onEdit }: { d: Division; canEdit: boolean; onEdit: () => void }) {
  const isFixed = d.mode === "fixed";
  const st  = budgetStatus(d);
  const fst = isFixed ? fixedStatus(d) : null;
  const bad = (!isFixed && st.tone === "bad") || (isFixed && fst?.urgency === "overdue");
  return (
    <div className="card pop-in" style={{ padding: 18, boxShadow: "none", display: "flex", flexDirection: "column", gap: 12, border: bad ? "1.5px solid var(--neg)" : "1px solid var(--line)" }}>
      <div className="between">
        <div className="row" style={{ gap: 10 }}>
          <span className="dot" style={{ width: 14, height: 14, background: d.color, boxShadow: `0 0 0 4px color-mix(in oklch,${d.color} 22%,transparent)` }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>{d.name}</span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <span className="chip" style={{ fontSize: 9.5, padding: "3px 8px" }}>{isFixed ? <><Icon name="check" size={10} /> FIXED</> : <><Icon name="repeat" size={10} /> RECURRING</>}</span>
          {canEdit && <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={onEdit}><Icon name="edit" size={14} /></button>}
        </div>
      </div>
      {isFixed ? <FixedBody d={d} /> : <RecurringBody d={d} />}
    </div>
  );
}

// ── Savings Hero ──────────────────────────────────────────────────────────────
function SavingsHero({ d, onOpen }: { d: Division; onOpen: () => void }) {
  const pcts       = d.pockets ?? [];
  const totalSaved = pcts.reduce((s, p) => s + (p.amount || 0), 0);
  return (
    <div className="card" style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 10, background: "linear-gradient(160deg,color-mix(in oklch,var(--pos) 16%,var(--surface)),var(--surface))", border: "1.5px solid color-mix(in oklch,var(--pos) 40%,var(--line))" }}>
      <div className="between">
        <span className="eyebrow" style={{ color: "var(--pos)" }}><Icon name="flower" size={12} style={{ verticalAlign: "-2px" }} /> Savings</span>
        <span className="chip" style={{ fontSize: 9.5, padding: "3px 8px", color: "var(--pos)", borderColor: "color-mix(in oklch,var(--pos) 40%,var(--line))" }}><Icon name="lock" size={10} /> auto</span>
      </div>
      <div className="num display" style={{ fontSize: "clamp(26px,6vw,40px)", color: "var(--pos)" }}>{fmtMoney(totalSaved, "QAR")}</div>
      <span className="muted" style={{ fontSize: 11.5 }}>total saved · {fmtMoney(d.limit, "QAR")}/mo auto 🥚</span>
      {pcts.length > 0 && (
        <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", background: "var(--surface-2)" }}>
          {pcts.map((p) => <div key={p.id} style={{ flex: p.amount || 1, background: p.color }} />)}
        </div>
      )}
      <button className="btn ghost" style={{ alignSelf: "flex-start", padding: "8px 12px", fontSize: 12.5 }} onClick={onOpen}>
        <Icon name="eye" size={14} /> what&apos;s inside · {pcts.length} pocket{pcts.length === 1 ? "" : "s"}
      </button>
    </div>
  );
}

// ── Savings Sheet ─────────────────────────────────────────────────────────────
function SavingsSheet({ savings, canEdit, onClose, onSave, mustFix = false }: {
  savings: Division; canEdit: boolean;
  onClose: () => void; onSave: (pockets: SavingsGoal[]) => void;
  /** When true, the sheet cannot be closed until monthlyLeft >= 0 */
  mustFix?: boolean;
}) {
  const [pockets, setPockets] = useState<SavingsGoal[]>(() => (savings.pockets ?? []).map((p) => ({ ...p, monthly: p.monthly ?? 0 })));
  const monthlyTotal = pockets.reduce((s, p) => s + (parseFloat(String(p.monthly)) || 0), 0);
  const monthlyLeft  = (savings.limit || 0) - monthlyTotal;
  const totalSaved   = pockets.reduce((s, p) => s + (parseFloat(String(p.amount))  || 0), 0);
  const hasDeficit   = monthlyLeft < -0.01;
  const canClose     = !mustFix || !hasDeficit; // locked while deficit exists in mustFix mode
  const add  = () => setPockets((ps) => [...ps, { id: crypto.randomUUID(), name: "", color: GIRLY_COLORS[ps.length % GIRLY_COLORS.length], amount: 0, monthly: 0 }]);
  const setP = (id: string, patch: Partial<SavingsGoal>) => setPockets((ps) => ps.map((p) => p.id === id ? { ...p, ...patch } : p));
  const del  = (id: string) => setPockets((ps) => ps.filter((p) => p.id !== id));
  const valid = pockets.every((p) => p.name.trim()) && !hasDeficit;
  const handleClose = () => { if (canClose) onClose(); };
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="stack" style={{ gap: 2 }}>
            <span className="display" style={{ fontSize: 22 }}>inside your savings 🥚</span>
            <span className="muted" style={{ fontSize: 12 }}>total {fmtMoney(savings.balance || 0, "QAR")} · grows {fmtMoney(savings.limit || 0, "QAR")}/mo</span>
          </div>
          <button className="icon-btn" onClick={handleClose} disabled={!canClose} style={{ opacity: canClose ? 1 : 0.3 }}><Icon name="x" size={18} /></button>
        </div>
        <div className="sheet-body">
          {/* Deficit warning — shown when savings budget was reduced below monthly goals */}
          {mustFix && hasDeficit && (
            <div className="card pop-in" style={{ padding: "14px 16px", boxShadow: "none", background: "color-mix(in oklch,var(--neg) 12%,var(--surface))", border: "1.5px solid var(--neg)" }}>
              <div className="row" style={{ gap: 10 }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div className="stack" style={{ gap: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--neg)" }}>savings budget reduced — fix needed</span>
                  <span style={{ fontSize: 12.5, color: "var(--txt-2)" }}>
                    your new savings budget is <b>{fmtMoney(savings.limit, "QAR")}/mo</b> but your goals add up to <b>{fmtMoney(monthlyTotal, "QAR")}/mo</b>. reduce the monthly amounts below until the deficit is cleared.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Total savings — prominent at the top */}
          <div className="card" style={{ boxShadow: "none", padding: "14px 16px", background: "color-mix(in oklch,var(--pos) 12%,var(--surface))", textAlign: "center", border: "1px solid color-mix(in oklch,var(--pos) 35%,var(--line))" }}>
            <span className="eyebrow" style={{ fontSize: 9.5, color: "var(--pos)" }}>total savings 🥚</span>
            <div className="num display" style={{ fontSize: 28, color: "var(--pos)" }}>{fmtMoney(totalSaved, "QAR")}</div>
          </div>
          {/* Two stat cards */}
          <div className="row" style={{ gap: 10 }}>
            <div className="card grow" style={{ boxShadow: "none", padding: "12px 14px", background: "var(--surface-2)", textAlign: "center" }}>
              <span className="eyebrow" style={{ fontSize: 9.5 }}>auto-adds / month</span>
              <div className="num display" style={{ fontSize: 22, color: "var(--pos)" }}>{fmtMoney(monthlyTotal, "QAR")}</div>
            </div>
            <div className="card grow" style={{ boxShadow: "none", padding: "12px 14px", background: hasDeficit ? "color-mix(in oklch,var(--neg) 12%,var(--surface))" : "var(--surface-2)", textAlign: "center" }}>
              <span className="eyebrow" style={{ fontSize: 9.5 }}>savings budget left</span>
              <div className="num display" style={{ fontSize: 22, color: hasDeficit ? "var(--neg)" : "var(--txt)" }}>{fmtMoney(monthlyLeft, "QAR")}</div>
            </div>
          </div>
          <p className="muted center" style={{ fontSize: 11.5, marginTop: -6 }}>each goal grows by its monthly amount on the 1st 🌙 · &ldquo;saved so far&rdquo; is for tracking existing savings</p>
          {pockets.length === 0 && <p className="muted center" style={{ fontSize: 13.5, padding: "8px 0" }}>no savings goals yet — make one like Travel ✈️ or Emergency 🚑</p>}
          {pockets.map((p) => (
            <div key={p.id} className="card" style={{ boxShadow: "none", padding: 14, background: "var(--surface-2)", display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="row" style={{ gap: 10 }}>
                <span className="dot" style={{ width: 26, height: 26, borderRadius: "50%", background: p.color, flex: "none" }} />
                <input className="input grow" placeholder="goal name (Travel, Emergency…)" value={p.name} onChange={(e) => setP(p.id, { name: e.target.value })} disabled={!canEdit} style={{ padding: "9px 12px" }} />
                {canEdit && <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => del(p.id)}><Icon name="trash" size={15} /></button>}
              </div>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{GIRLY_COLORS.map((c) => (<button key={c} onClick={() => canEdit && setP(p.id, { color: c })} style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: p.color === c ? "3px solid var(--txt)" : "2px solid var(--line)" }} />))}</div>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <div className="field grow" style={{ minWidth: 120 }}><span className="label" style={{ fontSize: 10.5 }}>saved so far</span>
                  <input className="input num" inputMode="decimal" placeholder="0" value={p.amount} onChange={(e) => setP(p.id, { amount: parseFloat(e.target.value.replace(/[^0-9.]/g,"")) || 0 })} disabled={!canEdit} style={{ padding: "9px 12px" }} /></div>
                <div className="field grow" style={{ minWidth: 120 }}><span className="label" style={{ fontSize: 10.5, color: hasDeficit ? "var(--neg)" : "var(--pos)" }}>+ adds each month</span>
                  <input className="input num" inputMode="decimal" placeholder="0" value={p.monthly} onChange={(e) => setP(p.id, { monthly: parseFloat(e.target.value.replace(/[^0-9.]/g,"")) || 0 })} disabled={!canEdit} style={{ padding: "9px 12px", borderColor: hasDeficit ? "var(--neg)" : undefined }} /></div>
              </div>
            </div>
          ))}
          {canEdit && <button className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={add}><Icon name="plus" size={16} /> new savings goal</button>}
        </div>
        {canEdit && (
          <div className="sheet-foot">
            <button className="btn grow" onClick={handleClose} disabled={!canClose} style={{ opacity: canClose ? 1 : 0.4 }}>cancel</button>
            <button className="btn primary grow" disabled={!valid} onClick={() => onSave(pockets.filter((p) => p.name.trim()).map((p) => ({ ...p, amount: parseFloat(String(p.amount)) || 0, monthly: parseFloat(String(p.monthly)) || 0 })))}><Icon name="check" size={16} /> save goals</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Realloc Sheet — adjust budgets without adding a new pocket ────────────────
function ReallocSheet({ data, onClose, onSave }: { data: ThrishaData; onClose: () => void; onSave: (updatedLimits: Record<string, number>) => void }) {
  const allPockets = data.divisions.map((d) => ({ id: d.id, name: d.name, color: d.color, mode: d.isSavings ? "fixed" : d.mode }));
  const [budgets, setBudgets] = useState<Record<string, number>>(() => {
    const b: Record<string, number> = {};
    data.divisions.forEach((d) => { b[d.id] = d.limit || 0; });
    return b;
  });
  const income      = data.monthlyIncome;
  const totalBudget = allPockets.reduce((s, p) => s + (budgets[p.id] || 0), 0);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="display" style={{ fontSize: 22 }}>reallocate budgets 🥧</span>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="sheet-body">
          <div className="card" style={{ boxShadow: "none", padding: "14px 18px", background: totalBudget > income ? "color-mix(in oklch,var(--neg) 12%,var(--surface))" : "color-mix(in oklch,var(--accent) 12%,var(--surface))", textAlign: "center" }}>
            <span className="eyebrow">income left to assign</span>
            <div className="num display" style={{ fontSize: 28, color: totalBudget > income ? "var(--neg)" : "var(--txt)" }}>{fmtMoney(Math.max(0, income - totalBudget), "QAR")}</div>
            <span className="muted" style={{ fontSize: 12 }}>of {fmtMoney(income, "QAR")}/mo · {fmtMoney(totalBudget, "QAR")} budgeted</span>
          </div>
          <BudgetDonut income={income} pockets={allPockets} budgets={budgets} currency="QAR" />
          <BudgetSliders income={income} pockets={allPockets} budgets={budgets} setBudgets={setBudgets} currency="QAR" />
        </div>
        <div className="sheet-foot">
          <button className="btn grow" onClick={onClose}>cancel</button>
          <button className="btn primary grow" onClick={() => onSave(budgets)}><Icon name="check" size={16} /> save allocation</button>
        </div>
      </div>
    </div>
  );
}

// ── Division Edit Sheet ───────────────────────────────────────────────────────
function DivisionSheet({ div, data, onClose, onSave, onSaveWithRealloc, onDelete }: {
  div: Division | null;
  data: ThrishaData;
  onClose: () => void;
  onSave: (d: Division) => void;
  onSaveWithRealloc?: (newDiv: Division, updatedLimits: Record<string, number>) => void;
  onDelete?: (id: string) => void;
}) {
  const isNew     = !div;
  const isSavings = !!div?.isSavings;
  const useTabs   = isNew && !isSavings;

  const [step,        setStep]        = useState(0);
  const [name,        setName]        = useState(div?.name ?? "");
  const [color,       setColor]       = useState(div?.color ?? GIRLY_COLORS[0]);
  const [mode,        setMode]        = useState<"recurring"|"fixed">(div?.mode ?? "recurring");
  const [deadlineDay, setDeadlineDay] = useState(div?.deadlineDay ?? 15);
  const [limit,       setLimit]       = useState(String(div?.limit ?? ""));

  // Stable ID for the new pocket so budgets key stays consistent
  const [newPocketId]  = useState(() => crypto.randomUUID());

  // Build the combined pocket list for the budget donut (all existing + new)
  const allPocketsForBudget = useMemo(() => [
    ...data.divisions.map((d) => ({ id: d.id, name: d.name, color: d.color, mode: d.isSavings ? "fixed" : d.mode })),
    { id: newPocketId, name: name.trim() || "New pocket", color, mode },
  ], [data.divisions, newPocketId, name, color, mode]);

  // Budgets initialised from current division limits; new pocket starts at 0
  const [budgets, setBudgets] = useState<Record<string, number>>(() => {
    const b: Record<string, number> = {};
    data.divisions.forEach((d) => { b[d.id] = d.limit || 0; });
    b[newPocketId] = 0;
    return b;
  });

  const income      = data.monthlyIncome;
  const totalBudget = allPocketsForBudget.reduce((s, p) => s + (budgets[p.id] || 0), 0);
  const allBudgeted = allPocketsForBudget.every((p) => (budgets[p.id] || 0) > 0);

  const configValid = name.trim();
  const thisLimit   = parseFloat(limit) || 0;
  const valid       = configValid && (useTabs ? true : thisLimit >= 0);

  const save = () => {
    const newDiv: Division = {
      id: newPocketId,
      name: name.trim(),
      limit: useTabs ? (budgets[newPocketId] || 0) : thisLimit,
      color, spent: 0, carryover: 0,
      mode, deadlineDay: mode === "fixed" ? deadlineDay : undefined,
      isSavings: false, allocation: useTabs ? (budgets[newPocketId] || 0) : thisLimit,
    };
    if (useTabs && onSaveWithRealloc) {
      onSaveWithRealloc(newDiv, budgets);
    } else {
      onSave(newDiv);
    }
  };

  const saveEdit = () => onSave({
    id: div!.id, name: isSavings ? "Savings" : name.trim(), limit: thisLimit, color,
    spent: div!.spent, carryover: div!.carryover,
    mode: isSavings ? "fixed" : mode, deadlineDay: isSavings ? 1 : (mode === "fixed" ? deadlineDay : undefined),
    isSavings, ...(isSavings ? { balance: div!.balance ?? 0 } : {}),
    allocation: (div!.allocation ?? thisLimit) || 0,
  });

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="display" style={{ fontSize: 22 }}>{isNew ? "New money pocket ✿" : isSavings ? "Edit Savings" : "Edit pocket"}</span>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>

        {useTabs && (
          <div className="row" style={{ gap: 0, padding: "0 20px 0", borderBottom: "1px solid var(--line)" }}>
            {(["Configure", "Budget"] as const).map((label, i) => (
              <div key={label} onClick={() => { if (i === 0 || configValid) setStep(i); }}
                style={{ flex: 1, textAlign: "center", padding: "10px 0", fontSize: 12.5, fontWeight: 700, color: step === i ? "var(--accent)" : "var(--txt-3)", borderBottom: step === i ? "2px solid var(--accent)" : "2px solid transparent", cursor: i === 1 && !configValid ? "default" : "pointer", opacity: i === 1 && !configValid ? 0.4 : 1 }}>
                {i + 1}. {label}
              </div>
            ))}
          </div>
        )}

        <div className="sheet-body">
          {/* ── Configure step (or single-tab for edit) ── */}
          {(!useTabs || step === 0) && (<>
            {isSavings
              ? <div className="chip" style={{ alignSelf: "flex-start", fontSize: 11, color: "var(--pos)", borderColor: "var(--pos)" }}><Icon name="lock" size={12} /> default pocket · fixed · due the 1st</div>
              : <div className="field"><span className="label">What&apos;s it for?</span><input className="input" placeholder="Food, Self-care, Leisure…" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>}
            {!useTabs && (
              <div className="field">
                <span className="label">{isSavings ? "Monthly savings target" : mode === "fixed" ? "Amount due each month" : "Monthly budget"}</span>
                <input className="input num" inputMode="decimal" placeholder="0.00" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^0-9.]/g,""))} style={{ fontSize: 22, fontWeight: 700 }} />
              </div>
            )}
            <div className="field"><span className="label">Pick a color</span>
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                {GIRLY_COLORS.map((c) => (<button key={c} onClick={() => setColor(c)} style={{ width: 32, height: 32, borderRadius: "50%", background: c, border: color === c ? "3px solid var(--txt)" : "2px solid var(--line)", transition: "all .15s", flexShrink: 0 }} />))}
              </div>
            </div>
            {!isSavings && (<div className="field"><span className="label">Tracking style</span>
              <div className="seg" style={{ alignSelf: "flex-start" }}>
                <button className={mode === "recurring" ? "on" : ""} onClick={() => setMode("recurring")}><Icon name="repeat" size={13} /> recurring</button>
                <button className={mode === "fixed"     ? "on" : ""} onClick={() => setMode("fixed")}><Icon name="check" size={13} /> fixed</button>
              </div>
              <span className="muted" style={{ fontSize: 11.5 }}>{mode === "recurring" ? "spending budget — don't go over; leftovers roll over 💅" : "must-pay bill/goal with a monthly deadline"}</span>
            </div>)}
            {!isSavings && mode === "fixed" && (
              <div className="field"><span className="label">📅 due by day of month</span>
                <div className="card" style={{ boxShadow: "none", padding: "10px 14px", background: "var(--surface-2)", display: "flex", alignItems: "center", gap: 12 }}>
                  <input type="range" min="1" max="28" step="1" value={deadlineDay} onChange={(e) => setDeadlineDay(parseInt(e.target.value, 10))} style={{ flex: 1 }} />
                  <span className="chip" style={{ whiteSpace: "nowrap", fontWeight: 700 }}>{ordinal(deadlineDay)}</span>
                </div>
              </div>)}
          </>)}

          {/* ── Budget step — donut + sliders for ALL pockets incl. new one ── */}
          {useTabs && step === 1 && (<>
            <div className="stack" style={{ gap: 5, textAlign: "center" }}>
              <span className="display" style={{ fontSize: 20 }}>divide your income 🥧</span>
              <span className="muted" style={{ fontSize: 13 }}>slide to give each pocket — including your new one — its share of the month.</span>
            </div>
            <div className="card" style={{ boxShadow: "none", padding: "14px 18px", background: totalBudget > income ? "color-mix(in oklch,var(--neg) 12%,var(--surface))" : "color-mix(in oklch,var(--accent) 12%,var(--surface))", textAlign: "center" }}>
              <span className="eyebrow">income left to assign</span>
              <div className="num display" style={{ fontSize: 28, color: totalBudget > income ? "var(--neg)" : "var(--txt)" }}>{fmtMoney(Math.max(0, income - totalBudget), "QAR")}</div>
              <span className="muted" style={{ fontSize: 12 }}>of {fmtMoney(income, "QAR")}/mo · {fmtMoney(totalBudget, "QAR")} budgeted</span>
            </div>
            <BudgetDonut income={income} pockets={allPocketsForBudget} budgets={budgets} currency="QAR" />
            <BudgetSliders income={income} pockets={allPocketsForBudget} budgets={budgets} setBudgets={setBudgets} currency="QAR" highlightId={newPocketId} />
          </>)}
        </div>

        <div className="sheet-foot">
          {!useTabs && !isNew && !isSavings && onDelete && <button className="btn" onClick={() => onDelete(div!.id)}><Icon name="trash" size={16} /></button>}
          {!useTabs && <button className="btn primary grow" disabled={!valid} onClick={saveEdit}><Icon name="check" size={16} /> Save pocket</button>}
          {useTabs && step === 0 && <button className="btn primary grow" disabled={!configValid} onClick={() => setStep(1)}>next: set budgets <Icon name="chevR" size={16} /></button>}
          {useTabs && step === 1 && <>
            <button className="btn" onClick={() => setStep(0)}>← back</button>
            <button className="btn primary grow" disabled={!allBudgeted} onClick={save}><Icon name="check" size={16} /> add pocket</button>
          </>}
        </div>
      </div>
    </div>
  );
}

// ── Add Moment Sheet ──────────────────────────────────────────────────────────
function ThrishaAddSheet({ data, onClose, onSave }: { data: ThrishaData; onClose: () => void; onSave: (e: Entry) => void }) {
  const spend    = data.divisions.filter((d) => !d.isSavings);
  const savDiv   = savingsPocket(data);
  const savGoals = savDiv?.pockets ?? [];

  const [tab,      setTab]      = useState<"income"|"expense"|"save">("expense");
  const [amount,   setAmount]   = useState("");
  const [division, setDivision] = useState(spend[0]?.id ?? "");
  const [savGoalId,setSavGoalId]= useState(savGoals[0]?.id ?? "");
  const [note,     setNote]     = useState("");
  const [date,     setDate]     = useState(todayISO());

  const amt = parseFloat(amount) || 0;

  // Expense helpers
  const isSavTarget = tab === "expense" && division?.startsWith("sav:");
  const div     = !isSavTarget && tab === "expense" ? data.divisions.find((d) => d.id === division) ?? null : null;
  const savGoal = isSavTarget ? savGoals.find((g) => g.id === division.slice(4)) ?? null : null;
  const preview = div ? budgetStatus({ ...div, spent: (div.spent || 0) + amt }) : null;

  // Save helpers
  const savGoalObj = savGoals.find((g) => g.id === savGoalId) ?? null;

  const valid =
    amt > 0 &&
    (tab === "income" ||
     (tab === "expense" && !!division) ||
     (tab === "save" && !!savGoalId));

  const submit = () => {
    if (tab === "income") {
      onSave({ id: crypto.randomUUID(), type: "income", amount: amt, division: null, category: "Income", note, recurrence: { kind: "once", date } });
    } else if (tab === "expense") {
      onSave({ id: crypto.randomUUID(), type: "expense", amount: amt, division, category: isSavTarget ? (savGoal?.name ?? "Savings") : (div?.name ?? "Money"), note, recurrence: { kind: "once", date } });
    } else {
      // Save: stored as expense with "toSav:<goalId>" division so handleSaveEntry knows to INCREASE savings
      onSave({ id: crypto.randomUUID(), type: "expense", amount: amt, division: "toSav:" + savGoalId, category: savGoalObj?.name ?? "Savings", note, recurrence: { kind: "once", date } });
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-head"><span className="display" style={{ fontSize: 22 }}>add a money moment</span><button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button></div>
        <div className="sheet-body">

          {/* Tab selector */}
          <div className="seg" style={{ alignSelf: "center" }}>
            <button className={tab === "income"  ? "on" : ""} onClick={() => setTab("income")}>💵 income</button>
            <button className={tab === "expense" ? "on" : ""} onClick={() => setTab("expense")}>🛍️ expense</button>
            {savGoals.length > 0 && <button className={tab === "save" ? "on" : ""} onClick={() => setTab("save")}>🏦 save</button>}
          </div>

          {/* Amount */}
          <div className="field"><span className="label">How much?</span>
            <input className="input num" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g,""))} style={{ fontSize: 26, fontWeight: 700, textAlign: "center" }} autoFocus /></div>

          {/* ── Income tab ── */}
          {tab === "income" && (
            <div className="field"><span className="label">On what date?</span>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <span className="muted" style={{ fontSize: 11.5 }}>one-time income — adds to your available balance on that date</span>
            </div>
          )}

          {/* ── Expense tab ── */}
          {tab === "expense" && (<>
            <div className="field"><span className="label">Which pocket?</span>
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                {spend.map((d) => (<button key={d.id} className="chip" onClick={() => setDivision(d.id)} style={{ cursor: "pointer", borderColor: division === d.id ? "var(--accent)" : "var(--line)", background: division === d.id ? "color-mix(in oklch,var(--accent) 14%,var(--surface))" : "var(--surface-2)", color: "var(--txt)" }}><span className="dot" style={{ background: d.color }} />{d.name}</button>))}
              </div>
              {savGoals.length > 0 && (<>
                <span className="label" style={{ marginTop: 6, color: "var(--pos)" }}>…or spend from a savings goal 🥚</span>
                <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                  {savGoals.map((g) => { const key = "sav:" + g.id; return (<button key={g.id} className="chip" onClick={() => setDivision(key)} style={{ cursor: "pointer", borderColor: division === key ? "var(--pos)" : "var(--line)", background: division === key ? "color-mix(in oklch,var(--pos) 14%,var(--surface))" : "var(--surface-2)", color: "var(--txt)" }}><span className="dot" style={{ background: g.color }} />{g.name} · {fmtMoney(g.amount || 0, "QAR")}</button>); })}
                </div></>)}
            </div>
            {isSavTarget && amt > 0 && savGoal && (
              <div className="card" style={{ padding: "12px 14px", boxShadow: "none", background: amt > (savGoal.amount || 0) ? "color-mix(in oklch,var(--neg) 12%,var(--surface))" : "var(--surface-2)" }}>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{amt > (savGoal.amount || 0) ? "🛑" : "🥚"}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: amt > (savGoal.amount || 0) ? "var(--neg)" : "var(--txt-2)" }}>
                    {amt > (savGoal.amount || 0) ? <>that&apos;s more than {savGoal.name} has ({fmtMoney(savGoal.amount || 0, "QAR")}) 💔</> : <>pulls from {savGoal.name} · <b className="num">{fmtMoney((savGoal.amount || 0) - amt, "QAR")}</b> would remain</>}
                  </span>
                </div>
              </div>)}
            {preview && amt > 0 && div && (div.mode === "fixed"
              ? <div className="card" style={{ padding: "12px 14px", boxShadow: "none", background: "var(--surface-2)" }}><div className="row" style={{ gap: 8 }}><span style={{ fontSize: 18 }}>{preview.remaining <= 0 ? "✅" : "•"}</span><span style={{ fontSize: 13, fontWeight: 600, color: "var(--txt-2)" }}>{div.name}: <b className="num">{fmtMoney(Math.max(0, preview.remaining), "QAR")}</b> left — {preview.remaining <= 0 ? "that clears it ✓" : "not done yet"}</span></div></div>
              : <div className="card" style={{ padding: "12px 14px", boxShadow: "none", background: preview.tone === "bad" ? "color-mix(in oklch,var(--neg) 12%,var(--surface))" : "var(--surface-2)" }}><div className="row" style={{ gap: 8 }}><span style={{ fontSize: 18 }}>{preview.tone === "bad" ? "😭" : preview.tone === "warn" ? "🚧" : "💖"}</span><span style={{ fontSize: 13, fontWeight: 600, color: preview.tone === "bad" ? "var(--neg)" : "var(--txt-2)" }}>{preview.remaining < 0 ? <>{div.name} <b>{fmtMoney(-preview.remaining, "QAR")}</b> over 💔</> : <>{div.name} → <b className="num">{fmtMoney(preview.remaining, "QAR")}</b> left</>}</span></div></div>)}
            <div className="field"><span className="label">On what date?</span><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </>)}

          {/* ── Save tab ── */}
          {tab === "save" && (<>
            <div className="field"><span className="label">Which savings goal?</span>
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                {savGoals.map((g) => (
                  <button key={g.id} className="chip" onClick={() => setSavGoalId(g.id)} style={{ cursor: "pointer", borderColor: savGoalId === g.id ? "var(--pos)" : "var(--line)", background: savGoalId === g.id ? "color-mix(in oklch,var(--pos) 14%,var(--surface))" : "var(--surface-2)", color: "var(--txt)" }}>
                    <span className="dot" style={{ background: g.color }} />{g.name} · {fmtMoney(g.amount || 0, "QAR")}
                  </button>
                ))}
              </div>
            </div>
            {savGoalObj && amt > 0 && (
              <div className="card" style={{ padding: "12px 14px", boxShadow: "none", background: "color-mix(in oklch,var(--pos) 10%,var(--surface))" }}>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🌱</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pos)" }}>
                    {savGoalObj.name} → <b className="num">{fmtMoney((savGoalObj.amount || 0) + amt, "QAR")}</b> total
                  </span>
                </div>
              </div>)}
            <div className="field"><span className="label">On what date?</span><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </>)}

          <div className="field"><span className="label">Note <span className="muted">(optional)</span></span>
            <input className="input" placeholder={tab === "income" ? "where's it from? 💌" : tab === "save" ? "what are you saving for? 🌱" : "treat yourself responsibly 💅"} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="sheet-foot"><button className="btn grow" onClick={onClose}>nvm</button><button className="btn primary grow" disabled={!valid} onClick={submit}><Icon name="check" size={16} /> add it</button></div>
      </div>
    </div>
  );
}

// ── Main Tracker ──────────────────────────────────────────────────────────────
interface Props {
  initialData: ThrishaData;
  userId: string;
  canEdit: boolean;
  theme: Theme;
  currency: Currency;
}

export default function ThrishaTracker({ initialData, userId, canEdit, theme, currency }: Props) {
  const [data,        setData]        = useState<ThrishaData>(initialData);
  const [range,       setRange]       = useState("6m");
  const [adding,      setAdding]      = useState(false);
  const [editDiv,     setEditDiv]     = useState<Division | null | undefined>(undefined);
  const [pocketMenu,     setPocketMenu]     = useState(false);
  const [reallocOpen,    setReallocOpen]    = useState(false);
  const [savingsMustFix, setSavingsMustFix] = useState(false);
  const [savingsOpen,       setSavingsOpen]       = useState(false);
  const [generated,         setGenerated]         = useState(data.entries.length > 0);
  const [showSavingsGrowth, setShowSavingsGrowth] = useState(false);
  const [vizKey,            setVizKey]            = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;
  const months = RANGE_OPTIONS.find((r: RangeOption) => r.key === range)!.months;

  // Re-fetch from DB — called by the Realtime hook when owner's data changes
  const refreshFromDB = useCallback(async () => {
    const [s, divRes, goalRes, e] = await Promise.all([
      supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("divisions").select("*").eq("user_id", userId),
      supabase.from("savings_goals").select("*"),
      supabase.from("entries").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    setData(assembleThrishaData(s.data, divRes.data ?? [], goalRes.data ?? [], e.data ?? []));
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live sync: only subscribe when viewing someone else's garden (read-only)
  useRealtimeSync(userId, refreshFromDB, !canEdit);

  // Auto month rollover
  useEffect(() => {
    if (!canEdit || !data.divisions.length) return;
    const rolled = applyDueRollovers(data, new Date());
    if (rolled) {
      setData(rolled);
      persistDivisions(supabase, userId, rolled.divisions);
      persistThrishaSettings(supabase, userId, { setupDone: rolled.setupDone, startDate: rolled.startDate, monthlyIncome: rolled.monthlyIncome, payday: rolled.payday, lastRollover: rolled.lastRollover });
    }
  }, [canEdit, data.divisions.length, data.lastRollover]); // eslint-disable-line react-hooks/exhaustive-deps

  const opening = thrishaRemaining(data);
  const projection = useMemo(() => {
    const savAmt = (savingsPocket(data)?.limit) ?? 0;
    const setAside = savAmt > 0
      ? [{ id: "__savings", type: "expense" as const, amount: savAmt, division: null, category: "Savings set-aside", note: "", recurrence: { kind: "monthly" as const, startDate: data.startDate } }]
      : [];
    return buildProjection([...data.entries, ...setAside], opening, parseDate(data.startDate), months);
  }, [data.entries, data.divisions, opening, data.startDate, months]);

  const sav          = savingsPocket(data);
  const otherPockets = data.divisions.filter((d) => !d.isSavings);

  // "What You've Got Left" display: base division budgets + any one-time incomes
  // received today or earlier − any save transfers already made
  const todayStr = todayISO();
  const extraIncome = data.entries
    .filter((e) => e.type === "income" && (e.recurrence as { kind: string; date?: string }).kind === "once" && (e.recurrence as { kind: string; date?: string }).date! <= todayStr)
    .reduce((s, e) => s + e.amount, 0);
  const savingsTransferred = data.entries
    .filter((e) => e.division?.startsWith("toSav:"))
    .reduce((s, e) => s + e.amount, 0);
  const displayRemaining = thrishaRemaining(data) + extraIncome - savingsTransferred;
  const overs        = otherPockets.filter((d) => d.mode !== "fixed" && d.spent > ((d.limit || 0) + (d.carryover || 0)));
  const overdueFixed = data.divisions.filter((d) => d.mode === "fixed" && fixedStatus(d).urgency === "overdue");
  const totalLimit   = otherPockets.reduce((s, d) => s + (d.limit || 0) + (d.carryover || 0), 0);
  const totalSpent   = otherPockets.reduce((s, d) => s + (d.spent || 0), 0);

  const netFlow      = projection.totalIn - projection.totalOut;
  const avgMonthlyNet = netFlow / months;
  const saveRate     = projection.totalIn > 0 ? Math.round((netFlow / projection.totalIn) * 100) : 0;
  const thrishaStats = [
    { label: "money in",     value: fmtMoney(projection.totalIn,    currency), tone: "pos" as const },
    { label: "money out",    value: fmtMoney(projection.totalOut,   currency), tone: "neg" as const },
    { label: "avg left / mo",value: fmtMoney(avgMonthlyNet, currency, { sign: true }), tone: avgMonthlyNet >= 0 ? "pos" as const : "neg" as const },
    { label: "savings rate", value: saveRate + "%", tone: "pos" as const },
  ];

  const startFresh = async () => {
    if (!confirm("Clear your garden and start over from scratch?")) return;
    const empty: ThrishaData = { setupDone: false, startDate: todayISO(), lastUpdated: Date.now(), monthlyIncome: 0, payday: 15, lastRollover: null, divisions: [], entries: [] };
    setData(empty);
    setGenerated(false);
    await supabase.from("entries").delete().eq("user_id", userId);
    await supabase.from("divisions").delete().eq("user_id", userId);
    await supabase.from("user_settings").upsert({ user_id: userId, setup_done: false }, { onConflict: "user_id" });
  };

  const handleWizardFinish = async (res: { monthlyIncome: number; payday: number; divisions: Division[] }) => {
    const now = new Date();
    const start = isoDate(new Date(now.getFullYear(), now.getMonth(), Math.min(res.payday, 28)));
    const incomeEntry: Entry[] = res.monthlyIncome > 0
      ? [{ id: crypto.randomUUID(), type: "income", amount: res.monthlyIncome, division: null, category: "Monthly income", note: "lands every month", recurrence: { kind: "monthly", startDate: start } }]
      : [];
    const divisions = res.divisions.map((dv) => dv.isSavings ? { ...dv, spent: dv.limit, balance: dv.limit, pockets: [] } : dv);
    const next: ThrishaData = { ...data, monthlyIncome: res.monthlyIncome, payday: res.payday, startDate: start, lastRollover: monthKey(now), setupDone: true, divisions, entries: incomeEntry, lastUpdated: Date.now() };
    setData(next);
    await persistThrishaSettings(supabase, userId, { setupDone: true, startDate: start, monthlyIncome: res.monthlyIncome, payday: res.payday, lastRollover: monthKey(now) });
    await persistDivisions(supabase, userId, divisions);
    for (const e of incomeEntry) await addEntry(supabase, userId, e);
  };

  const handleSaveEntry = async (entry: Entry) => {
    // Compute updated divisions eagerly so we can persist them alongside the entry
    let updatedDivisions = data.divisions;
    if (entry.type === "expense" && entry.division) {
      if (entry.division.startsWith("toSav:")) {
        // Save tab: transfer from What You've Got Left INTO a savings pocket
        const goalId = entry.division.slice(6);
        updatedDivisions = data.divisions.map((dv) => {
          if (!dv.isSavings) return dv;
          return { ...dv, balance: (dv.balance || 0) + entry.amount, pockets: (dv.pockets ?? []).map((p) => p.id === goalId ? { ...p, amount: (p.amount || 0) + entry.amount } : p) };
        });
      } else if (entry.division.startsWith("sav:")) {
        // Expense from a savings pocket — decrease savings
        const spId = entry.division.slice(4);
        updatedDivisions = data.divisions.map((dv) => {
          if (!dv.isSavings) return dv;
          return { ...dv, balance: Math.max(0, (dv.balance || 0) - entry.amount), pockets: (dv.pockets ?? []).map((p) => p.id === spId ? { ...p, amount: Math.max(0, (p.amount || 0) - entry.amount) } : p) };
        });
      } else {
        // Regular pocket expense — increase spent
        updatedDivisions = data.divisions.map((dv) => dv.id === entry.division ? { ...dv, spent: (dv.spent || 0) + entry.amount } : dv);
      }
    }

    setData((d) => ({ ...d, entries: [entry, ...d.entries], divisions: updatedDivisions, lastUpdated: Date.now() }));
    setAdding(false);

    // Persist both so the partner's polling sees the updated spent/balance values
    await addEntry(supabase, userId, entry);
    if (updatedDivisions !== data.divisions) {
      await persistDivisions(supabase, userId, updatedDivisions);
    }
    await touchLastUpdated(supabase, userId);
  };

  const handleSaveDivision = async (nd: Division) => {
    const next = data.divisions.some((d) => d.id === nd.id)
      ? data.divisions.map((d) => d.id === nd.id ? nd : d)
      : [...data.divisions, nd];
    setData((d) => ({ ...d, divisions: next, lastUpdated: Date.now() }));
    setEditDiv(undefined);
    await persistDivisions(supabase, userId, next);
    await touchLastUpdated(supabase, userId);
  };

  /** After any reallocation, check if the savings limit now covers monthly pocket goals. */
  const checkSavingsDeficit = (divisions: Division[]) => {
    const savDiv = divisions.find((d) => d.isSavings);
    if (!savDiv) return;
    const monthlyTotal = (savDiv.pockets ?? []).reduce((s, p) => s + (p.monthly || 0), 0);
    if (savDiv.limit < monthlyTotal - 0.01) {
      setSavingsMustFix(true);
      setSavingsOpen(true);
    }
  };

  // Reallocate existing pocket budgets without adding a new pocket
  const handleReallocate = async (updatedLimits: Record<string, number>) => {
    const next = data.divisions.map((d) => ({ ...d, limit: updatedLimits[d.id] ?? d.limit }));
    setData((d) => ({ ...d, divisions: next, lastUpdated: Date.now() }));
    setReallocOpen(false);
    await persistDivisions(supabase, userId, next);
    await touchLastUpdated(supabase, userId);
    checkSavingsDeficit(next);
  };

  // Called from DivisionSheet budget step — new pocket + reallocated limits for all others
  const handleSaveNewPocketWithRealloc = async (newDiv: Division, updatedLimits: Record<string, number>) => {
    const next = [
      ...data.divisions.map((d) => ({ ...d, limit: updatedLimits[d.id] ?? d.limit })),
      newDiv,
    ];
    setData((d) => ({ ...d, divisions: next, lastUpdated: Date.now() }));
    setEditDiv(undefined);
    await persistDivisions(supabase, userId, next);
    await touchLastUpdated(supabase, userId);
    checkSavingsDeficit(next);
  };

  const handleDeleteDivision = async (id: string) => {
    const next = data.divisions.filter((d) => d.id !== id);
    setData((d) => ({ ...d, divisions: next, lastUpdated: Date.now() }));
    setEditDiv(undefined);
    await persistDivisions(supabase, userId, next);
    await touchLastUpdated(supabase, userId);
  };

  const handleSaveSavingsPockets = async (pockets: SavingsGoal[]) => {
    const next = data.divisions.map((dv) => dv.isSavings ? { ...dv, pockets } : dv);
    setData((d) => ({ ...d, divisions: next, lastUpdated: Date.now() }));
    setSavingsOpen(false);
    setSavingsMustFix(false);
    await persistDivisions(supabase, userId, next);
    await touchLastUpdated(supabase, userId);
  };

  const c = COPY[theme];

  if (data.divisions.length === 0) {
    if (!canEdit) return <PartnerEmptyState name="Thrisha" noun="garden" />;
    return <ThrishaWizard onFinish={handleWizardFinish} currency={currency} />;
  }

  const now = new Date();
  const hour = now.getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const emoji = hour < 12 ? "🌅" : hour < 18 ? "☀️" : "🌙";
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="scroll grow" style={{ paddingBottom: 40 }}>
      <div className="wrap" style={{ paddingTop: 22, display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Greeting */}
        <div className="stack" style={{ gap: 6 }}>
          <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
            {canEdit
              ? <span className="display" style={{ fontSize: "clamp(20px,4vw,26px)" }}>Good {part}, Thrisha {emoji}</span>
              : <span />}
            <span className="chip" style={{ fontSize: 11.5, fontWeight: 600 }}><Icon name="calendar" size={13} /> {dateStr}</span>
          </div>
          {data.lastUpdated && <span className="muted" style={{ fontSize: 11, alignSelf: canEdit ? "flex-start" : "flex-end" }}>Last updated {new Date(data.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {new Date(data.lastUpdated).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>}
        </div>

        {/* Hero: what's left + savings */}
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: sav ? "1.5fr 1fr" : "1fr" }}>
          <div className="card" style={{ padding: "22px 22px", textAlign: "center", background: "linear-gradient(160deg,color-mix(in oklch,var(--accent) 14%,var(--surface)),var(--surface))", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <span className="eyebrow"><Icon name="flower" size={12} style={{ verticalAlign: "-2px" }} /> {c.netLabel}</span>
            <div className="num display" style={{ fontSize: "clamp(32px,8vw,50px)", margin: "6px 0", color: displayRemaining < 0 ? "var(--neg)" : "var(--txt)" }}>{fmtMoney(displayRemaining, currency)}</div>
            <span className="muted" style={{ fontSize: 12.5 }}>across {otherPockets.length} pockets · {fmtMoney(totalSpent, currency)} of {fmtMoney(totalLimit, currency)} used</span>
            {data.monthlyIncome > 0 && <div className="chip" style={{ margin: "12px auto 0", fontSize: 11 }}><Icon name="heart" size={12} /> {fmtMoney(data.monthlyIncome, currency)}/mo · lands {ordinal(data.payday || 1)}</div>}
          </div>
          {sav && <SavingsHero d={sav} onOpen={() => setSavingsOpen(true)} />}
        </div>

        {/* Strict alerts */}
        {overs.length > 0 && (
          <div className="card pop-in" style={{ padding: "14px 18px", background: "color-mix(in oklch,var(--neg) 12%,var(--surface))", border: "1.5px solid var(--neg)" }}>
            <div className="row" style={{ gap: 10 }}>
              <span style={{ fontSize: 22 }}>😤</span>
              <div className="stack" style={{ gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 14.5, color: "var(--neg)" }}>okay we need to talk.</span>
                <span style={{ fontSize: 13, color: "var(--txt-2)" }}>you&apos;ve gone over on <b>{overs.map((o) => o.name).join(", ")}</b>. pull it back, babe 💔</span>
              </div>
            </div>
          </div>
        )}
        {overdueFixed.length > 0 && (
          <div className="card pop-in" style={{ padding: "14px 18px", background: "color-mix(in oklch,var(--neg) 12%,var(--surface))", border: "1.5px solid var(--neg)" }}>
            <div className="row" style={{ gap: 10 }}>
              <span style={{ fontSize: 22 }}>🛑</span>
              <div className="stack" style={{ gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 14.5, color: "var(--neg)" }}>you have overdue bills.</span>
                <span style={{ fontSize: 13, color: "var(--txt-2)" }}><b>{overdueFixed.map((o) => o.name).join(", ")}</b> {overdueFixed.length > 1 ? "were" : "was"} due already. pay now — no excuses.</span>
              </div>
            </div>
          </div>
        )}

        {canEdit && <button className="btn primary lg block" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> {c.addCta}</button>}

        {/* Pockets */}
        <div className="stack" style={{ gap: 12 }}>
          <div className="between">
            <span className="display" style={{ fontSize: 22 }}>my money pockets</span>
            {canEdit && <button className="btn ghost" style={{ padding: "8px 12px", fontSize: 12.5 }} onClick={() => setPocketMenu(true)}><Icon name="sliders" size={14} /> configure pockets</button>}
          </div>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(248px,1fr))" }}>
            {otherPockets.map((d) => <DivisionCard key={d.id} d={d} canEdit={canEdit} onEdit={() => setEditDiv(d)} />)}
          </div>
        </div>

        {/* Bloom visualization */}
        {data.entries.length === 0 ? (
          <div className="card" style={{ padding: "32px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 34 }}>🌱</span>
            <span className="display" style={{ fontSize: 20 }}>your bloom is waiting</span>
            <p className="muted" style={{ fontSize: 13.5, maxWidth: 320 }}>add a money moment and your garden will start to bloom.</p>
          </div>
        ) : !generated ? (
          <button className="btn primary lg block" onClick={() => setGenerated(true)}><Icon name="spark" size={18} /> {c.generate}</button>
        ) : (
          <div className="card" style={{ padding: "22px 20px" }}>
            <div className="between" style={{ marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
              <div className="stack" style={{ gap: 2 }}>
                <span className="display" style={{ fontSize: 22 }}>
                  {showSavingsGrowth ? "savings growth 📈" : `${c.vizTitle} 🌸`}
                </span>
                <span className="muted" style={{ fontSize: 12.5 }}>
                  {showSavingsGrowth
                    ? "per goal projection · how each pocket grows over time"
                    : `${c.vizSub} · from ${fmtDate(parseDate(data.startDate))}`}
                </span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                {/* Toggle: bloom vs savings growth (only when savings has goals) */}
                {sav && (sav.pockets?.length ?? 0) > 0 && (
                  <div className="seg">
                    <button
                      className={!showSavingsGrowth ? "on" : ""}
                      onClick={() => setShowSavingsGrowth(false)}
                      style={{ padding: "8px 14px", fontSize: 12 }}
                    >
                      💐 bloom
                    </button>
                    <button
                      className={showSavingsGrowth ? "on" : ""}
                      onClick={() => setShowSavingsGrowth(true)}
                      style={{ padding: "8px 14px", fontSize: 12 }}
                    >
                      📈 savings
                    </button>
                  </div>
                )}
                <button className="icon-btn" onClick={() => setVizKey((k) => k + 1)} title="Refresh chart">
                  <Icon name="repeat" size={17} />
                </button>
              </div>
            </div>

            {showSavingsGrowth && sav ? (
              <SavingsGrowthChart savings={sav} range={range} setRange={setRange} currency={currency} />
            ) : (
              <Visualization key={vizKey} projection={projection} theme={theme} currency={currency} range={range} setRange={setRange} stats={thrishaStats}
                headLabel="your savings 🥚" headValue={(sav ? sav.balance || 0 : 0) + (sav ? (sav.limit || 0) * months : 0)} headDelta={sav ? (sav.limit || 0) * months : 0}
                headline={`saving ${fmtMoney(sav ? sav.limit || 0 : 0, currency)}/mo → ${months >= 12 ? (months / 12) + " yr" : months + " mo"} of growth`} />
            )}
          </div>
        )}

        {canEdit && (
          <button className="btn ghost" style={{ alignSelf: "center", fontSize: 12, color: "var(--txt-3)", padding: "6px 12px" }} onClick={startFresh}>
            <Icon name="trash" size={13} /> start fresh
          </button>
        )}
      </div>

      {adding && <ThrishaAddSheet data={data} onClose={() => setAdding(false)} onSave={handleSaveEntry} />}
      {savingsOpen && sav && <SavingsSheet savings={sav} canEdit={canEdit} mustFix={savingsMustFix} onClose={() => { setSavingsOpen(false); setSavingsMustFix(false); }} onSave={handleSaveSavingsPockets} />}
      {editDiv !== undefined && (
        <DivisionSheet div={editDiv} data={data} onClose={() => setEditDiv(undefined)}
          onSave={handleSaveDivision}
          onSaveWithRealloc={handleSaveNewPocketWithRealloc}
          onDelete={handleDeleteDivision} />
      )}

      {/* Configure Pockets gateway menu */}
      {pocketMenu && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setPocketMenu(false)}>
          <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <span className="display" style={{ fontSize: 22 }}>configure pockets ✿</span>
              <button className="icon-btn" onClick={() => setPocketMenu(false)}><Icon name="x" size={18} /></button>
            </div>
            <div className="sheet-body" style={{ gap: 14 }}>
              <button className="card" style={{ textAlign: "left", padding: "18px 20px", display: "flex", gap: 16, alignItems: "center", cursor: "pointer", border: "1.5px solid var(--line)", boxShadow: "none", background: "var(--surface-2)" }}
                onClick={() => { setPocketMenu(false); setEditDiv(null); }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in oklch,var(--accent) 16%,var(--surface))", color: "var(--accent)" }}>
                  <Icon name="plus" size={20} />
                </div>
                <div className="stack" style={{ gap: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>add new pocket</span>
                  <span className="muted" style={{ fontSize: 13 }}>create a new spending pocket and set its budget</span>
                </div>
                <Icon name="chevR" size={16} style={{ color: "var(--txt-3)", marginLeft: "auto" }} />
              </button>
              <button className="card" style={{ textAlign: "left", padding: "18px 20px", display: "flex", gap: 16, alignItems: "center", cursor: "pointer", border: "1.5px solid var(--line)", boxShadow: "none", background: "var(--surface-2)" }}
                onClick={() => { setPocketMenu(false); setReallocOpen(true); }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in oklch,var(--lav) 20%,var(--surface))", color: "var(--lav)" }}>
                  <Icon name="sliders" size={20} />
                </div>
                <div className="stack" style={{ gap: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>reallocate budgets</span>
                  <span className="muted" style={{ fontSize: 13 }}>adjust how your monthly income is split across existing pockets</span>
                </div>
                <Icon name="chevR" size={16} style={{ color: "var(--txt-3)", marginLeft: "auto" }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reallocate-only sheet — donut + sliders, no new pocket */}
      {reallocOpen && (
        <ReallocSheet data={data} onClose={() => setReallocOpen(false)} onSave={handleReallocate} />
      )}
    </div>
  );
}
