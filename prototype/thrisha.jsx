/* ============================================================
   thrisha.jsx — Thrisha's tracker: money divisions + strict budget
   ============================================================ */

const GIRLY_COLORS = ["var(--pos)", "var(--accent)", "var(--lav)", "var(--blue)", "var(--transfer)", "var(--neg)"];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// "what you've got left" = spendable across non-savings pockets (incl. carryover)
function thrishaRemaining(data) {
  return data.divisions.filter((d) => !d.isSavings).reduce((s, d) => s + ((d.limit || 0) + (d.carryover || 0) - (d.spent || 0)), 0);
}
function savingsPocket(data) { return data.divisions.find((d) => d.isSavings) || null; }

// ---------------- SAVINGS HERO (top, beside "what you've got left") ----------------
function SavingsHero({ d, onOpen }) {
  const pcts = (d.pockets || []);
  const assigned = pcts.reduce((s, p) => s + (p.amount || 0), 0);
  return (
    <div className="card" style={{ padding: "20px 20px", display: "flex", flexDirection: "column", gap: 10, background: "linear-gradient(160deg, color-mix(in oklch,var(--pos) 16%,var(--surface)), var(--surface))", border: "1.5px solid color-mix(in oklch,var(--pos) 40%,var(--line))" }}>
      <div className="between">
        <span className="eyebrow" style={{ color: "var(--pos)" }}><Icon name="flower" size={12} style={{ verticalAlign: "-2px" }} /> Savings</span>
        <span className="chip" style={{ fontSize: 9.5, padding: "3px 8px", color: "var(--pos)", borderColor: "color-mix(in oklch,var(--pos) 40%,var(--line))" }}><Icon name="lock" size={10} /> auto</span>
      </div>
      <div className="num display" style={{ fontSize: "clamp(26px,6vw,40px)", color: "var(--pos)" }}>{fmtMoney(d.balance || 0)}</div>
      <span className="muted" style={{ fontSize: 11.5 }}>auto-saved {fmtMoney(d.limit)}/mo · total nest egg 🥚</span>
      {pcts.length > 0 && (
        <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", background: "var(--surface-2)" }}>
          {pcts.map((p) => <div key={p.id} style={{ flex: p.amount || 0, background: p.color }} />)}
          {(d.balance - assigned) > 0 && <div style={{ flex: d.balance - assigned, background: "var(--line)" }} />}
        </div>
      )}
      <button className="btn ghost" style={{ alignSelf: "flex-start", padding: "8px 12px", fontSize: 12.5 }} onClick={onOpen}>
        <Icon name="eye" size={14} /> what's inside · {pcts.length} pocket{pcts.length === 1 ? "" : "s"}
      </button>
    </div>
  );
}

// ---------------- SAVINGS SHEET (manage savings sub-pockets) ----------------
function SavingsSheet({ savings, canEdit, onClose, onSave }) {
  const [pockets, setPockets] = useState(() => (savings.pockets || []).map((p) => ({ ...p, monthly: p.monthly ?? 0 })));
  const assigned = pockets.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const unassigned = (savings.balance || 0) - assigned;
  const monthlyTotal = pockets.reduce((s, p) => s + (parseFloat(p.monthly) || 0), 0);
  const monthlyLeft = (savings.limit || 0) - monthlyTotal;

  const add = () => setPockets((ps) => [...ps, { id: "sp" + Date.now(), name: "", color: GIRLY_COLORS[ps.length % GIRLY_COLORS.length], amount: 0, monthly: 0 }]);
  const setP = (id, patch) => setPockets((ps) => ps.map((p) => p.id === id ? { ...p, ...patch } : p));
  const del = (id) => setPockets((ps) => ps.filter((p) => p.id !== id));
  const valid = pockets.every((p) => p.name.trim()) && assigned <= (savings.balance || 0) + 0.01 && monthlyTotal <= (savings.limit || 0) + 0.01;

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="stack" style={{ gap: 2 }}>
            <span className="display" style={{ fontSize: 22 }}>inside your savings 🥚</span>
            <span className="muted" style={{ fontSize: 12 }}>total {fmtMoney(savings.balance || 0)} · grows {fmtMoney(savings.limit || 0)}/mo</span>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="sheet-body">
          <div className="row" style={{ gap: 10 }}>
            <div className="card grow" style={{ boxShadow: "none", padding: "12px 14px", background: unassigned < 0 ? "color-mix(in oklch,var(--neg) 12%,var(--surface))" : "var(--surface-2)", textAlign: "center" }}>
              <span className="eyebrow" style={{ fontSize: 9.5 }}>unassigned now</span>
              <div className="num display" style={{ fontSize: 22, color: unassigned < 0 ? "var(--neg)" : "var(--txt)" }}>{fmtMoney(unassigned)}</div>
            </div>
            <div className="card grow" style={{ boxShadow: "none", padding: "12px 14px", background: monthlyLeft < 0 ? "color-mix(in oklch,var(--neg) 12%,var(--surface))" : "var(--surface-2)", textAlign: "center" }}>
              <span className="eyebrow" style={{ fontSize: 9.5 }}>auto-adds / month</span>
              <div className="num display" style={{ fontSize: 22, color: monthlyLeft < 0 ? "var(--neg)" : "var(--pos)" }}>{fmtMoney(monthlyTotal)}</div>
            </div>
          </div>
          <p className="muted center" style={{ fontSize: 11.5, marginTop: -6 }}>each goal grows by its monthly amount on the 1st 🌙 · {fmtMoney(monthlyLeft)} of your {fmtMoney(savings.limit || 0)} still free</p>

          {pockets.length === 0 && <p className="muted center" style={{ fontSize: 13.5, padding: "8px 0" }}>no savings goals yet — make one like Travel ✈️ or Emergency 🚑</p>}

          {pockets.map((p) => (
            <div key={p.id} className="card" style={{ boxShadow: "none", padding: 14, background: "var(--surface-2)", display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="row" style={{ gap: 10 }}>
                <span className="dot" style={{ width: 26, height: 26, borderRadius: "50%", background: p.color, flex: "none", boxShadow: "0 0 0 3px color-mix(in oklch," + p.color + " 22%, transparent)" }} />
                <input className="input grow" placeholder="goal name (Travel, Emergency…)" value={p.name} onChange={(e) => setP(p.id, { name: e.target.value })} disabled={!canEdit} style={{ padding: "9px 12px" }} />
                {canEdit && <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => del(p.id)}><Icon name="trash" size={15} /></button>}
              </div>
              <div className="row" style={{ gap: 6 }}>
                {GIRLY_COLORS.map((c) => (
                  <button key={c} onClick={() => canEdit && setP(p.id, { color: c })} style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: p.color === c ? "3px solid var(--txt)" : "2px solid var(--line)" }} />
                ))}
              </div>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <div className="field grow" style={{ minWidth: 120 }}><span className="label" style={{ fontSize: 10.5 }}>saved so far</span>
                  <input className="input num" inputMode="decimal" placeholder="0" value={p.amount} onChange={(e) => setP(p.id, { amount: e.target.value.replace(/[^0-9.]/g, "") })} disabled={!canEdit} style={{ padding: "9px 12px" }} /></div>
                <div className="field grow" style={{ minWidth: 120 }}><span className="label" style={{ fontSize: 10.5, color: "var(--pos)" }}>+ adds each month</span>
                  <input className="input num" inputMode="decimal" placeholder="0" value={p.monthly} onChange={(e) => setP(p.id, { monthly: e.target.value.replace(/[^0-9.]/g, "") })} disabled={!canEdit} style={{ padding: "9px 12px" }} /></div>
              </div>
            </div>
          ))}
          {canEdit && <button className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={add}><Icon name="plus" size={16} /> new savings goal</button>}
          {unassigned < 0 && <span className="t-expense center" style={{ fontSize: 12, fontWeight: 600 }}>you've assigned more than you've saved — trim it back 💔</span>}
          {monthlyLeft < 0 && <span className="t-expense center" style={{ fontSize: 12, fontWeight: 600 }}>your monthly goals add up to more than you save each month 💔</span>}
        </div>
        {canEdit && (
          <div className="sheet-foot">
            <button className="btn grow" onClick={onClose}>cancel</button>
            <button className="btn primary grow" disabled={!valid} onClick={() => onSave(pockets.filter((p) => p.name.trim()).map((p) => {
              const monthly = parseFloat(p.monthly) || 0;
              let amount = parseFloat(p.amount) || 0;
              if (amount === 0 && monthly > 0) amount = monthly; // first month's contribution
              return { ...p, amount, monthly };
            }))}><Icon name="check" size={16} /> save goals</button>
          </div>
        )}
      </div>
    </div>
  );
}
function DivisionCard({ d, canEdit, onEdit }) {
  const isFixed = d.mode === "fixed";
  const st = budgetStatus(d);

  return (
    <div className="card pop-in" style={{
      padding: 18, boxShadow: "none", display: "flex", flexDirection: "column", gap: 12,
      border: (!isFixed && st.tone === "bad") || (isFixed && fixedStatus(d).urgency === "overdue") ? "1.5px solid var(--neg)" : "1px solid var(--line)",
    }}>
      <div className="between">
        <div className="row" style={{ gap: 10 }}>
          <span className="dot" style={{ width: 14, height: 14, background: d.color, boxShadow: "0 0 0 4px color-mix(in oklch," + d.color + " 22%, transparent)" }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>{d.name}</span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <span className="chip" style={{ fontSize: 9.5, padding: "3px 8px", letterSpacing: "0.04em" }}>
            {isFixed ? <><Icon name="check" size={10} /> FIXED</> : <><Icon name="repeat" size={10} /> RECURRING</>}
          </span>
          {canEdit && <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={onEdit}><Icon name="edit" size={14} /></button>}
        </div>
      </div>

      {isFixed ? <FixedBody d={d} /> : <RecurringBody d={d} st={st} />}
    </div>
  );
}

// recurring: spending budget — strict no-overbudget, unused rolls over
function RecurringBody({ d, st }) {
  const note = st.tone === "bad" ? "babe. you went OVER. that's a no 💔" : pick(THRISHA_NOTES[st.mood] || [""]);
  const barCol = st.tone === "bad" ? "var(--neg)" : st.tone === "warn" ? "var(--accent)" : d.color;
  return (
    <>
      <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
        <span className="num" style={{ fontSize: 26, fontWeight: 700, color: st.remaining < 0 ? "var(--neg)" : "var(--txt)" }}>{fmtMoney(st.remaining)}</span>
        <span className="muted" style={{ fontSize: 12.5 }}>left of {fmtMoney(st.effective)}</span>
      </div>
      {d.carryover > 0 && (
        <span className="chip" style={{ alignSelf: "flex-start", fontSize: 10.5, padding: "4px 9px", color: "var(--pos)", borderColor: "color-mix(in oklch,var(--pos) 40%,var(--line))" }}>
          <Icon name="repeat" size={11} /> {fmtMoney(d.limit)} + {fmtMoney(d.carryover)} rolled over
        </span>
      )}
      <div style={{ height: 10, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
        <div style={{ width: Math.min(100, st.pct * 100) + "%", height: "100%", borderRadius: 999, background: barCol, transition: "width .5s cubic-bezier(.2,.8,.2,1)", animation: st.tone === "bad" ? "shake .5s" : "none" }} />
      </div>
      <div className="row" style={{ gap: 8 }}>
        <span style={{ fontSize: 18 }}>{st.tone === "bad" ? "💔" : st.tone === "warn" ? "🚧" : st.mood === "comfy" ? "💖" : "🫶"}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: st.tone === "bad" ? "var(--neg)" : st.tone === "warn" ? "var(--accent)" : "var(--txt-2)" }}>{note}</span>
      </div>
    </>
  );
}

// fixed: must-pay obligation with a monthly deadline — strict about the deadline
function FixedBody({ d }) {
  const fs = fixedStatus(d);
  const pct = d.limit > 0 ? Math.min(100, (d.spent / d.limit) * 100) : 0;
  const note = fs.done ? null : pick(FIXED_NOTES[fs.urgency] || FIXED_NOTES.open);
  return (
    <>
      <div className="row" style={{ alignItems: "baseline", gap: 8 }}>
        <span className="num" style={{ fontSize: 26, fontWeight: 700 }}>{fmtMoney(Math.max(0, d.limit - d.spent))}</span>
        <span className="muted" style={{ fontSize: 12.5 }}>to pay of {fmtMoney(d.limit)}</span>
      </div>
      <span className="chip" style={{ alignSelf: "flex-start", fontSize: 10.5, padding: "4px 9px" }}>
        <Icon name="calendar" size={11} /> due by the {ordinal(d.deadlineDay || 1)}
      </span>
      <div style={{ height: 10, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", borderRadius: 999, background: fs.done ? "var(--pos)" : fs.urgency === "overdue" ? "var(--neg)" : d.color, transition: "width .5s", animation: fs.urgency === "overdue" ? "shake .5s" : "none" }} />
      </div>
      {fs.done ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", fontSize: 12.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999, background: "color-mix(in oklch,var(--pos) 16%,var(--surface))", color: "var(--pos)", border: "1px solid var(--pos)" }}>
          <Icon name="check" size={13} /> paid — done this month
        </span>
      ) : (
        <div className="row" style={{ gap: 8 }}>
          <span style={{ fontSize: 18 }}>{fs.urgency === "overdue" ? "🛑" : fs.urgency === "soon" ? "🔔" : "📌"}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: fs.urgency === "overdue" ? "var(--neg)" : "var(--txt-2)" }}>
            {fs.urgency === "overdue" ? `${Math.abs(fs.daysLeft)}d overdue — ` : fs.daysLeft === 0 ? "due today — " : `${fs.daysLeft}d left — `}{note}
          </span>
        </div>
      )}
    </>
  );
}

// ---------------- DIVISION EDIT SHEET ----------------
function DivisionSheet({ div, onClose, onSave, onDelete }) {
  const isNew = !div;
  const isSavings = !!div?.isSavings;
  const [name, setName] = useState(div?.name || "");
  const [limit, setLimit] = useState(String(div?.limit ?? ""));
  const [color, setColor] = useState(div?.color || GIRLY_COLORS[0]);
  const [mode, setMode] = useState(div?.mode || "recurring");
  const [deadlineDay, setDeadlineDay] = useState(div?.deadlineDay || 15);
  const valid = name.trim() && parseFloat(limit) >= 0;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="display" style={{ fontSize: 22 }}>{isNew ? "New money pocket ✿" : isSavings ? "Edit Savings" : "Edit pocket"}</span>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="sheet-body">
          {isSavings ? (
            <div className="chip" style={{ alignSelf: "flex-start", fontSize: 11, color: "var(--pos)", borderColor: "var(--pos)" }}><Icon name="lock" size={12} /> default pocket · fixed · due the 1st</div>
          ) : (
            <div className="field"><span className="label">What's it for?</span>
              <input className="input" placeholder="Food, Self-care, Leisure…" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
          )}
          <div className="field"><span className="label">{isSavings ? "Monthly savings target" : mode === "fixed" ? "Amount due each month" : "Monthly budget"}</span>
            <input className="input num" inputMode="decimal" placeholder="0.00" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^0-9.]/g, ""))} style={{ fontSize: 22, fontWeight: 700 }} /></div>
          <div className="field"><span className="label">Pick a color</span>
            <div className="row" style={{ gap: 10 }}>
              {GIRLY_COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width: 36, height: 36, borderRadius: "50%", background: c,
                  border: color === c ? "3px solid var(--txt)" : "2px solid var(--line)", transition: "all .15s",
                }} />
              ))}
            </div>
          </div>
          {!isSavings && (
            <div className="field"><span className="label">Tracking style</span>
              <div className="seg" style={{ alignSelf: "flex-start" }}>
                <button className={mode === "recurring" ? "on" : ""} onClick={() => setMode("recurring")}><Icon name="repeat" size={13} /> recurring</button>
                <button className={mode === "fixed" ? "on" : ""} onClick={() => setMode("fixed")}><Icon name="check" size={13} /> fixed</button>
              </div>
              <span className="muted" style={{ fontSize: 11.5 }}>{mode === "recurring" ? "spending budget — don't go over; leftovers roll over 💅" : "must-pay bill/goal with a monthly deadline"}</span>
            </div>
          )}
          {!isSavings && mode === "fixed" && (
            <div className="field"><span className="label">📅 due by day of month</span>
              <div className="card" style={{ boxShadow: "none", padding: "10px 14px", background: "var(--surface-2)", display: "flex", alignItems: "center", gap: 12 }}>
                <input type="range" min="1" max="28" step="1" value={deadlineDay} onChange={(e) => setDeadlineDay(parseInt(e.target.value, 10))} style={{ flex: 1 }} />
                <span className="chip" style={{ whiteSpace: "nowrap", fontWeight: 700 }}>{ordinal(deadlineDay)}</span>
              </div>
            </div>
          )}
        </div>
        <div className="sheet-foot">
          {!isNew && !isSavings && <button className="btn" onClick={() => onDelete(div.id)}><Icon name="trash" size={16} /></button>}
          <button className="btn primary grow" disabled={!valid} onClick={() => onSave({
            id: div?.id || "d" + Date.now(),
            name: isSavings ? "Savings" : name.trim(),
            limit: parseFloat(limit), color,
            spent: div?.spent || 0, carryover: div?.carryover || 0,
            mode: isSavings ? "fixed" : mode,
            deadlineDay: isSavings ? 1 : (mode === "fixed" ? deadlineDay : undefined),
            isSavings, ...(isSavings ? { balance: div?.balance || 0 } : {}),
            allocation: div?.allocation || parseFloat(limit) || 0,
          })}><Icon name="check" size={16} /> Save pocket</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- ADD MOMENT SHEET ----------------
// expense: amount → which pocket → specified date → note
// income:  amount → how often → start date → note  (no pocket)
function ThrishaAddSheet({ data, onClose, onSave }) {
  const spend = data.divisions.filter((d) => !d.isSavings);
  const savDiv = data.divisions.find((d) => d.isSavings);
  const savGoals = (savDiv?.pockets || []);
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [division, setDivision] = useState(spend[0]?.id);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO);          // expense: single date
  const [rec, setRec] = useState({ kind: "monthly", startDate: todayISO }); // income recurrence
  const amt = parseFloat(amount) || 0;
  const valid = amt > 0 && (type === "income" || division);

  const isSavTarget = type === "expense" && division && division.startsWith("sav:");
  const div = isSavTarget ? null : (type === "expense" ? data.divisions.find((d) => d.id === division) : null);
  const savGoal = isSavTarget ? savGoals.find((g) => g.id === division.slice(4)) : null;
  const preview = div ? budgetStatus({ ...div, spent: (div.spent || 0) + amt }) : null;

  const submit = () => {
    if (type === "expense") {
      const cat = isSavTarget ? (savGoal?.name || "Savings") : (div?.name || "Money");
      onSave({ id: "t" + Date.now(), type: "expense", amount: amt, division, category: cat, note, recurrence: { kind: "once", date } });
    } else {
      onSave({ id: "t" + Date.now(), type: "income", amount: amt, division: null, category: "Income", note, recurrence: rec });
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="display" style={{ fontSize: 22 }}>add a money moment</span>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="sheet-body">
          <div className="seg" style={{ alignSelf: "center" }}>
            <button className={type === "income" ? "on" : ""} onClick={() => setType("income")}>💵 income</button>
            <button className={type === "expense" ? "on" : ""} onClick={() => setType("expense")}>🛍️ expense</button>
          </div>

          <div className="field"><span className="label">How much?</span>
            <input className="input num" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} style={{ fontSize: 26, fontWeight: 700, textAlign: "center" }} autoFocus /></div>

          {type === "expense" ? (
            <>
              <div className="field"><span className="label">Which pocket?</span>
                <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                  {spend.map((d) => (
                    <button key={d.id} className="chip" onClick={() => setDivision(d.id)} style={{
                      cursor: "pointer", borderColor: division === d.id ? "var(--accent)" : "var(--line)",
                      background: division === d.id ? "color-mix(in oklch,var(--accent) 14%,var(--surface))" : "var(--surface-2)", color: "var(--txt)",
                    }}><span className="dot" style={{ background: d.color }} />{d.name}</button>
                  ))}
                </div>
                {savGoals.length > 0 && (
                  <>
                    <span className="label" style={{ marginTop: 6, color: "var(--pos)" }}>…or spend from a savings goal 🥚</span>
                    <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                      {savGoals.map((g) => {
                        const key = "sav:" + g.id;
                        return (
                          <button key={g.id} className="chip" onClick={() => setDivision(key)} style={{
                            cursor: "pointer", borderColor: division === key ? "var(--pos)" : "var(--line)",
                            background: division === key ? "color-mix(in oklch,var(--pos) 14%,var(--surface))" : "var(--surface-2)", color: "var(--txt)",
                          }}><span className="dot" style={{ background: g.color }} />{g.name} · {fmtMoney(g.amount || 0)}</button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {isSavTarget && amt > 0 && savGoal && (
                <div className="card" style={{ padding: "12px 14px", boxShadow: "none", background: amt > (savGoal.amount || 0) ? "color-mix(in oklch,var(--neg) 12%,var(--surface))" : "var(--surface-2)" }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{amt > (savGoal.amount || 0) ? "🛑" : "🥚"}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: amt > (savGoal.amount || 0) ? "var(--neg)" : "var(--txt-2)" }}>
                      {amt > (savGoal.amount || 0)
                        ? <>that's more than {savGoal.name} has saved ({fmtMoney(savGoal.amount || 0)}) — careful 💔</>
                        : <>pulls from {savGoal.name} · <b className="num">{fmtMoney((savGoal.amount || 0) - amt)}</b> would remain</>}
                    </span>
                  </div>
                </div>
              )}

              {preview && amt > 0 && div && (div.mode === "fixed" ? (
                <div className="card" style={{ padding: "12px 14px", boxShadow: "none", background: "var(--surface-2)" }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{preview.remaining <= 0 ? "✅" : "•"}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--txt-2)" }}>
                      {div.name}: <b className="num">{fmtMoney(Math.max(0, preview.remaining))}</b> left to pay — {preview.remaining <= 0 ? "that clears it ✓" : "not done yet"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding: "12px 14px", boxShadow: "none", background: preview.tone === "bad" ? "color-mix(in oklch,var(--neg) 12%,var(--surface))" : "var(--surface-2)" }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{preview.tone === "bad" ? "😭" : preview.tone === "warn" ? "🚧" : "💖"}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: preview.tone === "bad" ? "var(--neg)" : "var(--txt-2)" }}>
                      {preview.remaining < 0 ? <>that puts {div.name} <b>{fmtMoney(-preview.remaining)}</b> over — don't 💔</> : <>{div.name} would have <b className="num">{fmtMoney(preview.remaining)}</b> left — {pick(THRISHA_NOTES[preview.mood])}</>}
                    </span>
                  </div>
                </div>
              ))}

              <div className="field"><span className="label">On what date?</span>
                <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            </>
          ) : (
            <RecurrencePicker rec={rec} setRec={setRec} />
          )}

          <div className="field"><span className="label">Note <span className="muted">(optional)</span></span>
            <input className="input" placeholder={type === "income" ? "where's it from? 💌" : "treat yourself responsibly 💅"} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <div className="sheet-foot">
          <button className="btn grow" onClick={onClose}>nvm</button>
          <button className="btn primary grow" disabled={!valid} onClick={submit}><Icon name="check" size={16} /> add it</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- ONBOARDING (from scratch) ----------------
function ThrishaOnboarding({ onStart, onSample }) {
  const steps = [
    { ic: "flower", t: "Make your money pockets", s: "Savings, Food, Self-care… name them and set a budget for each." },
    { ic: "heart", t: "Add your money moments", s: "Income and expenses auto-adjust each pocket's balance." },
    { ic: "spark", t: "Watch it bloom", s: "A soft day-by-day picture of your money, months ahead." },
  ];
  return (
    <div className="scroll grow" style={{ paddingBottom: 40 }}>
      <div className="wrap" style={{ maxWidth: 660, paddingTop: "5vh", display: "flex", flexDirection: "column", gap: 24 }}>
        <div className="stack" style={{ gap: 12, alignItems: "flex-start" }}>
          <div className="chip"><Icon name="heart" size={14} /> let's set up your garden ✿</div>
          <h1 className="display" style={{ fontSize: "clamp(30px,7vw,46px)" }}>plant your money garden 🌷</h1>
          <p className="muted" style={{ fontSize: 15.5, maxWidth: 460 }}>nothing here yet, cutie. let's make a few pockets and your budget will keep you cozy &amp; on track 💗</p>
        </div>
        <div className="stack" style={{ gap: 12 }}>
          {steps.map((st, i) => (
            <div key={i} className="card" style={{ padding: 18, boxShadow: "none", display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in oklch,var(--accent) 16%,var(--surface))", color: "var(--accent)" }}>
                <Icon name={st.ic} size={20} />
              </div>
              <div className="grow stack" style={{ gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 15.5 }}>{st.t}</span>
                <span className="muted" style={{ fontSize: 13 }}>{st.s}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <button className="btn primary lg" onClick={onStart}><Icon name="plus" size={17} /> make my first pocket</button>
          <button className="btn lg" onClick={onSample}><Icon name="spark" size={16} /> load sample data</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- MAIN ----------------
function ThrishaTracker({ data, canEdit, update, theme, me }) {
  const [range, setRange] = useState("6m");
  const [adding, setAdding] = useState(false);
  const [editDiv, setEditDiv] = useState(undefined); // undefined=closed, null=new, obj=edit
  const [savingsOpen, setSavingsOpen] = useState(false);
  const [generated, setGenerated] = useState(data.entries.length > 0);
  const months = RANGE_OPTIONS.find((r) => r.key === range).months;

  const opening = thrishaRemaining(data);
  const projection = useMemo(() => {
    // the monthly savings is set aside automatically — deduct it from the flow each month
    const savAmt = (data.divisions.find((d) => d.isSavings)?.limit) || 0;
    const setAside = savAmt > 0
      ? [{ id: "__savings", type: "expense", amount: savAmt, division: null, category: "Savings set-aside", recurrence: { kind: "monthly", startDate: data.startDate } }]
      : [];
    return buildProjection([...data.entries, ...setAside], opening, parseDate(data.startDate), months);
  }, [data.entries, data.divisions, opening, data.startDate, months]);

  // auto-detect a new month (the 1st) and roll everything over — no manual button
  useEffect(() => {
    if (!canEdit || !data.divisions.length) return;
    const rolled = applyDueRollovers(data, new Date());
    if (rolled) update(() => rolled);
  }, [canEdit, data.divisions.length, data.lastRollover]);

  const loadSample = () => update(() => clone(SEED.Thrisha));
  const startFresh = () => { update(() => clone(EMPTY.Thrisha)); setGenerated(false); };

  if (data.divisions.length === 0) {
    if (!canEdit) return <FlowEmpty who="Thrisha" theme={theme} />;
    return (
      <ThrishaWizard
        onSample={loadSample}
        onFinish={(res) => update((d) => {
          const now = new Date();
          const start = isoDate(new Date(now.getFullYear(), now.getMonth(), Math.min(res.payday, 28)));
          const incomeEntry = res.monthlyIncome > 0
            ? [{ id: "inc" + Date.now(), type: "income", amount: res.monthlyIncome, division: null, category: "Monthly income", note: "lands every month", recurrence: { kind: "monthly", startDate: start } }]
            : [];
          // default Savings auto-fills to its budget immediately
          const divisions = res.divisions.map((dv) => dv.isSavings
            ? { ...dv, spent: dv.limit, balance: dv.limit, pockets: [] }
            : dv);
          return { ...d, monthlyIncome: res.monthlyIncome, payday: res.payday, startDate: start, lastRollover: monthKey(now), divisions, entries: incomeEntry };
        })} />
    );
  }


  const sav = savingsPocket(data);
  const otherPockets = data.divisions.filter((d) => !d.isSavings);
  const overs = otherPockets.filter((d) => d.mode !== "fixed" && d.spent > ((d.limit || 0) + (d.carryover || 0)));
  const overdueFixed = data.divisions.filter((d) => d.mode === "fixed" && fixedStatus(d).urgency === "overdue");
  const totalLimit = otherPockets.reduce((s, d) => s + (d.limit || 0) + (d.carryover || 0), 0);
  const totalSpent = otherPockets.reduce((s, d) => s + (d.spent || 0), 0);

  // money bloom stats (replaces peak / lowest)
  const monthsCount = months;
  const netFlow = projection.totalIn - projection.totalOut;
  const avgMonthlyNet = netFlow / monthsCount;
  const saveRate = projection.totalIn > 0 ? Math.round((netFlow / projection.totalIn) * 100) : 0;
  const thrishaStats = [
    { label: "money in", value: fmtMoney(projection.totalIn), tone: "pos" },
    { label: "money out", value: fmtMoney(projection.totalOut), tone: "neg" },
    { label: "avg left / mo", value: fmtMoney(avgMonthlyNet, { sign: true }), tone: avgMonthlyNet >= 0 ? "pos" : "neg" },
    { label: "savings rate", value: saveRate + "%", tone: saveRate >= 0 ? "pos" : "neg" },
  ];

  const saveEntry = (e) => {
    update((d) => {
      const next = { ...d, entries: [e, ...d.entries] };
      if (e.type === "expense" && e.division) {
        if (e.division.startsWith("sav:")) {
          // spending from a savings goal: draw down that goal AND the total nest egg
          const spId = e.division.slice(4);
          next.divisions = d.divisions.map((dv) => {
            if (!dv.isSavings) return dv;
            return {
              ...dv,
              balance: Math.max(0, (dv.balance || 0) - e.amount),
              pockets: (dv.pockets || []).map((p) => p.id === spId ? { ...p, amount: Math.max(0, (p.amount || 0) - e.amount) } : p),
            };
          });
        } else {
          next.divisions = d.divisions.map((dv) => dv.id === e.division ? { ...dv, spent: Math.max(0, (dv.spent || 0) + e.amount) } : dv);
        }
      }
      return next;
    });
    setAdding(false);
  };

  const saveSavingsPockets = (pockets) => {
    update((d) => ({ ...d, divisions: d.divisions.map((dv) => dv.isSavings ? { ...dv, pockets } : dv) }));
    setSavingsOpen(false);
  };

  return (
    <div className="scroll grow" style={{ paddingBottom: 40 }}>
      <div className="wrap" style={{ paddingTop: 22, display: "flex", flexDirection: "column", gap: 22 }}>

        <Greeting name="Thrisha" mine={canEdit} lastUpdated={data.lastUpdated} />

        {/* hero: what's left + savings side by side */}
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: sav ? "1.5fr 1fr" : "1fr" }}>
          <div className="card" style={{ padding: "22px 22px", textAlign: "center", background: "linear-gradient(160deg, color-mix(in oklch,var(--accent) 14%,var(--surface)), var(--surface))", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <span className="eyebrow"><Icon name="flower" size={12} style={{ verticalAlign: "-2px" }} /> {COPY[theme].netLabel}</span>
            <div className="num display" style={{ fontSize: "clamp(32px,8vw,50px)", margin: "6px 0", color: thrishaRemaining(data) < 0 ? "var(--neg)" : "var(--txt)" }}>{fmtMoney(thrishaRemaining(data))}</div>
            <span className="muted" style={{ fontSize: 12.5 }}>across {otherPockets.length} pockets · {fmtMoney(totalSpent)} of {fmtMoney(totalLimit)} used</span>
            {data.monthlyIncome > 0 && (
              <div className="chip" style={{ margin: "12px auto 0", fontSize: 11 }}><Icon name="heart" size={12} /> {fmtMoney(data.monthlyIncome)}/mo · lands {ordinal(data.payday || 1)}</div>
            )}
          </div>
          {sav && <SavingsHero d={sav} onOpen={() => setSavingsOpen(true)} />}
        </div>

        {/* strict alerts */}
        {overs.length > 0 && (
          <div className="card pop-in" style={{ padding: "14px 18px", background: "color-mix(in oklch,var(--neg) 12%,var(--surface))", border: "1.5px solid var(--neg)" }}>
            <div className="row" style={{ gap: 10 }}>
              <span style={{ fontSize: 22 }}>😤</span>
              <div className="stack" style={{ gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 14.5, color: "var(--neg)" }}>okay we need to talk.</span>
                <span style={{ fontSize: 13, color: "var(--txt-2)" }}>you've gone over on <b>{overs.map((o) => o.name).join(", ")}</b>. that's a no — pull it back, babe 💔</span>
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
                <span style={{ fontSize: 13, color: "var(--txt-2)" }}><b>{overdueFixed.map((o) => o.name).join(", ")}</b> {overdueFixed.length > 1 ? "were" : "was"} due already. pay {overdueFixed.length > 1 ? "them" : "it"} now — no excuses.</span>
              </div>
            </div>
          </div>
        )}

        {/* divisions (savings excluded) */}
        <div className="stack" style={{ gap: 12 }}>
          <div className="between">
            <span className="display" style={{ fontSize: 22 }}>my money pockets</span>
            <div className="row" style={{ gap: 8 }}>
              {canEdit && <button className="btn ghost" style={{ padding: "8px 12px", fontSize: 12.5 }} onClick={() => setEditDiv(null)}><Icon name="plus" size={14} /> new pocket</button>}
            </div>
          </div>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(248px,1fr))" }}>
            {otherPockets.map((d) => <DivisionCard key={d.id} d={d} canEdit={canEdit} onEdit={() => setEditDiv(d)} />)}
          </div>
        </div>

        {/* add moment */}
        {canEdit && <button className="btn primary lg block" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> {COPY[theme].addCta}</button>}

        {/* visualization */}
        {data.entries.length === 0 ? (
          <div className="card" style={{ padding: "32px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 34 }}>🌱</span>
            <span className="display" style={{ fontSize: 20 }}>your bloom is waiting</span>
            <p className="muted" style={{ fontSize: 13.5, maxWidth: 320 }}>add a money moment and your garden will start to bloom across the months.</p>
          </div>
        ) : !generated ? (
          <button className="btn primary lg block" onClick={() => setGenerated(true)}><Icon name="spark" size={18} /> {COPY[theme].generate}</button>
        ) : (
          <div className="card" style={{ padding: "22px 20px" }}>
            <div className="between" style={{ marginBottom: 14 }}>
              <div className="stack" style={{ gap: 2 }}>
                <span className="display" style={{ fontSize: 22 }}>{COPY[theme].vizTitle} 🌸</span>
                <span className="muted" style={{ fontSize: 12.5 }}>{COPY[theme].vizSub} · from {fmtDate(parseDate(data.startDate))}</span>
              </div>
              <button className="icon-btn" onClick={() => { setGenerated(false); setTimeout(() => setGenerated(true), 60); }}><Icon name="repeat" size={17} /></button>
            </div>
            <Visualization projection={projection} theme={theme} who="Thrisha" range={range} setRange={setRange} stats={thrishaStats}
              headLabel="your savings 🥚" headValue={(sav ? sav.balance || 0 : 0) + (sav ? (sav.limit || 0) * months : 0)} headDelta={sav ? (sav.limit || 0) * months : 0}
              headline={`saving ${fmtMoney(sav ? sav.limit || 0 : 0)}/mo → ${months >= 12 ? (months / 12) + " yr" : months + " mo"} of growth`} />
          </div>
        )}

        {canEdit && (
          <button className="btn ghost" style={{ alignSelf: "center", fontSize: 12, color: "var(--txt-3)", padding: "6px 12px" }}
            onClick={() => { if (confirm("Clear your garden and start over from scratch?")) startFresh(); }}>
            <Icon name="trash" size={13} /> start fresh
          </button>
        )}
      </div>

      {adding && <ThrishaAddSheet data={data} onClose={() => setAdding(false)} onSave={saveEntry} />}
      {savingsOpen && sav && <SavingsSheet savings={sav} canEdit={canEdit} onClose={() => setSavingsOpen(false)} onSave={saveSavingsPockets} />}
      {editDiv !== undefined && (
        <DivisionSheet div={editDiv} onClose={() => setEditDiv(undefined)}
          onSave={(nd) => { update((d) => ({ ...d, divisions: editDiv ? d.divisions.map((x) => x.id === nd.id ? nd : x) : [...d.divisions, nd] })); setEditDiv(undefined); }}
          onDelete={(id) => { update((d) => ({ ...d, divisions: d.divisions.filter((x) => x.id !== id) })); setEditDiv(undefined); }} />
      )}
    </div>
  );
}

Object.assign(window, { ThrishaTracker, DivisionCard, SavingsHero, SavingsSheet, RecurringBody, FixedBody, DivisionSheet, ThrishaAddSheet, thrishaRemaining, savingsPocket });
