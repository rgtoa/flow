/* ============================================================
   engine.jsx — recurrence expansion, daily projection, budgets, seed
   ============================================================ */

// ---------- date helpers ----------
const DAY = 86400000;
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = startOfDay(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d, n) { const x = startOfDay(d); x.setMonth(x.getMonth() + n); return x; }
function dayIndex(from, to) { return Math.round((startOfDay(to) - startOfDay(from)) / DAY); }
function isoDate(d) { const x = startOfDay(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); }
function parseDate(s) { if (s instanceof Date) return startOfDay(s); const [y, m, dd] = s.split("-").map(Number); return startOfDay(new Date(y, m - 1, dd)); }
function fmtDate(d, opt) { return startOfDay(d).toLocaleDateString("en-US", opt || { month: "short", day: "numeric", year: "numeric" }); }

const RANGE_OPTIONS = [
  { key: "3m", label: "3 mo", months: 3 },
  { key: "6m", label: "6 mo", months: 6 },
  { key: "1y", label: "1 yr", months: 12 },
  { key: "2y", label: "2 yr", months: 24 },
  { key: "5y", label: "5 yr", months: 60 },
  { key: "10y", label: "10 yr", months: 120 },
];

// ---------- recurrence ----------
// recurrence shapes:
//   { kind:'once', date:'YYYY-MM-DD' }
//   { kind:'monthly', startDate:'YYYY-MM-DD' }
//   { kind:'custom', interval:1..3, unit:'week'|'month', startDate:'YYYY-MM-DD' }
function expandOccurrences(rec, rangeStart, rangeEnd) {
  const out = [];
  if (!rec) return out;
  if (rec.kind === "once") {
    const d = parseDate(rec.date);
    if (d >= rangeStart && d <= rangeEnd) out.push(d);
    return out;
  }
  let cur = parseDate(rec.startDate);
  let guard = 0;
  // fast-forward to range start
  while (cur < rangeStart && guard < 20000) {
    cur = advance(cur, rec); guard++;
  }
  while (cur <= rangeEnd && guard < 20000) {
    if (cur >= rangeStart) out.push(startOfDay(cur));
    cur = advance(cur, rec); guard++;
  }
  return out;
}
function advance(d, rec) {
  if (rec.kind === "monthly") return addMonths(d, 1);
  if (rec.kind === "custom") return rec.unit === "week" ? addDays(d, 7 * rec.interval) : addMonths(d, rec.interval);
  return addDays(d, 100000);
}
function recurrenceLabel(rec) {
  if (!rec) return "";
  if (rec.kind === "once") return "One-time · " + fmtDate(parseDate(rec.date), { month: "short", day: "numeric" });
  if (rec.kind === "monthly") return "Every month";
  if (rec.kind === "custom") {
    const u = rec.unit === "week" ? "week" : "month";
    return rec.interval === 1 ? `Every ${u}` : `Every ${rec.interval} ${u}s`;
  }
  return "";
}

// ---------- daily projection ----------
// entries: [{ id, type:'income'|'expense'|'transfer', amount, account, toAccount, category, recurrence }]
// returns { days:[{date, balance, net, events:[{entry, amount}]}], peak, trough, totalIn, totalOut }
function buildProjection(entries, opening, startDate, months) {
  const rStart = startOfDay(startDate);
  const rEnd = addMonths(rStart, months);
  const n = dayIndex(rStart, rEnd) + 1;
  const deltas = Array.from({ length: n }, () => ({ net: 0, events: [] }));
  let totalIn = 0, totalOut = 0;
  for (const e of entries) {
    const occ = expandOccurrences(e.recurrence, rStart, rEnd);
    const signed = e.type === "income" ? e.amount : e.type === "expense" ? -e.amount : 0;
    for (const od of occ) {
      const idx = dayIndex(rStart, od);
      if (idx < 0 || idx >= n) continue;
      deltas[idx].net += signed;
      deltas[idx].events.push({ entry: e, amount: signed });
      if (signed > 0) totalIn += signed; else if (signed < 0) totalOut += -signed;
    }
  }
  let bal = opening;
  let peak = -Infinity, trough = Infinity;
  const days = deltas.map((d, i) => {
    bal += d.net;
    if (bal > peak) peak = bal;
    if (bal < trough) trough = bal;
    return { date: addDays(rStart, i), balance: bal, net: d.net, events: d.events };
  });
  return { days, peak, trough, totalIn, totalOut, opening, end: bal };
}

// ---------- per-account monthly schedule (Rafael) ----------
// Tracks each account's balance over time, applying transfers between accounts,
// and snapshots the balance of every account at the end of each month.
// returns { accounts:[{id,name}], rows:[{label, date, balances:{id:bal}, total}] }
function buildAccountSchedule(data, startDate, months) {
  const rStart = startOfDay(startDate);
  const rEnd = addMonths(rStart, months);
  const n = dayIndex(rStart, rEnd) + 1;

  // account registry
  const accounts = [{ id: "debit", name: data.accounts.debit.name }];
  if (data.accounts.credit.use) accounts.push({ id: "credit", name: data.accounts.credit.name });
  for (const b of data.banks) accounts.push({ id: b.id, name: b.name });

  // opening balances
  const bal = {};
  bal.debit = data.accounts.debit.balance;
  if (data.accounts.credit.use) bal.credit = data.accounts.credit.balance;
  for (const b of data.banks) bal[b.id] = b.balance;

  // bucket daily deltas per account
  const dayDelta = Array.from({ length: n }, () => ({}));
  const bump = (idx, id, amt) => { if (bal[id] === undefined) return; dayDelta[idx][id] = (dayDelta[idx][id] || 0) + amt; };
  for (const e of data.entries) {
    const occ = expandOccurrences(e.recurrence, rStart, rEnd);
    for (const od of occ) {
      const idx = dayIndex(rStart, od);
      if (idx < 0 || idx >= n) continue;
      if (e.type === "income") bump(idx, e.account, e.amount);
      else if (e.type === "expense") bump(idx, e.account, -e.amount);
      else if (e.type === "transfer") { bump(idx, e.account, -e.amount); bump(idx, e.toAccount, e.amount); }
    }
  }

  const rows = [];
  for (let i = 0; i < n; i++) {
    for (const id of Object.keys(dayDelta[i])) bal[id] += dayDelta[i][id];
    const date = addDays(rStart, i);
    const next = addDays(rStart, i + 1);
    const isMonthEnd = i === n - 1 || next.getMonth() !== date.getMonth();
    if (isMonthEnd) {
      const balances = {};
      let total = 0;
      for (const a of accounts) { balances[a.id] = bal[a.id]; total += bal[a.id]; }
      rows.push({ label: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), date, balances, total });
    }
  }
  return { accounts, rows };
}

// ---------- Thrisha budgets ----------
// divisions: [{ id, name, color, limit, spent, carryover, mode, deadlineDay, isSavings, balance }]
// recurring: effective budget = limit + carryover (unused rolls over); strict = don't exceed
// fixed: must pay `limit` each month by deadlineDay; strict about the deadline
function budgetStatus(div) {
  const effective = (div.limit || 0) + (div.carryover || 0);
  const remaining = effective - (div.spent || 0);
  const pct = effective > 0 ? (div.spent || 0) / effective : 0;
  let mood, tone;
  if (pct < 0.5) { mood = "comfy"; tone = "ok"; }
  else if (pct < 0.8) { mood = "mindful"; tone = "ok"; }
  else if (pct <= 1.0) { mood = "careful"; tone = "warn"; }
  else { mood = "over"; tone = "bad"; }
  return { remaining, pct, mood, tone, effective };
}

// fixed-pocket deadline status for the current month
function fixedStatus(div, now) {
  const today = now || new Date();
  const done = (div.spent || 0) >= (div.limit || 0) && (div.limit || 0) > 0;
  const day = today.getDate();
  const deadline = div.deadlineDay || 1;
  const daysLeft = deadline - day; // negative = past
  let urgency;
  if (done) urgency = "done";
  else if (daysLeft < 0) urgency = "overdue";
  else if (daysLeft <= 3) urgency = "soon";
  else urgency = "open";
  return { done, daysLeft, deadline, urgency };
}
const FIXED_NOTES = {
  overdue: ["this was due — pay it now, no excuses 🛑", "you're past the deadline. handle it. 💢", "overdue. this isn't optional, babe."],
  soon: ["deadline's close — don't forget 🔔", "due very soon, take care of it 💅", "almost due. lock it in."],
  open: ["due later this month — stay on it", "on the calendar, don't slip 📌", "you've got time, but don't wait"],
};

// ---------- month rollover (auto, on the 1st) ----------
const monthKey = (d) => { const x = d || new Date(); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0"); };

// one month's rollover of Thrisha's divisions:
// recurring → unused rolls to carryover & spent resets; fixed → resets; savings → balance grows by
// its monthly limit, and each savings goal accumulates its own monthly contribution.
function rolloverThrishaOnce(divisions) {
  return divisions.map((dv) => {
    if (dv.isSavings) {
      const pockets = (dv.pockets || []).map((p) => ({ ...p, amount: (p.amount || 0) + (p.monthly || 0) }));
      return { ...dv, balance: (dv.balance || 0) + (dv.limit || 0), spent: dv.limit || 0, pockets };
    }
    if (dv.mode === "recurring") {
      const leftover = Math.max(0, (dv.limit || 0) + (dv.carryover || 0) - (dv.spent || 0));
      return { ...dv, carryover: leftover, spent: 0 };
    }
    return { ...dv, spent: 0, carryover: 0 }; // fixed obligation resets
  });
}
// apply as many monthly rollovers as have elapsed since data.lastRollover; returns null if none needed
function applyDueRollovers(data, now) {
  const cur = monthKey(now);
  const last = data.lastRollover;
  if (!last || last === cur) return last ? null : { ...data, lastRollover: cur };
  // count whole months elapsed (cap to avoid pathological loops)
  const [ly, lm] = last.split("-").map(Number);
  const t = now || new Date();
  let months = (t.getFullYear() - ly) * 12 + (t.getMonth() + 1 - lm);
  months = Math.max(0, Math.min(months, 36));
  if (months === 0) return { ...data, lastRollover: cur };
  let divisions = data.divisions;
  for (let i = 0; i < months; i++) divisions = rolloverThrishaOnce(divisions);
  return { ...data, divisions, lastRollover: cur };
}
// emotionally-strict little messages
const THRISHA_NOTES = {
  comfy: ["plenty of room here, queen 👑", "you're golden ✨", "breathing room — love that"],
  mindful: ["halfway — just keeping an eye 👀", "still good, stay sweet 🫶", "we're watching, gently"],
  careful: ["okayyy slow down babe 🛑", "we're close to the line…", "do you NEED it? be honest 💅"],
  warn: ["careful careful 🚧", "this is your reminder to pause", "almost there — last call"],
  over: ["babe. BABE. you went over 😭", "that's a no from me 🙅‍♀️", "we don't do overdraft drama 💔"],
};

// ---------- SEED DATA ----------
const todayISO = isoDate(new Date());
const monthAnchor = isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

const seedStamp = Date.now();

const SEED = {
  Rafael: {
    setupDone: true,
    startDate: todayISO,
    lastUpdated: seedStamp,
    accounts: {
      debit:  { name: "Debit · Default", balance: 48200, use: true },
      credit: { name: "Amex Platinum", balance: -3150, use: true },
    },
    banks: [
      { id: "b1", name: "Goldman Vault", balance: 215000 },
      { id: "b2", name: "Chase Reserve", balance: 86400 },
    ],
    entries: [
      { id: "r1", type: "income",  amount: 18500, account: "debit",  category: "Salary",     recurrence: { kind: "monthly", startDate: monthAnchor }, note: "Base comp" },
      { id: "r2", type: "income",  amount: 22000, account: "b1",     category: "Dividends",  recurrence: { kind: "custom", interval: 3, unit: "month", startDate: monthAnchor }, note: "Equity dividends" },
      { id: "r3", type: "expense", amount: 6200,  account: "debit",  category: "Bill",       recurrence: { kind: "monthly", startDate: monthAnchor }, note: "Penthouse lease" },
      { id: "r4", type: "expense", amount: 420,   account: "credit", category: "Subscription", recurrence: { kind: "monthly", startDate: monthAnchor }, note: "Software + clubs" },
      { id: "r5", type: "expense", amount: 540,   account: "credit", category: "Grocery",    recurrence: { kind: "custom", interval: 1, unit: "week", startDate: todayISO }, note: "Whole Foods" },
      { id: "r6", type: "expense", amount: 9800,  account: "credit", category: "Leisure",    recurrence: { kind: "once", date: isoDate(addDays(new Date(), 24)) }, note: "Maldives trip" },
      { id: "r7", type: "expense", amount: 1300,  account: "debit",  category: "Transportation", recurrence: { kind: "monthly", startDate: monthAnchor }, note: "Driver + fuel" },
      { id: "r8", type: "transfer",amount: 8000,  account: "debit",  toAccount: "b1",        category: "Transfer", recurrence: { kind: "monthly", startDate: monthAnchor }, note: "Sweep to vault" },
    ],
  },
  Thrisha: {
    setupDone: true,
    startDate: todayISO,
    lastUpdated: seedStamp,
    monthlyIncome: 5400,
    payday: 15,
    lastRollover: monthAnchor.slice(0, 7),
    divisions: [
      { id: "sav", name: "Savings",    color: "var(--pos)",      limit: 1200, spent: 1200, carryover: 0,   mode: "fixed", deadlineDay: 1, isSavings: true, balance: 8600, pockets: [
        { id: "sp1", name: "Travel ✈️", color: "var(--blue)", amount: 4200, monthly: 700 },
        { id: "sp2", name: "Emergency", color: "var(--neg)", amount: 3000, monthly: 500 },
      ] },
      { id: "d2", name: "Food",        color: "var(--accent)",   limit: 700,  spent: 430,  carryover: 50,  mode: "recurring" },
      { id: "d3", name: "Self-care",   color: "var(--lav)",      limit: 450,  spent: 380,  carryover: 0,   mode: "recurring" },
      { id: "d4", name: "Leisure",     color: "var(--blue)",     limit: 500,  spent: 540,  carryover: 0,   mode: "recurring" },
      { id: "d5", name: "Rent",        color: "var(--transfer)", limit: 900,  spent: 900,  carryover: 0,   mode: "fixed", deadlineDay: 5 },
      { id: "d6", name: "Phone bill",  color: "var(--neg)",      limit: 80,   spent: 0,    carryover: 0,   mode: "fixed", deadlineDay: 20 },
    ],
    entries: [
      { id: "t1", type: "income",  amount: 5400, division: null, category: "Monthly income", recurrence: { kind: "monthly", startDate: monthAnchor }, note: "main job" },
      { id: "t2", type: "income",  amount: 600,  division: null, category: "Side gig", recurrence: { kind: "custom", interval: 2, unit: "week", startDate: todayISO }, note: "etsy shop" },
      { id: "t3", type: "expense", amount: 430,  division: "d2", category: "Food",      recurrence: { kind: "once", date: todayISO }, note: "groceries + treats" },
      { id: "t4", type: "expense", amount: 380,  division: "d3", category: "Self-care", recurrence: { kind: "once", date: todayISO }, note: "nails + skincare" },
      { id: "t5", type: "expense", amount: 540,  division: "d4", category: "Leisure",   recurrence: { kind: "once", date: todayISO }, note: "concert tickets 😬" },
      { id: "t6", type: "expense", amount: 900,  division: "d5", category: "Rent",      recurrence: { kind: "once", date: todayISO }, note: "rent share" },
    ],
  },
};

const EXPENSE_CATS = ["Subscription", "Bill", "Grocery", "Leisure", "Transportation", "Dining", "Health", "Other"];

// ---------- EMPTY (from-scratch) STATE ----------
const EMPTY = {
  Rafael: {
    setupDone: false, startDate: todayISO,
    accounts: {
      debit:  { name: "Debit · Default", balance: 0, use: true },
      credit: { name: "Credit card", balance: 0, use: false },
    },
    banks: [], entries: [],
  },
  Thrisha: {
    setupDone: false, startDate: todayISO, monthlyIncome: 0, payday: 15,
    divisions: [], entries: [],
  },
};

Object.assign(window, {
  startOfDay, addDays, addMonths, dayIndex, isoDate, parseDate, fmtDate,
  RANGE_OPTIONS, expandOccurrences, recurrenceLabel, buildProjection, buildAccountSchedule,
  budgetStatus, fixedStatus, FIXED_NOTES, monthKey, rolloverThrishaOnce, applyDueRollovers, THRISHA_NOTES, SEED, EMPTY, EXPENSE_CATS, todayISO,
});
