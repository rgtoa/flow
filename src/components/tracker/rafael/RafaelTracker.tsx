"use client";
/**
 * Rafael's full portfolio tracker.
 * Port of prototype/rafael.jsx — follows the original design exactly.
 */
import { useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  buildProjection, rafOpening, fmtMoney, fmtDate,
  parseDate, startOfDay, addDays, addMonths, dayIndex, expandOccurrences,
  RANGE_OPTIONS, EXPENSE_CATS, recurrenceLabel, todayISO,
  COPY, ordinal, pick,
} from "@/lib/engine";
import Visualization from "../shared/Visualization";
import RecurrencePicker from "../shared/RecurrencePicker";
import Icon from "../shared/Icon";
import {
  persistRafaelSetup, addEntry, deleteEntry, assembleRafaelData, touchLastUpdated,
} from "@/lib/tracker-helpers";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import type { RafaelData, Entry, Recurrence, Theme, Currency, RangeOption } from "@/lib/types";

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

// ── Helpers ───────────────────────────────────────────────────────────────────
function accountOptions(data: RafaelData) {
  const out = [];
  if (data.accounts.debit.use)   out.push({ id: "debit",  name: data.accounts.debit.name });
  if (data.accounts.credit.use)  out.push({ id: "credit", name: data.accounts.credit.name });
  for (const b of data.banks)    out.push({ id: b.id,     name: b.name });
  return out;
}
function accountName(data: RafaelData, id: string): string {
  if (id === "debit")  return data.accounts.debit.name;
  if (id === "credit") return data.accounts.credit.name;
  return data.banks.find((b) => b.id === id)?.name ?? "—";
}

// ── Add Transaction Sheet ─────────────────────────────────────────────────────
function RafaelAddSheet({ data, onClose, onSave }: { data: RafaelData; onClose: () => void; onSave: (e: Entry) => void }) {
  const [type, setType] = useState<"income"|"expense"|"transfer">("expense");
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState("debit");
  const [toAccount, setToAccount] = useState(data.banks[0]?.id ?? "credit");
  const [category, setCategory] = useState<string>("Bill");
  const [note, setNote] = useState("");
  const [rec, setRec] = useState<Recurrence>({ kind: "monthly", startDate: todayISO() });
  const opts = accountOptions(data);
  const valid = parseFloat(amount) > 0 && (type !== "transfer" || account !== toAccount);
  const save = () => onSave({
    id: crypto.randomUUID(), type, amount: parseFloat(amount),
    account, toAccount: type === "transfer" ? toAccount : undefined,
    category: type === "expense" ? category : type === "income" ? "Income" : "Transfer",
    note, recurrence: rec,
  });
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="display" style={{ fontSize: 22 }}>New Transaction</span>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="sheet-body">
          <div className="tiles" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            {([["income","Income","arrowUp","var(--pos)"],["expense","Expense","arrowDown","var(--neg)"],["transfer","Transfer","transfer","var(--transfer)"]] as const).map(([k,t,ic,col]) => (
              <button key={k} className={"tile" + (type === k ? " on" : "")} style={{ padding: 14, alignItems: "center", textAlign: "center" }} onClick={() => setType(k)}>
                <Icon name={ic} size={20} style={{ color: col }} /><span className="t-title" style={{ fontSize: 14 }}>{t}</span>
              </button>
            ))}
          </div>
          <div className="field">
            <span className="label">Amount</span>
            <input className="input num" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} style={{ fontSize: 24, fontWeight: 700 }} />
          </div>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <div className="field grow" style={{ minWidth: 160 }}>
              <span className="label">{type === "transfer" ? "From" : "Account"}</span>
              <select className="select" value={account} onChange={(e) => setAccount(e.target.value)}>
                {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            {type === "transfer" && (
              <div className="field grow" style={{ minWidth: 160 }}>
                <span className="label">To</span>
                <select className="select" value={toAccount} onChange={(e) => setToAccount(e.target.value)}>
                  {opts.filter((o) => o.id !== account).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            )}
          </div>
          {type === "expense" && (
            <div className="field">
              <span className="label">Category <span className="muted">(type your own or pick a suggestion)</span></span>
              {/* Free-text input — user can type anything */}
              <input
                className="input"
                placeholder="e.g. Bill, Grocery, or type your own…"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              {/* Preset suggestions as quick-pick chips */}
              <div className="row" style={{ flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {EXPENSE_CATS.map((c) => (
                  <button
                    key={c}
                    className="chip"
                    style={{
                      cursor: "pointer", fontSize: 11.5,
                      borderColor: category === c ? "var(--accent)" : "var(--line)",
                      color:       category === c ? "var(--txt)"    : "var(--txt-3)",
                      background:  category === c ? "color-mix(in oklch,var(--accent) 14%,var(--surface))" : "var(--surface-2)",
                    }}
                    onClick={() => setCategory(c)}
                  >{c}</button>
                ))}
              </div>
            </div>
          )}
          <RecurrencePicker rec={rec} setRec={setRec} />
          <div className="field">
            <span className="label">Note <span className="muted">(optional)</span></span>
            <input className="input" placeholder="e.g. quarterly dividend" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="sheet-foot">
          <button className="btn grow" onClick={onClose}>Cancel</button>
          <button className="btn primary grow" disabled={!valid} onClick={save}><Icon name="check" size={16} /> Add</button>
        </div>
      </div>
    </div>
  );
}

// ── Setup Sheet ───────────────────────────────────────────────────────────────
function RafaelSetupSheet({ data, onClose, onSave }: { data: RafaelData; onClose: () => void; onSave: (d: RafaelData) => void }) {
  const [debit,          setDebit]          = useState(String(data.accounts.debit.balance));
  const [startDate,      setStartDate]      = useState(data.startDate);
  const [useCredit,      setUseCredit]      = useState(data.accounts.credit.use);
  const [creditBal,      setCreditBal]      = useState(String(data.accounts.credit.balance));
  const [creditName,     setCreditName]     = useState(data.accounts.credit.name);
  const [creditStmtDay,  setCreditStmtDay]  = useState(data.accounts.credit.statementDay ?? 5);
  const [creditPayDay,   setCreditPayDay]   = useState(data.accounts.credit.payDay ?? 20);
  const [creditDueDay,   setCreditDueDay]   = useState(data.accounts.credit.dueDay ?? 28);
  const [banks,          setBanks]          = useState(data.banks.map((b) => ({ ...b })));
  const [step,           setStep]           = useState(0);
  const addBank = () => setBanks((b) => [...b, { id: "b" + Date.now(), name: "", balance: 0 }]);
  const finish = () => onSave({
    ...data, setupDone: true, startDate,
    accounts: {
      debit:  { ...data.accounts.debit,  balance: parseFloat(debit) || 0 },
      credit: { name: creditName, use: useCredit, balance: parseFloat(creditBal) || 0, statementDay: useCredit ? creditStmtDay : undefined, payDay: useCredit ? creditPayDay : undefined, dueDay: useCredit ? creditDueDay : undefined },
    },
    banks: banks.filter((b) => b.name.trim()).map((b) => ({ ...b, balance: parseFloat(String(b.balance)) || 0 })),
  });
  const steps = ["Default card", "Credit card", "Other banks"];
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="stack" style={{ gap: 2 }}>
            <span className="display" style={{ fontSize: 22 }}>Set the stage</span>
            <span className="muted" style={{ fontSize: 12 }}>Step {step + 1} of 3 · {steps[step]}</span>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="sheet-body">
          {step === 0 && (
            <div className="stack" style={{ gap: 16 }}>
              <p className="muted" style={{ fontSize: 14 }}>What&apos;s the current state of your default debit card, and when should the projection begin?</p>
              <div className="field"><span className="label">Debit card balance</span>
                <input className="input num" inputMode="decimal" value={debit} onChange={(e) => setDebit(e.target.value.replace(/[^0-9.\-]/g, ""))} style={{ fontSize: 22, fontWeight: 700 }} /></div>
              <div className="field"><span className="label">Start the visualization from</span>
                <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            </div>
          )}
          {step === 1 && (
            <div className="stack" style={{ gap: 16 }}>
              <p className="muted" style={{ fontSize: 14 }}>Do you use a credit card?</p>
              <div className="seg" style={{ alignSelf: "flex-start" }}>
                <button className={useCredit ? "on" : ""} onClick={() => setUseCredit(true)}>Yes</button>
                <button className={!useCredit ? "on" : ""} onClick={() => setUseCredit(false)}>No</button>
              </div>
              {useCredit && (<>
                <div className="field">
                  <span className="label">Card name</span>
                  <input className="input" value={creditName} onChange={(e) => setCreditName(e.target.value)} placeholder="e.g. Amex Platinum" />
                </div>
                <div className="field">
                  <span className="label">Current balance due <span className="muted">(how much you currently owe on the card)</span></span>
                  <input className="input num" inputMode="decimal" value={creditBal} onChange={(e) => setCreditBal(e.target.value.replace(/[^0-9.]/g, ""))} style={{ fontSize: 20, fontWeight: 700 }} placeholder="0.00" />
                </div>
                {/* Three billing cycle dates */}
                {[
                  { label: "📋 Statement date", sub: "Day your monthly statement closes — transactions after this go to next month's bill", val: creditStmtDay,  set: setCreditStmtDay  },
                  { label: "💰 Planned pay date", sub: "Day you personally plan to pay the full statement balance", val: creditPayDay,   set: setCreditPayDay   },
                  { label: "⏰ Bank due date",    sub: "Actual deadline set by the bank — latest you can pay without penalty", val: creditDueDay,   set: setCreditDueDay   },
                ].map(({ label, sub, val, set }) => (
                  <div key={label} className="field">
                    <span className="label">{label}</span>
                    <span className="muted" style={{ fontSize: 11.5, marginTop: -4 }}>{sub}</span>
                    <div className="card" style={{ boxShadow: "none", padding: "10px 14px", background: "var(--surface-2)", display: "flex", alignItems: "center", gap: 12 }}>
                      <input type="range" min="1" max="28" step="1" value={val} onChange={(e) => set(parseInt(e.target.value, 10))} style={{ flex: 1 }} />
                      <span className="chip" style={{ whiteSpace: "nowrap", fontWeight: 700 }}>{ordinal(val)} of each month</span>
                    </div>
                  </div>
                ))}
              </>)}
            </div>
          )}
          {step === 2 && (
            <div className="stack" style={{ gap: 14 }}>
              <p className="muted" style={{ fontSize: 14 }}>Any other banks you move money to? Used for transfers.</p>
              {banks.map((b, i) => (
                <div key={b.id} className="row" style={{ gap: 8 }}>
                  <input className="input grow" placeholder="Bank name" value={b.name} onChange={(e) => setBanks((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <input className="input num" style={{ width: 130 }} inputMode="decimal" placeholder="balance" value={b.balance} onChange={(e) => setBanks((arr) => arr.map((x, j) => j === i ? { ...x, balance: parseFloat(e.target.value.replace(/[^0-9.\-]/g,"")) || 0 } : x))} />
                  <button className="icon-btn" onClick={() => setBanks((arr) => arr.filter((_, j) => j !== i))}><Icon name="trash" size={16} /></button>
                </div>
              ))}
              <button className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={addBank}><Icon name="plus" size={16} /> Add a bank</button>
            </div>
          )}
        </div>
        <div className="sheet-foot">
          {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}><Icon name="chevL" size={16} /> Back</button>}
          {step < 2
            ? <button className="btn primary grow" onClick={() => setStep(step + 1)}>Continue <Icon name="chevR" size={16} /></button>
            : <button className="btn primary grow" onClick={finish}><Icon name="check" size={16} /> Save setup</button>}
        </div>
      </div>
    </div>
  );
}

// ── Daily Report ──────────────────────────────────────────────────────────────
// Computes per-day events + account balances for every day that has activity.
function buildDailyBreakdown(data: RafaelData, months: number) {
  const rStart = startOfDay(parseDate(data.startDate));
  const rEnd   = addMonths(rStart, months);
  const n      = dayIndex(rStart, rEnd) + 1;

  const accountDefs = [
    { id: "debit",  name: data.accounts.debit.name,  isCredit: false },
    ...(data.accounts.credit.use ? [{ id: "credit", name: data.accounts.credit.name, isCredit: true }] : []),
    ...data.banks.map((b) => ({ id: b.id, name: b.name, isCredit: false })),
  ];
  const bal: Record<string, number> = {
    debit: data.accounts.debit.balance,
    ...(data.accounts.credit.use ? { credit: data.accounts.credit.balance } : {}),
    ...Object.fromEntries(data.banks.map((b) => [b.id, b.balance])),
  };

  type DayEvent = { entry: Entry; signed: number };
  const dayEvents:  DayEvent[][] = Array.from({ length: n }, () => []);
  const dayDeltas:  Record<string, number>[] = Array.from({ length: n }, () => ({}));

  // Helper: apply a delta to an account, respecting credit-card liability direction.
  // Credit card balance = amount owed (positive = debt). Spending INCREASES it.
  const applyDelta = (dayIdx: number, accountId: string, delta: number) => {
    if (accountId === "credit") {
      // Credit is a liability — invert direction
      dayDeltas[dayIdx][accountId] = (dayDeltas[dayIdx][accountId] || 0) - delta;
    } else {
      dayDeltas[dayIdx][accountId] = (dayDeltas[dayIdx][accountId] || 0) + delta;
    }
  };

  for (const e of data.entries) {
    const occ    = expandOccurrences(e.recurrence, rStart, rEnd);
    const signed = e.type === "income" ? e.amount : e.type === "expense" ? -e.amount : 0;
    for (const od of occ) {
      const idx = dayIndex(rStart, od);
      if (idx < 0 || idx >= n) continue;
      dayEvents[idx].push({ entry: e, signed });
      if (e.type === "income"  && e.account) applyDelta(idx, e.account,   e.amount);
      if (e.type === "expense" && e.account) applyDelta(idx, e.account,  -e.amount);
      if (e.type === "transfer" && e.account && e.toAccount) {
        applyDelta(idx, e.account,   -e.amount);
        applyDelta(idx, e.toAccount,  e.amount);
      }
    }
  }

  const activeDays: {
    date: Date;
    events: DayEvent[];
    accountBals: { id: string; name: string; isCredit: boolean; balance: number }[];
    total: number;
    net: number;
  }[] = [];

  for (let i = 0; i < n; i++) {
    for (const [id, delta] of Object.entries(dayDeltas[i])) {
      if (bal[id] !== undefined) bal[id] += delta;
    }
    if (dayEvents[i].length > 0) {
      const net   = dayEvents[i].reduce((s, ev) => s + ev.signed, 0);
      // Credit is a liability — subtract it from total net worth
      const total = accountDefs.reduce((s, a) => s + (a.isCredit ? -(bal[a.id] ?? 0) : (bal[a.id] ?? 0)), 0);
      activeDays.push({
        date: addDays(rStart, i),
        events: dayEvents[i],
        accountBals: accountDefs.map((a) => ({ id: a.id, name: a.name, isCredit: a.isCredit, balance: bal[a.id] ?? 0 })),
        total,
        net,
      });
    }
  }

  return { activeDays, accounts: accountDefs };
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function DailyReport({ data, currency, canEdit, onDelete }: {
  data: RafaelData; currency: Currency; canEdit: boolean;
  onDelete: (id: string) => void;
}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  // Always compute full year so account balances are accurate across months
  const { activeDays: allDays, accounts } = useMemo(
    () => buildDailyBreakdown(data, 12),
    [data], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Credit card billing cycle config
  const cc = data.accounts.credit.use ? data.accounts.credit : null;
  const creditStmtDay = cc?.statementDay ?? 0;
  const creditPayDay  = cc?.payDay       ?? 0;
  const creditDueDay  = cc?.dueDay       ?? 0;

  // Filter to selected month + inject CC billing reminders
  const monthDays = useMemo(() => {
    const days = allDays.filter(
      (d) => d.date.getFullYear() === currentYear && d.date.getMonth() === selectedMonth,
    );

    // Inject reminder markers for each set CC date (if not already an event day)
    const reminders: { day: number; kind: "statement"|"pay"|"due" }[] = [];
    if (creditStmtDay) reminders.push({ day: creditStmtDay, kind: "statement" });
    if (creditPayDay)  reminders.push({ day: creditPayDay,  kind: "pay"       });
    if (creditDueDay)  reminders.push({ day: creditDueDay,  kind: "due"       });

    for (const r of reminders) {
      if (!days.some((d) => d.date.getDate() === r.day)) {
        const rd = new Date(currentYear, selectedMonth, r.day);
        days.push({ date: rd, events: [], accountBals: [], total: 0, net: 0, creditReminder: r.kind } as never);
      }
    }
    days.sort((a, b) => a.date.getTime() - b.date.getTime());
    return days;
  }, [allDays, selectedMonth, currentYear, creditStmtDay, creditPayDay, creditDueDay]);

  const today = startOfDay(new Date());

  return (
    <div className="stack" style={{ gap: 16 }}>
      {/* Header */}
      <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="stack" style={{ gap: 2 }}>
          <span className="display" style={{ fontSize: 22 }}>Daily money flow</span>
          <span className="muted" style={{ fontSize: 12.5 }}>Every event + account balances, day by day</span>
        </div>
      </div>

      {/* Month tabs */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {MONTH_NAMES.map((m, i) => (
          <button key={m} onClick={() => setSelectedMonth(i)}
            className={selectedMonth === i ? "btn primary" : "btn ghost"}
            style={{ padding: "6px 12px", fontSize: 12.5, minWidth: 44 }}>
            {m}
          </button>
        ))}
      </div>

      {monthDays.length === 0 && (
        <p className="muted center" style={{ padding: "30px 0", fontSize: 14 }}>No activity in {MONTH_NAMES[selectedMonth]}.</p>
      )}

      {monthDays.map((day, di) => {
        // Credit card billing cycle reminder cards
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const reminder = (day as any).creditReminder as "statement"|"pay"|"due"|undefined;
        if (reminder) {
          const configs = {
            statement: { icon: "📋", color: "var(--transfer)", title: `${cc?.name ?? "Credit card"} statement closes`, sub: "Transactions after today go to next month's bill" },
            pay:       { icon: "💰", color: "var(--pos)",      title: `Planned payment — ${cc?.name ?? "credit card"}`, sub: "Your target day to pay the full statement balance" },
            due:       { icon: "⏰", color: "var(--neg)",      title: `Payment deadline — ${cc?.name ?? "credit card"}`, sub: "Last day to pay without penalty" },
          };
          const cfg = configs[reminder];
          const dateLabel = fmtDate(day.date, { weekday: "short", month: "short", day: "numeric" });
          return (
            <div key={di} className="card" style={{ padding: "14px 18px", display: "flex", gap: 12, alignItems: "center", border: `1.5px solid color-mix(in oklch,${cfg.color} 35%,var(--line))`, background: `color-mix(in oklch,${cfg.color} 7%,var(--surface))` }}>
              <span style={{ fontSize: 22 }}>{cfg.icon}</span>
              <div className="stack" style={{ gap: 2, flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{cfg.title}</span>
                <span className="muted" style={{ fontSize: 12 }}>{dateLabel} · {cfg.sub}</span>
              </div>
            </div>
          );
        }
        const isPast   = day.date < today;
        const isToday  = fmtDate(day.date) === fmtDate(today);
        const dateLabel = isToday ? "Today" : fmtDate(day.date, { weekday: "short", month: "short", day: "numeric" });
        const netColor = day.net > 0 ? "var(--pos)" : day.net < 0 ? "var(--neg)" : "var(--txt-3)";

        return (
          <div key={di} className="card" style={{ padding: 0, overflow: "hidden", opacity: isPast && !isToday ? 0.78 : 1 }}>
            {/* Day header */}
            <div className="between" style={{ padding: "12px 18px", background: "var(--surface-2)", borderBottom: "1px solid var(--line-soft)", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{dateLabel}</span>
              <span className="num" style={{ fontSize: 13, fontWeight: 700, color: netColor }}>
                {day.net > 0 ? "+" : day.net < 0 ? "−" : ""}{fmtMoney(Math.abs(day.net), currency)} net
              </span>
            </div>

            {/* Events */}
            <div className="stack">
              {day.events.map((ev, ei) => {
                const col = ev.entry.type === "income" ? "var(--pos)" : ev.entry.type === "expense" ? "var(--neg)" : "var(--transfer)";
                const ic  = ev.entry.type === "income" ? "arrowUp" : ev.entry.type === "expense" ? "arrowDown" : "transfer";
                return (
                  <div key={ei} className="row" style={{ padding: "11px 18px", borderBottom: "1px solid var(--line-soft)", gap: 12, flexWrap: "nowrap" }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in oklch,${col} 16%,var(--surface))`, color: col }}>
                      <Icon name={ic} size={15} />
                    </div>
                    <div className="grow stack" style={{ gap: 2, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>
                        {ev.entry.category}
                        {ev.entry.note ? <span className="muted" style={{ fontWeight: 400 }}> · {ev.entry.note}</span> : null}
                      </span>
                      <span className="muted" style={{ fontSize: 11.5 }}>
                        {accountName(data, ev.entry.account ?? "")}
                        {ev.entry.type === "transfer" ? " → " + accountName(data, ev.entry.toAccount ?? "") : ""}
                        {" · "}{recurrenceLabel(ev.entry.recurrence)}
                        {/* Billing cycle label for CC transactions */}
                        {ev.entry.account === "credit" && creditStmtDay > 0 && (() => {
                          const d = day.date.getDate();
                          const m = day.date.getMonth();
                          const y = day.date.getFullYear();
                          const afterStmt = d > creditStmtDay;
                          const billingMonth = afterStmt ? new Date(y, m + 1) : new Date(y, m);
                          const dueLabel = new Date(billingMonth.getFullYear(), billingMonth.getMonth(), creditDueDay || 28).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                          return <span style={{ color: "var(--transfer)", marginLeft: 4 }}>→ billed {afterStmt ? "next" : "this"} month (due {dueLabel})</span>;
                        })()}
                      </span>
                    </div>
                    <span className="num" style={{ fontWeight: 700, fontSize: 14.5, color: col, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {ev.entry.type === "transfer" ? "↔ " : ev.signed > 0 ? "+" : "−"}{fmtMoney(ev.entry.amount, currency)}
                    </span>
                    {canEdit && (
                      <button className="icon-btn" style={{ width: 30, height: 30, flexShrink: 0 }} title="Remove entry" onClick={() => onDelete(ev.entry.id)}>
                        <Icon name="trash" size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Account balances at end of day */}
            <div style={{ padding: "10px 18px", display: "flex", flexWrap: "wrap", gap: "6px 18px", background: "color-mix(in oklch,var(--accent) 5%,var(--surface))", borderTop: "1px solid var(--line-soft)" }}>
              {day.accountBals.map((a) => (
                <span key={a.id} style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
                  <span className="muted">{a.name}{a.isCredit ? " (owed)" : ""}: </span>
                  <span className="num" style={{ fontWeight: 700, color: a.isCredit ? "var(--neg)" : a.balance < 0 ? "var(--neg)" : "var(--txt)" }}>
                    {a.isCredit && a.balance > 0 ? "−" : ""}{fmtMoney(a.balance, currency)}
                  </span>
                </span>
              ))}
              {accounts.length > 1 && (
                <span style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
                  <span className="muted">Net worth: </span>
                  <span className="num" style={{ fontWeight: 700, color: day.total < 0 ? "var(--neg)" : "var(--accent)" }}>{fmtMoney(day.total, currency)}</span>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Onboarding ────────────────────────────────────────────────────────────────
// ── "What's Next" panel ───────────────────────────────────────────────────────
// Finds the next N upcoming occurrences across all entries from today onwards.
function getUpcoming(entries: import("@/lib/types").Entry[], from: Date, limit = 5) {
  const rStart = startOfDay(from);
  const rEnd   = addDays(rStart, 45); // look 45 days ahead
  const hits: { date: Date; entry: import("@/lib/types").Entry }[] = [];
  for (const e of entries) {
    for (const d of expandOccurrences(e.recurrence, rStart, rEnd)) {
      hits.push({ date: d, entry: e });
    }
  }
  return hits.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, limit);
}

function NextUpPanel({ data, currency }: { data: RafaelData; currency: Currency }) {
  const upcoming = useMemo(() => getUpcoming(data.entries, new Date()), [data.entries]);
  if (!upcoming.length) return null;

  const today = startOfDay(new Date());

  return (
    <div className="card" style={{ padding: "16px 20px" }}>
      <span className="eyebrow" style={{ display: "block", marginBottom: 12 }}>
        ⏭ what&apos;s next
      </span>
      <div className="stack" style={{ gap: 10 }}>
        {upcoming.map(({ date, entry }, i) => {
          const days = dayIndex(today, date);
          const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days}d`;
          const col  = entry.type === "income" ? "var(--pos)" : entry.type === "expense" ? "var(--neg)" : "var(--transfer)";
          const sign = entry.type === "income" ? "+" : entry.type === "expense" ? "−" : "";
          const ic   = entry.type === "income" ? "arrowUp" : entry.type === "expense" ? "arrowDown" : "transfer";
          return (
            <div key={i} className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              <span className="chip" style={{ fontSize: 10, padding: "3px 9px", whiteSpace: "nowrap", fontWeight: 700 }}>
                {when}
              </span>
              <span style={{ color: col, display: "flex", alignItems: "center" }}>
                <Icon name={ic} size={14} />
              </span>
              <span className="grow" style={{ fontSize: 13, fontWeight: 600, minWidth: 80 }}>
                {entry.category}
                {entry.note ? <span className="muted" style={{ fontWeight: 400 }}> · {entry.note}</span> : null}
              </span>
              <span className="num" style={{ fontWeight: 700, fontSize: 13, color: col, whiteSpace: "nowrap" }}>
                {sign}{fmtMoney(entry.amount, currency)}
              </span>
              <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                {accountName(data, entry.account ?? "")}
                {entry.type === "transfer" && entry.toAccount ? ` → ${accountName(data, entry.toAccount)}` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RafaelOnboarding({ onStart }: { onStart: () => void }) {
  return (
    <div className="scroll grow" style={{ paddingBottom: 40 }}>
      <div className="wrap" style={{ maxWidth: 700, paddingTop: "5vh", display: "flex", flexDirection: "column", gap: 26 }}>
        <div className="stack" style={{ gap: 12 }}>
          <div className="chip"><Icon name="crown" size={14} /> let&apos;s build it</div>
          <h1 className="display" style={{ fontSize: "clamp(30px,7vw,48px)" }}>Build your portfolio flow</h1>
          <p className="muted" style={{ fontSize: 15.5, maxWidth: 480 }}>Nothing here yet. Three quick steps and we&apos;ll project your capital — day by day, months and years ahead.</p>
        </div>
        <div className="stack" style={{ gap: 12 }}>
          {([["sliders","Set the stage","Your debit card, optional credit card, and any other banks.",1],["transfer","Log your money moves","Income, expenses and transfers — one-time or recurring.",2],["spark","Generate the projection","Watch your capital trajectory, day by day, up to 10 years out.",3]] as const).map(([ic,t,s,n]) => (
            <div key={n} className="card" style={{ padding: 18, boxShadow: "none", display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in oklch,var(--accent) 16%,var(--surface))", color: "var(--accent)" }}><Icon name={ic} size={19} /></div>
              <div className="grow stack" style={{ gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 15.5 }}>{t}</span>
                <span className="muted" style={{ fontSize: 13 }}>{s}</span>
              </div>
              <span className="num display" style={{ fontSize: 26, color: "var(--line)" }}>{n}</span>
            </div>
          ))}
        </div>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <button className="btn primary lg" onClick={onStart}><Icon name="chevR" size={17} /> Start setup</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Tracker ──────────────────────────────────────────────────────────────
interface Props {
  initialData: RafaelData;
  userId: string;
  canEdit: boolean;
  theme: Theme;
  currency: Currency;
}

export default function RafaelTracker({ initialData, userId, canEdit, theme, currency }: Props) {
  const [data,      setData]      = useState<RafaelData>(initialData);
  const [range,     setRange]     = useState("6m");
  const [adding,    setAdding]    = useState(false);
  const [setup,     setSetup]     = useState(false);
  const [generated, setGenerated] = useState(data.entries.length > 0);
  const [vizKey,    setVizKey]    = useState(0); // increment to force chart remount
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any;

  // Re-fetch from DB and update local state — called by the Realtime hook
  const refreshFromDB = useCallback(async () => {
    const [s, a, e] = await Promise.all([
      supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("accounts").select("*").eq("user_id", userId),
      supabase.from("entries").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    setData(assembleRafaelData(s.data, a.data ?? [], e.data ?? []));
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live sync: only subscribe when viewing someone else's portfolio (read-only)
  useRealtimeSync(userId, refreshFromDB, !canEdit);

  const months   = RANGE_OPTIONS.find((r: RangeOption) => r.key === range)!.months;
  const opening  = rafOpening(data);
  const projection = useMemo(() => buildProjection(data.entries, opening, parseDate(data.startDate), months), [data.entries, opening, data.startDate, months]);

  const surplus    = projection.totalIn - projection.totalOut;
  const avgMonthly = surplus / months;
  const growthPct  = opening !== 0 ? ((projection.end - opening) / Math.abs(opening)) * 100 : 0;
  const rafStats   = [
    { label: "Total inflow",       value: fmtMoney(projection.totalIn,  currency), tone: "pos" as const },
    { label: "Total outflow",      value: fmtMoney(projection.totalOut, currency), tone: "neg" as const },
    { label: "Avg monthly surplus",value: fmtMoney(avgMonthly, currency, { sign: true }), tone: avgMonthly >= 0 ? "pos" as const : "neg" as const },
    { label: "Net worth growth",   value: (growthPct >= 0 ? "+" : "−") + Math.abs(growthPct).toFixed(1) + "%", tone: growthPct >= 0 ? "pos" as const : "neg" as const },
  ];

  const handleSetupSave = async (nd: RafaelData) => {
    const stamped = { ...nd, lastUpdated: Date.now() };
    setData(stamped);
    setSetup(false);
    await persistRafaelSetup(supabase, userId, stamped);
    // persistRafaelSetup upserts user_settings, which already bumps updated_at ✓
  };

  const handleAddEntry = async (entry: Entry) => {
    setData((d) => ({ ...d, entries: [entry, ...d.entries], lastUpdated: Date.now() }));
    setAdding(false);
    await addEntry(supabase, userId, entry);
    await touchLastUpdated(supabase, userId);
  };

  const handleDelete = async (id: string) => {
    setData((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id), lastUpdated: Date.now() }));
    await deleteEntry(supabase, id);
    await touchLastUpdated(supabase, userId);
  };

  const startFresh = async () => {
    if (!confirm("Clear your portfolio and start over from scratch?")) return;
    const empty: RafaelData = { setupDone: false, startDate: todayISO(), lastUpdated: Date.now(), accounts: { debit: { name: "Debit · Default", balance: 0, use: true }, credit: { name: "Credit card", balance: 0, use: false } }, banks: [], entries: [] };
    setData(empty);
    setGenerated(false);
    await supabase.from("entries").delete().eq("user_id", userId);
    await supabase.from("accounts").delete().eq("user_id", userId);
    await supabase.from("user_settings").upsert({ user_id: userId, setup_done: false }, { onConflict: "user_id" });
  };

  const c = COPY[theme];

  if (!data.setupDone) {
    if (!canEdit) return <PartnerEmptyState name="Rafael" noun="portfolio" />;
    return (
      <>
        <RafaelOnboarding onStart={() => setSetup(true)} />
        {setup && <RafaelSetupSheet data={data} onClose={() => setSetup(false)} onSave={handleSetupSave} />}
      </>
    );
  }

  const holdings = [
    { name: data.accounts.debit.name,  bal: data.accounts.debit.balance,  ic: "card",  isCredit: false },
    ...(data.accounts.credit.use ? [{ name: data.accounts.credit.name, bal: data.accounts.credit.balance, ic: "card", isCredit: true }] : []),
    ...data.banks.map((b) => ({ name: b.name, bal: b.balance, ic: "bank", isCredit: false })),
  ];

  const now = new Date();
  const hour = now.getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const emoji = hour < 12 ? "🌅" : hour < 18 ? "☀️" : "🌙";
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="scroll grow" style={{ paddingBottom: 40 }}>
      <div className="wrap" style={{ paddingTop: 22, display: "flex", flexDirection: "column", gap: 26 }}>

        {/* Greeting */}
        <div className="stack" style={{ gap: 6 }}>
          <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
            {canEdit
              ? <span className="display" style={{ fontSize: "clamp(20px,4vw,26px)" }}>Good {part}, Rafael {emoji}</span>
              : <span />}
            <span className="chip" style={{ fontSize: 11.5, fontWeight: 600 }}><Icon name="calendar" size={13} /> {dateStr}</span>
          </div>
          {data.lastUpdated && <span className="muted" style={{ fontSize: 11, alignSelf: canEdit ? "flex-start" : "flex-end" }}>Last updated {new Date(data.lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {new Date(data.lastUpdated).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>}
        </div>

        {/* What's next */}
        {data.entries.length > 0 && <NextUpPanel data={data} currency={currency} />}

        {/* Holdings */}
        <div className="stack" style={{ gap: 12 }}>
          <div className="between">
            <span className="eyebrow">Holdings</span>
            {canEdit && <button className="btn ghost" style={{ padding: "8px 12px", fontSize: 12.5 }} onClick={() => setSetup(true)}><Icon name="sliders" size={14} /> Accounts &amp; setup</button>}
          </div>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
            {holdings.map((h, i) => (
              <div key={i} className="card" style={{ padding: 16, boxShadow: "none" }}>
                <div className="row" style={{ gap: 8, color: h.isCredit ? "var(--neg)" : "var(--accent)" }}>
                  <Icon name={h.ic} size={16} />
                  <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{h.name}{h.isCredit ? " · owed" : ""}</span>
                </div>
                <div className="num" style={{ fontSize: 20, fontWeight: 700, marginTop: 8, color: h.isCredit ? "var(--neg)" : h.bal < 0 ? "var(--neg)" : "var(--txt)" }}>
                  {h.isCredit && h.bal > 0 ? "−" : ""}{fmtMoney(h.bal, currency)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily money flow report */}
        <div className="card" style={{ padding: "18px 20px" }}>
          {canEdit && (
            <div className="between" style={{ marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <span />
              <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> {c.addCta}</button>
            </div>
          )}
          {data.entries.length === 0 ? (
            <p className="muted center" style={{ padding: 30 }}>No transactions yet — add one above.</p>
          ) : (
            <DailyReport data={data} currency={currency} canEdit={canEdit} onDelete={handleDelete} />
          )}
        </div>

        {/* Visualization */}
        {data.entries.length === 0 ? (
          <div className="card" style={{ padding: "34px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: 50, height: 50, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in oklch,var(--accent) 16%,var(--surface))", color: "var(--accent)" }}><Icon name="spark" size={24} /></div>
            <span className="display" style={{ fontSize: 20 }}>Nothing to project yet</span>
            <p className="muted" style={{ fontSize: 13.5, maxWidth: 340 }}>Add at least one money move above, then generate your day-by-day projection.</p>
            {canEdit && <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> {c.addCta}</button>}
          </div>
        ) : !generated ? (
          <button className="btn primary lg block" onClick={() => setGenerated(true)}><Icon name="spark" size={18} /> {c.generate}</button>
        ) : (
          <div className="card" style={{ padding: "22px 20px" }}>
            <div className="between" style={{ marginBottom: 14 }}>
              <div className="stack" style={{ gap: 2 }}>
                <span className="display" style={{ fontSize: 22 }}>{c.vizTitle}</span>
                <span className="muted" style={{ fontSize: 12.5 }}>{c.vizSub} · from {fmtDate(parseDate(data.startDate))}</span>
              </div>
              <button className="icon-btn" onClick={() => setVizKey((k) => k + 1)} title="Refresh chart"><Icon name="repeat" size={17} /></button>
            </div>
            <Visualization key={vizKey} projection={projection} theme={theme} currency={currency} range={range} setRange={setRange} stats={rafStats}
              headline={`Opening ${fmtMoney(opening, currency)} → ${months >= 12 ? (months / 12) + " yr" : months + " mo"} out`} />
          </div>
        )}

        {canEdit && (
          <button className="btn ghost" style={{ alignSelf: "center", fontSize: 12, color: "var(--txt-3)", padding: "6px 12px" }} onClick={startFresh}>
            <Icon name="trash" size={13} /> start fresh
          </button>
        )}
      </div>

      {adding && <RafaelAddSheet data={data} onClose={() => setAdding(false)} onSave={handleAddEntry} />}
      {setup  && <RafaelSetupSheet data={data} onClose={() => setSetup(false)} onSave={handleSetupSave} />}
    </div>
  );
}
