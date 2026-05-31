/**
 * engine.ts — Pure business logic. No React, no Supabase.
 * Direct port of prototype/engine.jsx with TypeScript types.
 */
import type {
  Recurrence, Entry, Division, SavingsGoal,
  RafaelData, ThrishaData,
  Projection, DayPoint, AccountSchedule,
  BudgetStatus, FixedStatus, RangeOption, Currency,
} from "./types";

// ── Date helpers ──────────────────────────────────────────────────────────────
const DAY = 86400000;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date | string, n: number): Date {
  const x = startOfDay(typeof d === "string" ? parseDate(d) : d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date | string, n: number): Date {
  const x = startOfDay(typeof d === "string" ? parseDate(d) : d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export function dayIndex(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY);
}

export function isoDate(d: Date): string {
  const x = startOfDay(d);
  return x.getFullYear() + "-" +
    String(x.getMonth() + 1).padStart(2, "0") + "-" +
    String(x.getDate()).padStart(2, "0");
}

export function parseDate(s: string | Date): Date {
  if (s instanceof Date) return startOfDay(s);
  const [y, m, dd] = s.split("-").map(Number);
  return startOfDay(new Date(y, m - 1, dd));
}

export function fmtDate(d: Date | string, opt?: Intl.DateTimeFormatOptions): string {
  return startOfDay(typeof d === "string" ? parseDate(d) : d)
    .toLocaleDateString("en-US", opt ?? { month: "short", day: "numeric", year: "numeric" });
}

export function todayISO(): string { return isoDate(new Date()); }
export function monthAnchorISO(): string {
  const n = new Date();
  return isoDate(new Date(n.getFullYear(), n.getMonth(), 1));
}

// ── Money formatting ──────────────────────────────────────────────────────────
const CCY_SYMBOL: Record<Currency, string> = { PHP: "₱", QAR: "QR " };

export function fmtMoney(
  n: number,
  currency: Currency,
  opts: { sign?: boolean; cents?: boolean } = {}
): string {
  const neg = n < 0;
  const abs = Math.abs(n);
  const s = abs.toLocaleString("en-US", {
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  });
  const core = CCY_SYMBOL[currency] + s;
  if (opts.sign) return (neg ? "−" : "+") + core;
  return (neg ? "−" : "") + core;
}

export function fmtShort(n: number, currency: Currency): string {
  const a = Math.abs(n);
  const sym = CCY_SYMBOL[currency];
  if (a >= 1e9) return sym + (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (a >= 1e6) return sym + (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (a >= 1e3) return sym + (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return sym + Math.round(n).toString();
}

// ── Range options ─────────────────────────────────────────────────────────────
export const RANGE_OPTIONS: RangeOption[] = [
  { key: "3m",  label: "3 mo",  months: 3   },
  { key: "6m",  label: "6 mo",  months: 6   },
  { key: "1y",  label: "1 yr",  months: 12  },
  { key: "2y",  label: "2 yr",  months: 24  },
  { key: "5y",  label: "5 yr",  months: 60  },
  { key: "10y", label: "10 yr", months: 120 },
];

// ── Recurrence ────────────────────────────────────────────────────────────────
function advance(d: Date, rec: Recurrence): Date {
  if (rec.kind === "monthly") return addMonths(d, 1);
  if (rec.kind === "custom")
    return rec.unit === "week" ? addDays(d, 7 * rec.interval) : addMonths(d, rec.interval);
  return addDays(d, 100000);
}

export function expandOccurrences(rec: Recurrence, rangeStart: Date, rangeEnd: Date): Date[] {
  const out: Date[] = [];
  if (rec.kind === "once") {
    const d = parseDate(rec.date);
    if (d >= rangeStart && d <= rangeEnd) out.push(d);
    return out;
  }
  let cur = parseDate(rec.startDate);
  let guard = 0;
  while (cur < rangeStart && guard < 20000) { cur = advance(cur, rec); guard++; }
  while (cur <= rangeEnd   && guard < 20000) {
    if (cur >= rangeStart) out.push(startOfDay(cur));
    cur = advance(cur, rec); guard++;
  }
  return out;
}

export function recurrenceLabel(rec: Recurrence): string {
  if (rec.kind === "once")    return "One-time · " + fmtDate(parseDate(rec.date), { month: "short", day: "numeric" });
  if (rec.kind === "monthly") return "Every month";
  if (rec.kind === "custom") {
    const u = rec.unit === "week" ? "week" : "month";
    return rec.interval === 1 ? `Every ${u}` : `Every ${rec.interval} ${u}s`;
  }
  return "";
}

// ── Daily projection ──────────────────────────────────────────────────────────
export function buildProjection(
  entries: Entry[],
  opening: number,
  startDate: Date,
  months: number
): import("./types").Projection {
  const rStart = startOfDay(startDate);
  const rEnd   = addMonths(rStart, months);
  const n = dayIndex(rStart, rEnd) + 1;
  const deltas = Array.from({ length: n }, () => ({ net: 0, events: [] as DayPoint["events"] }));
  let totalIn = 0, totalOut = 0;

  for (const e of entries) {
    const occ = expandOccurrences(e.recurrence, rStart, rEnd);
    const signed = e.type === "income" ? e.amount : e.type === "expense" ? -e.amount : 0;
    for (const od of occ) {
      const idx = dayIndex(rStart, od);
      if (idx < 0 || idx >= n) continue;
      deltas[idx].net += signed;
      deltas[idx].events.push({ entry: e, amount: signed });
      if (signed > 0) totalIn += signed;
      else if (signed < 0) totalOut += -signed;
    }
  }

  let bal = opening;
  let peak = -Infinity, trough = Infinity;
  const days: DayPoint[] = deltas.map((d, i) => {
    bal += d.net;
    if (bal > peak)   peak   = bal;
    if (bal < trough) trough = bal;
    return { date: addDays(rStart, i), balance: bal, net: d.net, events: d.events };
  });
  return { days, peak, trough, totalIn, totalOut, opening, end: bal };
}

// ── Per-account monthly schedule (Rafael) ────────────────────────────────────
export function buildAccountSchedule(
  data: RafaelData,
  startDate: Date,
  months: number
): AccountSchedule {
  const rStart = startOfDay(startDate);
  const rEnd   = addMonths(rStart, months);
  const n = dayIndex(rStart, rEnd) + 1;

  const accounts = [{ id: "debit", name: data.accounts.debit.name }];
  if (data.accounts.credit.use) accounts.push({ id: "credit", name: data.accounts.credit.name });
  for (const b of data.banks) accounts.push({ id: b.id, name: b.name });

  const bal: Record<string, number> = { debit: data.accounts.debit.balance };
  if (data.accounts.credit.use) bal.credit = data.accounts.credit.balance;
  for (const b of data.banks) bal[b.id] = b.balance;

  const dayDelta: Record<string, number>[] = Array.from({ length: n }, () => ({}));
  const bump = (idx: number, id: string, amt: number) => {
    if (bal[id] === undefined) return;
    dayDelta[idx][id] = (dayDelta[idx][id] || 0) + amt;
  };

  for (const e of data.entries) {
    const occ = expandOccurrences(e.recurrence, rStart, rEnd);
    for (const od of occ) {
      const idx = dayIndex(rStart, od);
      if (idx < 0 || idx >= n) continue;
      if (e.type === "income"   && e.account) bump(idx, e.account, e.amount);
      if (e.type === "expense"  && e.account) bump(idx, e.account, -e.amount);
      if (e.type === "transfer" && e.account && e.toAccount) {
        bump(idx, e.account, -e.amount);
        bump(idx, e.toAccount, e.amount);
      }
    }
  }

  const rows: AccountSchedule["rows"] = [];
  for (let i = 0; i < n; i++) {
    for (const id of Object.keys(dayDelta[i])) bal[id] += dayDelta[i][id];
    const date = addDays(rStart, i);
    const next = addDays(rStart, i + 1);
    const isEnd = i === n - 1 || next.getMonth() !== date.getMonth();
    if (isEnd) {
      const balances: Record<string, number> = {};
      let total = 0;
      for (const a of accounts) { balances[a.id] = bal[a.id]; total += bal[a.id]; }
      rows.push({
        label: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        date, balances, total,
      });
    }
  }
  return { accounts, rows };
}

// ── Thrisha budget helpers ────────────────────────────────────────────────────
export function budgetStatus(div: Division): BudgetStatus {
  const effective = (div.limit || 0) + (div.carryover || 0);
  const remaining = effective - (div.spent || 0);
  const pct = effective > 0 ? (div.spent || 0) / effective : 0;
  let mood: BudgetStatus["mood"];
  let tone: BudgetStatus["tone"];
  if      (pct < 0.5)  { mood = "comfy";   tone = "ok"; }
  else if (pct < 0.8)  { mood = "mindful"; tone = "ok"; }
  else if (pct <= 1.0) { mood = "careful"; tone = "warn"; }
  else                 { mood = "over";    tone = "bad"; }
  return { remaining, pct, mood, tone, effective };
}

export function fixedStatus(div: Division, now?: Date): FixedStatus {
  const today = now ?? new Date();
  const done = (div.spent || 0) >= (div.limit || 0) && (div.limit || 0) > 0;
  const deadline = div.deadlineDay || 1;
  const daysLeft = deadline - today.getDate();
  let urgency: FixedStatus["urgency"];
  if      (done)         urgency = "done";
  else if (daysLeft < 0) urgency = "overdue";
  else if (daysLeft <= 3) urgency = "soon";
  else                   urgency = "open";
  return { done, daysLeft, deadline, urgency };
}

// ── Month rollover ────────────────────────────────────────────────────────────
export function monthKey(d?: Date): string {
  const x = d ?? new Date();
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0");
}

export function rolloverThrishaOnce(divisions: Division[]): Division[] {
  return divisions.map((dv) => {
    if (dv.isSavings) {
      const pockets = (dv.pockets ?? []).map((p) => ({ ...p, amount: (p.amount || 0) + (p.monthly || 0) }));
      return { ...dv, balance: (dv.balance || 0) + (dv.limit || 0), spent: dv.limit || 0, pockets };
    }
    if (dv.mode === "recurring") {
      const leftover = Math.max(0, (dv.limit || 0) + (dv.carryover || 0) - (dv.spent || 0));
      return { ...dv, carryover: leftover, spent: 0 };
    }
    return { ...dv, spent: 0, carryover: 0 };
  });
}

export function applyDueRollovers(data: ThrishaData, now?: Date): ThrishaData | null {
  const cur  = monthKey(now);
  const last = data.lastRollover;
  if (!last || last === cur) return last ? null : { ...data, lastRollover: cur };
  const [ly, lm] = last.split("-").map(Number);
  const t = now ?? new Date();
  let months = (t.getFullYear() - ly) * 12 + (t.getMonth() + 1 - lm);
  months = Math.max(0, Math.min(months, 36));
  if (months === 0) return { ...data, lastRollover: cur };
  let divisions = data.divisions;
  for (let i = 0; i < months; i++) divisions = rolloverThrishaOnce(divisions);
  return { ...data, divisions, lastRollover: cur };
}

// ── Copy strings (per aesthetic) ──────────────────────────────────────────────
export const COPY = {
  billionaire: {
    appName:   "MERIDIAN",
    tagline:   "Private Wealth Flow",
    netLabel:  "Projected Net Position",
    addCta:    "New Transaction",
    generate:  "Generate Projection",
    vizTitle:  "Capital Trajectory",
    vizSub:    "Day-by-day liquidity projection",
    profileVerb: "Portfolio",
  },
  girly: {
    appName:   "moneybloom",
    tagline:   "your cozy money garden ✿",
    netLabel:  "what you've got left",
    addCta:    "add a moment",
    generate:  "show my bloom",
    vizTitle:  "your money bloom",
    vizSub:    "day by day, petal by petal",
    profileVerb: "garden",
  },
} as const;

// ── Emotional messages ────────────────────────────────────────────────────────
export const THRISHA_NOTES: Record<string, string[]> = {
  comfy:   ["plenty of room here, queen 👑", "you're golden ✨", "breathing room — love that"],
  mindful: ["halfway — just keeping an eye 👀", "still good, stay sweet 🫶", "we're watching, gently"],
  careful: ["okayyy slow down babe 🛑", "we're close to the line…", "do you NEED it? be honest 💅"],
  warn:    ["careful careful 🚧", "this is your reminder to pause", "almost there — last call"],
  over:    ["babe. BABE. you went over 😭", "that's a no from me 🙅‍♀️", "we don't do overdraft drama 💔"],
};

export const FIXED_NOTES: Record<string, string[]> = {
  overdue: ["this was due — pay it now, no excuses 🛑", "you're past the deadline. handle it. 💢"],
  soon:    ["deadline's close — don't forget 🔔", "due very soon, take care of it 💅"],
  open:    ["due later this month — stay on it", "on the calendar, don't slip 📌"],
};

export const EXPENSE_CATS = [
  "Bill","Subscription","Food","Leisure","Transportation",
] as const;

// 10 aesthetic girly colors — index 0 is mint green (Savings default)
export const GIRLY_COLORS = [
  "#4ade80",  // mint green  ← Savings default (index 0)
  "#fda4af",  // blush rose
  "#f472b6",  // hot pink
  "#e879f9",  // fuchsia / orchid
  "#c084fc",  // lilac
  "#60a5fa",  // baby blue
  "#2dd4bf",  // teal
  "#fde047",  // butter yellow
  "#fb923c",  // coral / peach
  "#f43f5e",  // rose red
] as const;

export const WIZ_COLORS = GIRLY_COLORS;

export function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
export function ordinal(n: number): string {
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Rafael opening balance ────────────────────────────────────────────────────
export function rafOpening(data: RafaelData): number {
  // Credit card balance is stored as a positive "amount owed" — it's a liability,
  // so it's subtracted from net worth.
  let s = data.accounts.debit.balance - (data.accounts.credit.use ? data.accounts.credit.balance : 0);
  for (const b of data.banks) s += b.balance;
  return s;
}

// ── Thrisha remaining ─────────────────────────────────────────────────────────
export function thrishaRemaining(data: ThrishaData): number {
  return data.divisions
    .filter((d) => !d.isSavings)
    .reduce((s, d) => s + ((d.limit || 0) + (d.carryover || 0) - (d.spent || 0)), 0);
}

export function savingsPocket(data: ThrishaData): Division | null {
  return data.divisions.find((d) => d.isSavings) ?? null;
}
