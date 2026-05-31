/* ============================================================
   rafael.jsx — Rafael's tracker: accounts, income/expense/transfer
   ============================================================ */

function accountOptions(data) {
  const out = [];
  if (data.accounts.debit.use) out.push({ id: "debit", name: data.accounts.debit.name });
  if (data.accounts.credit.use) out.push({ id: "credit", name: data.accounts.credit.name });
  for (const b of data.banks) out.push({ id: b.id, name: b.name });
  return out;
}
function accountName(data, id) {
  if (id === "debit") return data.accounts.debit.name;
  if (id === "credit") return data.accounts.credit.name;
  const b = data.banks.find((x) => x.id === id);
  return b ? b.name : "—";
}
function rafOpening(data) {
  let s = data.accounts.debit.balance + (data.accounts.credit.use ? data.accounts.credit.balance : 0);
  for (const b of data.banks) s += b.balance;
  return s;
}

// ---------------- RECURRENCE PICKER (shared shape) ----------------
function RecurrencePicker({ rec, setRec }) {
  const kind = rec.kind;
  return (
    <div className="stack" style={{ gap: 12 }}>
      <span className="label">How often?</span>
      <div className="tiles" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        {[
          { k: "monthly", t: "Monthly", s: "every month", ic: "repeat" },
          { k: "custom", t: "Custom", s: "weeks / months", ic: "sliders" },
          { k: "once", t: "One-time", s: "single date", ic: "calendar" },
        ].map((o) => (
          <button key={o.k} className={"tile" + (kind === o.k ? " on" : "")} style={{ padding: 14, alignItems: "flex-start" }}
            onClick={() => setRec(o.k === "monthly" ? { kind: "monthly", startDate: rec.startDate || todayISO }
              : o.k === "custom" ? { kind: "custom", interval: 1, unit: "month", startDate: rec.startDate || todayISO }
              : { kind: "once", date: rec.date || todayISO })}>
            <Icon name={o.ic} size={18} style={{ color: "var(--accent)" }} />
            <span className="t-title" style={{ fontSize: 14 }}>{o.t}</span>
            <span className="t-sub">{o.s}</span>
          </button>
        ))}
      </div>

      {kind === "custom" && (
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <span className="label">Every</span>
          <div className="seg">
            {[1, 2, 3].map((i) => <button key={i} className={rec.interval === i ? "on" : ""} onClick={() => setRec({ ...rec, interval: i })}>{i}</button>)}
          </div>
          <div className="seg">
            {["week", "month"].map((u) => <button key={u} className={rec.unit === u ? "on" : ""} onClick={() => setRec({ ...rec, unit: u })}>{u}{rec.interval > 1 ? "s" : ""}</button>)}
          </div>
        </div>
      )}
      <div className="field">
        <span className="label">{kind === "once" ? "On this date" : "Starting from"}</span>
        <input className="input" type="date" value={kind === "once" ? rec.date : rec.startDate}
          onChange={(e) => setRec(kind === "once" ? { ...rec, date: e.target.value } : { ...rec, startDate: e.target.value })} />
      </div>
    </div>
  );
}

// ---------------- ADD TRANSACTION SHEET ----------------
function RafaelAddSheet({ data, onClose, onSave }) {
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState("debit");
  const [toAccount, setToAccount] = useState(data.banks[0]?.id || "credit");
  const [category, setCategory] = useState("Bill");
  const [note, setNote] = useState("");
  const [rec, setRec] = useState({ kind: "monthly", startDate: todayISO });
  const opts = accountOptions(data);

  const valid = parseFloat(amount) > 0 && (type !== "transfer" || account !== toAccount);
  const save = () => {
    onSave({
      id: "r" + Date.now(), type, amount: parseFloat(amount),
      account, toAccount: type === "transfer" ? toAccount : undefined,
      category: type === "expense" ? category : type === "income" ? "Income" : "Transfer",
      note, recurrence: rec,
    });
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="display" style={{ fontSize: 22 }}>New Transaction</span>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        <div className="sheet-body">
          <div className="tiles" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            {[
              { k: "income", t: "Income", ic: "arrowUp", col: "var(--pos)" },
              { k: "expense", t: "Expense", ic: "arrowDown", col: "var(--neg)" },
              { k: "transfer", t: "Transfer", ic: "transfer", col: "var(--transfer)" },
            ].map((o) => (
              <button key={o.k} className={"tile" + (type === o.k ? " on" : "")} style={{ padding: 14, alignItems: "center", textAlign: "center" }} onClick={() => setType(o.k)}>
                <Icon name={o.ic} size={20} style={{ color: o.col }} />
                <span className="t-title" style={{ fontSize: 14 }}>{o.t}</span>
              </button>
            ))}
          </div>

          <div className="field">
            <span className="label">Amount</span>
            <input className="input num" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} style={{ fontSize: 24, fontWeight: 700 }} />
          </div>

          <div className="row" style={{ gap: 12, alignItems: "stretch", flexWrap: "wrap" }}>
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
              <span className="label">Category</span>
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                {EXPENSE_CATS.map((c) => (
                  <button key={c} className={"chip"} style={{ cursor: "pointer", borderColor: category === c ? "var(--accent)" : "var(--line)", color: category === c ? "var(--txt)" : "var(--txt-2)", background: category === c ? "color-mix(in oklch,var(--accent) 14%,var(--surface))" : "var(--surface-2)" }} onClick={() => setCategory(c)}>{c}</button>
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

// ---------------- SETUP SHEET (the 3 onboarding questions) ----------------
function RafaelSetupSheet({ data, onClose, onSave }) {
  const [debit, setDebit] = useState(String(data.accounts.debit.balance));
  const [startDate, setStartDate] = useState(data.startDate);
  const [useCredit, setUseCredit] = useState(data.accounts.credit.use);
  const [credit, setCredit] = useState(String(data.accounts.credit.balance));
  const [banks, setBanks] = useState(data.banks.map((b) => ({ ...b })));
  const [step, setStep] = useState(0);

  const addBank = () => setBanks((b) => [...b, { id: "b" + Date.now(), name: "", balance: 0 }]);
  const steps = ["Default card", "Credit card", "Other banks"];

  const finish = () => onSave({
    ...data, setupDone: true, startDate,
    accounts: {
      ...data.accounts,
      debit: { ...data.accounts.debit, balance: parseFloat(debit) || 0 },
      credit: { ...data.accounts.credit, use: useCredit, balance: parseFloat(credit) || 0 },
    },
    banks: banks.filter((b) => b.name.trim()).map((b) => ({ ...b, balance: parseFloat(b.balance) || 0 })),
  });

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
              <p className="muted" style={{ fontSize: 14 }}>What's the current state of your default debit card, and when should the projection begin?</p>
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
              {useCredit && (
                <>
                  <div className="field"><span className="label">Card name</span>
                    <input className="input" value={data.accounts.credit.name} onChange={() => {}} placeholder="e.g. Amex Platinum" /></div>
                  <div className="field"><span className="label">Current balance (negative if owed)</span>
                    <input className="input num" inputMode="decimal" value={credit} onChange={(e) => setCredit(e.target.value.replace(/[^0-9.\-]/g, ""))} style={{ fontSize: 20, fontWeight: 700 }} /></div>
                </>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="stack" style={{ gap: 14 }}>
              <p className="muted" style={{ fontSize: 14 }}>Any other banks you move money to? Used for transfers.</p>
              {banks.map((b, i) => (
                <div key={b.id} className="row" style={{ gap: 8 }}>
                  <input className="input grow" placeholder="Bank name" value={b.name} onChange={(e) => setBanks((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <input className="input num" style={{ width: 130 }} inputMode="decimal" placeholder="balance" value={b.balance} onChange={(e) => setBanks((arr) => arr.map((x, j) => j === i ? { ...x, balance: e.target.value.replace(/[^0-9.\-]/g, "") } : x))} />
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

// ---------------- TRANSACTION ROW ----------------
function TxnRow({ data, e, canEdit, onDelete }) {
  const col = e.type === "income" ? "var(--pos)" : e.type === "expense" ? "var(--neg)" : "var(--transfer)";
  const ic = e.type === "income" ? "arrowUp" : e.type === "expense" ? "arrowDown" : "transfer";
  return (
    <div className="row" style={{ padding: "13px 4px", borderBottom: "1px solid var(--line-soft)", gap: 13 }}>
      <div style={{ width: 38, height: 38, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in oklch," + col + " 16%, var(--surface))", color: col }}>
        <Icon name={ic} size={17} />
      </div>
      <div className="grow stack" style={{ gap: 2 }}>
        <span style={{ fontWeight: 600, fontSize: 14.5 }}>{e.category}{e.note ? <span className="muted" style={{ fontWeight: 400 }}> · {e.note}</span> : null}</span>
        <span className="muted" style={{ fontSize: 12 }}>
          {recurrenceLabel(e.recurrence)} · {accountName(data, e.account)}{e.type === "transfer" ? " → " + accountName(data, e.toAccount) : ""}
        </span>
      </div>
      <span className="num" style={{ fontWeight: 700, fontSize: 15, color: col }}>
        {e.type === "transfer" ? "" : e.type === "income" ? "+" : "−"}{fmtMoney(e.amount)}
      </span>
      {canEdit && <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => onDelete(e.id)}><Icon name="trash" size={15} /></button>}
    </div>
  );
}

// ---------------- ONBOARDING (from scratch) ----------------
function RafaelOnboarding({ onStart, onSample }) {
  const steps = [
    { n: 1, ic: "sliders", t: "Set the stage", s: "Your debit card, optional credit card, and any other banks." },
    { n: 2, ic: "transfer", t: "Log your money moves", s: "Income, expenses and transfers — one-time or recurring." },
    { n: 3, ic: "spark", t: "Generate the projection", s: "Watch your capital trajectory, day by day, up to 10 years out." },
  ];
  return (
    <div className="scroll grow" style={{ paddingBottom: 40 }}>
      <div className="wrap" style={{ maxWidth: 700, paddingTop: "5vh", display: "flex", flexDirection: "column", gap: 26 }}>
        <div className="stack" style={{ gap: 12, alignItems: "flex-start" }}>
          <div className="chip"><Icon name="crown" size={14} /> let's build it</div>
          <h1 className="display" style={{ fontSize: "clamp(30px,7vw,48px)" }}>Build your portfolio flow</h1>
          <p className="muted" style={{ fontSize: 15.5, maxWidth: 480 }}>Nothing here yet. Three quick steps and we'll project your capital — day by day, months and years ahead.</p>
        </div>
        <div className="stack" style={{ gap: 12 }}>
          {steps.map((st) => (
            <div key={st.n} className="card" style={{ padding: 18, boxShadow: "none", display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in oklch,var(--accent) 16%,var(--surface))", color: "var(--accent)" }}>
                <Icon name={st.ic} size={19} />
              </div>
              <div className="grow stack" style={{ gap: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 15.5 }}>{st.t}</span>
                <span className="muted" style={{ fontSize: 13 }}>{st.s}</span>
              </div>
              <span className="num display" style={{ fontSize: 26, color: "var(--line)" }}>{st.n}</span>
            </div>
          ))}
        </div>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <button className="btn primary lg" onClick={onStart}><Icon name="chevR" size={17} /> Start setup</button>
          <button className="btn lg" onClick={onSample}><Icon name="spark" size={16} /> Load sample data</button>
        </div>
      </div>
    </div>
  );
}

function FlowEmpty({ who, theme }) {
  return (
    <div className="scroll grow">
      <div className="wrap center" style={{ paddingTop: "16vh", maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <Avatar who={who} size={64} />
        <h2 className="display" style={{ fontSize: 26 }}>{who} hasn't built {who === "Rafael" ? "their portfolio" : "their garden"} yet</h2>
        <p className="muted" style={{ fontSize: 14.5 }}>Once {who} sets up their money flow, you'll be able to peek at it here.</p>
      </div>
    </div>
  );
}

// ---------------- ACCOUNT SCHEDULE (end-of-month balances) ----------------
function AccountSchedule({ schedule, months }) {
  const { accounts, rows } = schedule;
  const [open, setOpen] = useState(true);
  if (!rows.length) return null;
  const colW = 116;
  return (
    <div className="stack" style={{ gap: 12, marginTop: 22 }}>
      <button className="between" onClick={() => setOpen((v) => !v)} style={{ cursor: "pointer", width: "100%" }}>
        <div className="stack" style={{ gap: 2, textAlign: "left" }}>
          <span className="display" style={{ fontSize: 20 }}>Balances by month</span>
          <span className="muted" style={{ fontSize: 12.5 }}>End-of-month position across every account</span>
        </div>
        <span className="icon-btn" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}><Icon name="chevD" size={17} /></span>
      </button>

      {open && (
        <div className="card" style={{ boxShadow: "none", overflow: "hidden" }}>
          <div className="scroll" style={{ maxHeight: 380, overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 320 + accounts.length * colW }}>
              <thead>
                <tr>
                  <th style={thBase(true)}>Month</th>
                  {accounts.map((a) => (
                    <th key={a.id} style={{ ...thBase(false), minWidth: colW }}>{a.name}</th>
                  ))}
                  <th style={{ ...thBase(false), color: "var(--accent)", minWidth: colW }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 ? "color-mix(in oklch, var(--surface-2) 40%, transparent)" : "transparent" }}>
                    <td style={tdBase(true)}>{r.label}</td>
                    {accounts.map((a) => (
                      <td key={a.id} style={tdNum(r.balances[a.id])}>{fmtMoney(r.balances[a.id])}</td>
                    ))}
                    <td style={{ ...tdNum(r.total), fontWeight: 700, color: r.total < 0 ? "var(--neg)" : "var(--accent)" }}>{fmtMoney(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
function thBase(sticky) {
  return {
    position: "sticky", top: 0, zIndex: sticky ? 3 : 2,
    left: sticky ? 0 : "auto",
    background: "var(--bg-2)", color: "var(--txt-3)",
    fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600,
    textAlign: sticky ? "left" : "right", padding: "12px 14px", whiteSpace: "nowrap",
    borderBottom: "1px solid var(--line)",
  };
}
function tdBase(sticky) {
  return {
    position: sticky ? "sticky" : "static", left: sticky ? 0 : "auto", zIndex: sticky ? 1 : "auto",
    background: sticky ? "var(--surface)" : "transparent",
    padding: "11px 14px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
    borderBottom: "1px solid var(--line-soft)",
  };
}
function tdNum(v) {
  return {
    padding: "11px 14px", fontSize: 13.5, textAlign: "right", whiteSpace: "nowrap",
    fontFamily: "var(--font-num)", fontVariantNumeric: "tabular-nums",
    color: v < 0 ? "var(--neg)" : "var(--txt)",
    borderBottom: "1px solid var(--line-soft)",
  };
}

// ---------------- MAIN ----------------
function RafaelTracker({ data, canEdit, update, theme, me }) {
  const [range, setRange] = useState("6m");
  const [adding, setAdding] = useState(false);
  const [setup, setSetup] = useState(false);
  const [generated, setGenerated] = useState(data.entries.length > 0);
  const months = RANGE_OPTIONS.find((r) => r.key === range).months;
  const opening = rafOpening(data);
  const projection = useMemo(() => buildProjection(data.entries, opening, parseDate(data.startDate), months), [data.entries, opening, data.startDate, months]);
  const schedule = useMemo(() => buildAccountSchedule(data, parseDate(data.startDate), months), [data, months]);

  // relevant stats (replaces peak / lowest point)
  const surplus = projection.totalIn - projection.totalOut;
  const avgMonthly = surplus / months;
  const growthPct = opening !== 0 ? ((projection.end - opening) / Math.abs(opening)) * 100 : 0;
  const rafStats = [
    { label: "Total inflow", value: fmtMoney(projection.totalIn), tone: "pos" },
    { label: "Total outflow", value: fmtMoney(projection.totalOut), tone: "neg" },
    { label: "Avg monthly surplus", value: fmtMoney(avgMonthly, { sign: true }), tone: avgMonthly >= 0 ? "pos" : "neg" },
    { label: "Net worth growth", value: (growthPct >= 0 ? "+" : "−") + Math.abs(growthPct).toFixed(1) + "%", tone: growthPct >= 0 ? "pos" : "neg" },
  ];

  const loadSample = () => update(() => clone(SEED.Rafael));
  const startFresh = () => { update(() => clone(EMPTY.Rafael)); setGenerated(false); };

  if (!data.setupDone) {
    if (!canEdit) return <FlowEmpty who="Rafael" theme={theme} />;
    return (
      <React.Fragment>
        <RafaelOnboarding onStart={() => setSetup(true)} onSample={loadSample} />
        {setup && <RafaelSetupSheet data={data} onClose={() => setSetup(false)} onSave={(nd) => { update(() => nd); setSetup(false); }} />}
      </React.Fragment>
    );
  }

  const holdings = [
    { name: data.accounts.debit.name, bal: data.accounts.debit.balance, ic: "card" },
    ...(data.accounts.credit.use ? [{ name: data.accounts.credit.name, bal: data.accounts.credit.balance, ic: "card" }] : []),
    ...data.banks.map((b) => ({ name: b.name, bal: b.balance, ic: "bank" })),
  ];

  return (
    <div className="scroll grow" style={{ paddingBottom: 40 }}>
      <div className="wrap" style={{ paddingTop: 22, display: "flex", flexDirection: "column", gap: 26 }}>

        <Greeting name="Rafael" mine={canEdit} lastUpdated={data.lastUpdated} />

        {/* holdings */}
        <div className="stack" style={{ gap: 12 }}>
          <div className="between">
            <span className="eyebrow">Holdings</span>
            {canEdit && <button className="btn ghost" style={{ padding: "8px 12px", fontSize: 12.5 }} onClick={() => setSetup(true)}><Icon name="sliders" size={14} /> Accounts &amp; setup</button>}
          </div>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
            {holdings.map((h, i) => (
              <div key={i} className="card" style={{ padding: 16, boxShadow: "none" }}>
                <div className="row" style={{ gap: 8, color: "var(--accent)" }}><Icon name={h.ic} size={16} /><span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{h.name}</span></div>
                <div className="num" style={{ fontSize: 20, fontWeight: 700, marginTop: 8, color: h.bal < 0 ? "var(--neg)" : "var(--txt)" }}>{fmtMoney(h.bal)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* transactions */}
        <div className="card" style={{ padding: "8px 20px 16px" }}>
          <div className="between" style={{ padding: "14px 0 6px" }}>
            <span className="display" style={{ fontSize: 21 }}>Money moves</span>
            {canEdit && <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> {COPY[theme].addCta}</button>}
          </div>
          <div className="stack">
            {data.entries.length === 0 && <p className="muted center" style={{ padding: 30 }}>No transactions yet.</p>}
            {data.entries.map((e) => <TxnRow key={e.id} data={data} e={e} canEdit={canEdit} onDelete={(id) => update((d) => ({ ...d, entries: d.entries.filter((x) => x.id !== id) }))} />)}
          </div>
        </div>

        {/* generate / visualization */}
        {data.entries.length === 0 ? (
          <div className="card" style={{ padding: "34px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: 50, height: 50, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "color-mix(in oklch,var(--accent) 16%,var(--surface))", color: "var(--accent)" }}><Icon name="spark" size={24} /></div>
            <span className="display" style={{ fontSize: 20 }}>Nothing to project yet</span>
            <p className="muted" style={{ fontSize: 13.5, maxWidth: 340 }}>Add at least one money move above, then generate your day-by-day projection.</p>
            {canEdit && <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> {COPY[theme].addCta}</button>}
          </div>
        ) : !generated ? (
          <button className="btn primary lg block" onClick={() => setGenerated(true)}><Icon name="spark" size={18} /> {COPY[theme].generate}</button>
        ) : (
          <div className="card" style={{ padding: "22px 20px" }}>
            <div className="between" style={{ marginBottom: 14 }}>
              <div className="stack" style={{ gap: 2 }}>
                <span className="display" style={{ fontSize: 22 }}>{COPY[theme].vizTitle}</span>
                <span className="muted" style={{ fontSize: 12.5 }}>{COPY[theme].vizSub} · from {fmtDate(parseDate(data.startDate))}</span>
              </div>
              <button className="icon-btn" onClick={() => { setGenerated(false); setTimeout(() => setGenerated(true), 60); }}><Icon name="repeat" size={17} /></button>
            </div>
            <Visualization projection={projection} theme={theme} who="Rafael" range={range} setRange={setRange} stats={rafStats}
              headline={`Opening ${fmtMoney(opening)} → ${months >= 12 ? (months / 12) + " yr" : months + " mo"} out`} />

            {/* per-account end-of-month balances */}
            <AccountSchedule schedule={schedule} months={months} />
          </div>
        )}

        {canEdit && (
          <button className="btn ghost" style={{ alignSelf: "center", fontSize: 12, color: "var(--txt-3)", padding: "6px 12px" }}
            onClick={() => { if (confirm("Clear this portfolio and start over from scratch?")) startFresh(); }}>
            <Icon name="trash" size={13} /> start fresh
          </button>
        )}
      </div>

      {adding && <RafaelAddSheet data={data} onClose={() => setAdding(false)} onSave={(e) => { update((d) => ({ ...d, entries: [e, ...d.entries] })); setAdding(false); }} />}
      {setup && <RafaelSetupSheet data={data} onClose={() => setSetup(false)} onSave={(nd) => { update(() => nd); setSetup(false); }} />}
    </div>
  );
}

Object.assign(window, { RafaelTracker, RafaelAddSheet, RafaelSetupSheet, RecurrencePicker, RafaelOnboarding, FlowEmpty, AccountSchedule, accountOptions, accountName, rafOpening });
