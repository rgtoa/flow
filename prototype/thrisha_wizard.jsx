/* ============================================================
   thrisha_wizard.jsx — from-scratch setup: income+payday → pockets → budgets
   ============================================================ */

const WIZ_COLORS = ["var(--pos)", "var(--accent)", "var(--lav)", "var(--blue)", "var(--transfer)", "var(--neg)"];

// ---------- donut geometry ----------
function polar(cx, cy, r, ang) { const a = (ang - 90) * Math.PI / 180; return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; }
function donutArc(cx, cy, rO, rI, a0, a1) {
  if (a1 - a0 >= 359.999) a1 = a0 + 359.999;
  const oS = polar(cx, cy, rO, a1), oE = polar(cx, cy, rO, a0);
  const iS = polar(cx, cy, rI, a0), iE = polar(cx, cy, rI, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${oS.x} ${oS.y} A${rO} ${rO} 0 ${large} 0 ${oE.x} ${oE.y} L${iS.x} ${iS.y} A${rI} ${rI} 0 ${large} 1 ${iE.x} ${iE.y} Z`;
}

const ordinal = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

// ---------- budget donut (read-only visual for the allocate step) ----------
function BudgetDonut({ income, pockets, budgets }) {
  const total = pockets.reduce((s, p) => s + (budgets[p.id] || 0), 0);
  const unalloc = Math.max(0, income - total);
  const over = total > income;
  const cx = 130, cy = 130, rO = 120, rI = 76;
  const slices = [];
  let acc = 0;
  const denom = Math.max(income, total, 1);
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
          <path key={s.id} d={donutArc(cx, cy, rO, rI, s.a0, s.a1)} fill={s.color}
            opacity={s.ghost ? 0.4 : 1}
            style={{ filter: s.ghost ? "none" : "drop-shadow(0 2px 6px color-mix(in oklch," + s.color + " 40%, transparent))" }} />
        ))}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <span className="muted" style={{ fontSize: 11, fontWeight: 600 }}>{over ? "over income 😬" : unalloc > 0 ? "left to budget" : "all budgeted ✨"}</span>
        <span className="num display" style={{ fontSize: 30, color: over ? "var(--neg)" : unalloc > 0 ? "var(--txt)" : "var(--pos)" }}>{fmtMoney(over ? income - total : unalloc)}</span>
        <span className="muted" style={{ fontSize: 11 }}>of {fmtMoney(income)}/mo</span>
      </div>
    </div>
  );
}

// ---------- the multi-step wizard ----------
function ThrishaWizard({ onFinish, onSample }) {
  const [step, setStep] = useState(0);
  const [income, setIncome] = useState("");
  const [payday, setPayday] = useState(15);
  const [pockets, setPockets] = useState([
    { id: "sav", name: "Savings", color: WIZ_COLORS[0], mode: "fixed", deadlineDay: 1, isSavings: true },
    { id: "p2", name: "Food", color: WIZ_COLORS[1], mode: "recurring", deadlineDay: 15 },
  ]);
  const [budgets, setBudgets] = useState({});

  const incomeNum = parseFloat(income) || 0;
  const validPockets = pockets.filter((p) => p.name.trim());
  const totalBudget = validPockets.reduce((s, p) => s + (budgets[p.id] || 0), 0);
  const remaining = incomeNum - totalBudget;
  const allBudgeted = validPockets.length > 0 && validPockets.every((p) => (budgets[p.id] || 0) > 0);

  const addPocket = () => setPockets((ps) => [...ps, { id: "p" + Date.now(), name: "", color: WIZ_COLORS[ps.length % WIZ_COLORS.length], mode: "recurring", deadlineDay: 15 }]);
  const setPocket = (id, patch) => setPockets((ps) => ps.map((p) => p.id === id ? { ...p, ...patch } : p));
  const delPocket = (id) => setPockets((ps) => ps.filter((p) => p.id !== id));
  const setBudget = (id, v) => setBudgets((b) => ({ ...b, [id]: v }));

  const finish = () => {
    const divisions = validPockets.map((p) => {
      const budget = budgets[p.id] || 0;
      return {
        id: p.id, name: p.name.trim(), color: p.color, allocation: budget, limit: budget, spent: 0, carryover: 0,
        mode: p.mode, deadlineDay: p.mode === "fixed" ? (p.isSavings ? 1 : p.deadlineDay) : undefined,
        isSavings: !!p.isSavings, ...(p.isSavings ? { balance: 0 } : {}),
      };
    });
    onFinish({ monthlyIncome: incomeNum, payday, divisions });
  };

  const STEPS = ["Income", "Pockets", "Budgets"];

  return (
    <div className="scroll grow" style={{ paddingBottom: 40 }}>
      <div className="wrap" style={{ maxWidth: 560, paddingTop: "4vh", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* progress */}
        <div className="row" style={{ gap: 8, justifyContent: "center" }}>
          {STEPS.map((s, i) => (
            <div key={s} className="row" style={{ gap: 8 }}>
              <div className="row" style={{ gap: 7, opacity: i <= step ? 1 : 0.4 }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: i < step ? "var(--accent)" : i === step ? "color-mix(in oklch,var(--accent) 20%,var(--surface))" : "var(--surface)", color: i < step ? "var(--accent-ink)" : "var(--txt)", border: "1px solid " + (i <= step ? "var(--accent)" : "var(--line)") }}>
                  {i < step ? "✓" : i + 1}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <span style={{ width: 18, height: 2, background: "var(--line)", borderRadius: 2 }} />}
            </div>
          ))}
        </div>

        {/* STEP 0 — income + payday */}
        {step === 0 && (
          <div className="card pop-in" style={{ padding: 26, display: "flex", flexDirection: "column", gap: 18, textAlign: "center" }}>
            <span style={{ fontSize: 34 }}>💌</span>
            <div className="stack" style={{ gap: 6 }}>
              <span className="display" style={{ fontSize: 26 }}>what's your monthly income?</span>
              <span className="muted" style={{ fontSize: 14 }}>everything you've got coming in each month, babe. we'll split it into cute pockets next.</span>
            </div>
            <input className="input num" inputMode="decimal" placeholder="0.00" value={income}
              onChange={(e) => setIncome(e.target.value.replace(/[^0-9.]/g, ""))}
              style={{ fontSize: 32, fontWeight: 700, textAlign: "center" }} autoFocus />

            <div className="field" style={{ textAlign: "left" }}>
              <span className="label">📅 what day does it land in your debit each month?</span>
              <div className="card" style={{ boxShadow: "none", padding: "12px 14px", background: "var(--surface-2)", display: "flex", alignItems: "center", gap: 12 }}>
                <input type="range" min="1" max="28" step="1" value={payday} onChange={(e) => setPayday(parseInt(e.target.value, 10))} style={{ flex: 1 }} />
                <span className="chip" style={{ whiteSpace: "nowrap", fontWeight: 700 }}>{ordinal(payday)}</span>
              </div>
              <span className="muted" style={{ fontSize: 11.5 }}>your income arrives on the {ordinal(payday)} of every month.</span>
            </div>

            <button className="btn primary lg" disabled={incomeNum <= 0} onClick={() => setStep(1)}>next: my pockets <Icon name="chevR" size={17} /></button>
            <button className="btn ghost" style={{ fontSize: 12.5 }} onClick={onSample}><Icon name="spark" size={14} /> just load sample data</button>
          </div>
        )}

        {/* STEP 1 — pockets: name, color, recurring/fixed, deadline */}
        {step === 1 && (
          <div className="card pop-in" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="stack" style={{ gap: 5 }}>
              <span className="display" style={{ fontSize: 24 }}>make your money pockets ✿</span>
              <span className="muted" style={{ fontSize: 13.5 }}>name each one, then choose how it's tracked. <b>recurring</b> = a spending budget (don't go over; leftovers roll over). <b>fixed</b> = a must-pay bill or goal with a monthly deadline.</span>
            </div>
            <div className="stack" style={{ gap: 12 }}>
              {pockets.map((p) => (
                <div key={p.id} className="card" style={{ padding: 14, boxShadow: "none", display: "flex", flexDirection: "column", gap: 12, background: "var(--surface-2)", border: p.isSavings ? "1.5px solid var(--pos)" : "1px solid var(--line)" }}>
                  <div className="row" style={{ gap: 10 }}>
                    <span className="dot" style={{ width: 30, height: 30, borderRadius: "50%", background: p.color, flex: "none", boxShadow: "0 0 0 4px color-mix(in oklch," + p.color + " 22%, transparent)" }} />
                    {p.isSavings ? (
                      <div className="grow row" style={{ gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</span>
                        <span className="chip" style={{ fontSize: 9.5, padding: "3px 8px", color: "var(--pos)", borderColor: "var(--pos)" }}><Icon name="lock" size={10} /> default · always here</span>
                      </div>
                    ) : (
                      <input className="input grow" placeholder="pocket name" value={p.name} onChange={(e) => setPocket(p.id, { name: e.target.value })} style={{ padding: "10px 12px" }} />
                    )}
                    {!p.isSavings && pockets.length > 1 && <button className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => delPocket(p.id)}><Icon name="trash" size={15} /></button>}
                  </div>

                  {!p.isSavings && (
                    <div className="row" style={{ gap: 6, paddingLeft: 2 }}>
                      {WIZ_COLORS.map((c) => (
                        <button key={c} onClick={() => setPocket(p.id, { color: c })} style={{ width: 24, height: 24, borderRadius: "50%", background: c, border: p.color === c ? "3px solid var(--txt)" : "2px solid var(--line)", transition: "all .15s" }} />
                      ))}
                    </div>
                  )}

                  {/* tracking mode */}
                  <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
                    {p.isSavings ? (
                      <span className="chip" style={{ fontSize: 11 }}><Icon name="check" size={12} /> fixed · due at the start of each month</span>
                    ) : (
                      <div className="seg" style={{ padding: 3 }}>
                        <button className={p.mode === "recurring" ? "on" : ""} style={{ padding: "7px 12px", fontSize: 12 }} onClick={() => setPocket(p.id, { mode: "recurring" })}><Icon name="repeat" size={13} /> recurring</button>
                        <button className={p.mode === "fixed" ? "on" : ""} style={{ padding: "7px 12px", fontSize: 12 }} onClick={() => setPocket(p.id, { mode: "fixed" })}><Icon name="check" size={13} /> fixed</button>
                      </div>
                    )}
                  </div>

                  {/* fixed deadline picker (non-savings fixed only) */}
                  {!p.isSavings && p.mode === "fixed" && (
                    <div className="card pop-in" style={{ boxShadow: "none", padding: "10px 12px", background: "var(--surface)", display: "flex", alignItems: "center", gap: 12 }}>
                      <span className="label" style={{ whiteSpace: "nowrap" }}>📅 pay by the</span>
                      <input type="range" min="1" max="28" step="1" value={p.deadlineDay} onChange={(e) => setPocket(p.id, { deadlineDay: parseInt(e.target.value, 10) })} style={{ flex: 1 }} />
                      <span className="chip" style={{ whiteSpace: "nowrap", fontWeight: 700 }}>{ordinal(p.deadlineDay)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={addPocket}><Icon name="plus" size={16} /> add another pocket</button>
            <div className="row" style={{ gap: 12 }}>
              <button className="btn" onClick={() => setStep(0)}><Icon name="chevL" size={16} /> back</button>
              <button className="btn primary grow" disabled={validPockets.length === 0} onClick={() => setStep(2)}>next: budgets <Icon name="chevR" size={16} /></button>
            </div>
          </div>
        )}

        {/* STEP 2 — budgets: just allocate from income */}
        {step === 2 && (
          <div className="card pop-in" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="stack" style={{ gap: 5, textAlign: "center" }}>
              <span className="display" style={{ fontSize: 24 }}>set a budget for each pocket 🥧</span>
              <span className="muted" style={{ fontSize: 13.5 }}>your income shrinks as you assign. slide to give each pocket its share of the month.</span>
            </div>

            {/* live remaining income banner */}
            <div className="card" style={{ boxShadow: "none", padding: "14px 18px", background: remaining < 0 ? "color-mix(in oklch,var(--neg) 12%,var(--surface))" : "color-mix(in oklch,var(--accent) 12%,var(--surface))", textAlign: "center" }}>
              <span className="eyebrow">income left to assign</span>
              <div className="num display" style={{ fontSize: 30, color: remaining < 0 ? "var(--neg)" : "var(--txt)" }}>{fmtMoney(remaining)}</div>
              <span className="muted" style={{ fontSize: 12 }}>of {fmtMoney(incomeNum)}/mo · {fmtMoney(totalBudget)} budgeted</span>
            </div>

            <BudgetDonut income={incomeNum} pockets={validPockets} budgets={budgets} />

            <div className="stack" style={{ gap: 16 }}>
              {validPockets.map((p) => {
                const v = budgets[p.id] || 0;
                const others = totalBudget - v;
                const max = Math.max(0, incomeNum - others);
                const pct = incomeNum > 0 ? Math.round((v / incomeNum) * 100) : 0;
                return (
                  <div key={p.id} className="stack" style={{ gap: 7 }}>
                    <div className="between">
                      <div className="row" style={{ gap: 8 }}>
                        <span className="dot" style={{ width: 12, height: 12, background: p.color }} />
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
                        <span className="chip" style={{ fontSize: 9, padding: "2px 7px" }}>{p.mode === "fixed" ? "fixed" : "recurring"}</span>
                      </div>
                      <div className="row" style={{ gap: 8 }}>
                        <span className="num" style={{ fontWeight: 700, fontSize: 14, color: v > 0 ? "var(--txt)" : "var(--txt-3)" }}>{fmtMoney(v)}</span>
                        <span className="chip" style={{ fontSize: 10, padding: "3px 8px" }}>{pct}%</span>
                      </div>
                    </div>
                    <input type="range" min="0" max={incomeNum || 1} step="10" value={v}
                      onChange={(e) => setBudget(p.id, Math.min(max, parseInt(e.target.value, 10)))}
                      className="alloc-range" style={{ width: "100%" }} />
                  </div>
                );
              })}
            </div>

            {validPockets.length > 1 && (
              <button className="btn ghost" style={{ fontSize: 12.5, alignSelf: "center" }}
                onClick={() => { const each = Math.floor(incomeNum / validPockets.length / 10) * 10; const b = {}; validPockets.forEach((p) => b[p.id] = each); setBudgets(b); }}>
                <Icon name="sliders" size={14} /> split evenly
              </button>
            )}

            <div className="row" style={{ gap: 12 }}>
              <button className="btn" onClick={() => setStep(1)}><Icon name="chevL" size={16} /> back</button>
              <button className="btn primary grow" disabled={!allBudgeted} onClick={finish}><Icon name="flower" size={16} /> enter my garden</button>
            </div>
            {!allBudgeted && <span className="muted center" style={{ fontSize: 11.5 }}>give every pocket a budget to continue 🌷</span>}
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { ThrishaWizard, BudgetDonut, WIZ_COLORS, ordinal });
