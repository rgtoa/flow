import type { Profile } from "./database.types";
export type { Profile };

export type Theme = "billionaire" | "girly";
export type Currency = "PHP" | "QAR";
export type Username = "rafael" | "thrisha";

// ── Recurrence ───────────────────────────────────────────────────────────────
export type RecurrenceOnce   = { kind: "once"; date: string };
export type RecurrenceMonthly = { kind: "monthly"; startDate: string };
export type RecurrenceCustom  = { kind: "custom"; interval: 1 | 2 | 3; unit: "week" | "month"; startDate: string };
export type Recurrence = RecurrenceOnce | RecurrenceMonthly | RecurrenceCustom;

// ── Entry ────────────────────────────────────────────────────────────────────
export type Entry = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  // Rafael fields
  account?: string;
  toAccount?: string;
  // Thrisha fields (division id, or 'sav:<goalId>' for savings)
  division?: string | null;
  category: string;
  note: string;
  recurrence: Recurrence;
};

// ── Rafael ───────────────────────────────────────────────────────────────────
export type AccountInfo = { name: string; balance: number; use: boolean };
export type BankInfo    = { id: string; name: string; balance: number };

export type RafaelData = {
  setupDone: boolean;
  startDate: string;
  lastUpdated: number;
  accounts: {
    debit:  AccountInfo;
    credit: AccountInfo;
  };
  banks:   BankInfo[];
  entries: Entry[];
};

// ── Thrisha ──────────────────────────────────────────────────────────────────
export type SavingsGoal = {
  id: string;
  name: string;
  color: string;
  amount:  number; // saved so far
  monthly: number; // auto-adds each month
};

export type Division = {
  id: string;
  name: string;
  color: string;
  limit:       number;
  spent:       number;
  carryover:   number;
  mode:        "recurring" | "fixed";
  deadlineDay?: number;
  isSavings:   boolean;
  balance?:    number;           // savings pocket: total nest egg
  pockets?:    SavingsGoal[];   // savings pocket: sub-goals
  allocation?: number;          // wizard only
};

export type ThrishaData = {
  setupDone:     boolean;
  startDate:     string;
  lastUpdated:   number;
  monthlyIncome: number;
  payday:        number;
  lastRollover:  string | null;
  divisions:     Division[];
  entries:       Entry[];
};

// ── Projection ───────────────────────────────────────────────────────────────
export type DayPoint = {
  date:    Date;
  balance: number;
  net:     number;
  events:  { entry: Entry; amount: number }[];
};

export type Projection = {
  days:     DayPoint[];
  peak:     number;
  trough:   number;
  totalIn:  number;
  totalOut: number;
  opening:  number;
  end:      number;
};

export type AccountScheduleRow = {
  label:    string;
  date:     Date;
  balances: Record<string, number>;
  total:    number;
};

export type AccountSchedule = {
  accounts: { id: string; name: string }[];
  rows:     AccountScheduleRow[];
};

// ── Budget helpers ────────────────────────────────────────────────────────────
export type BudgetStatus = {
  remaining: number;
  pct:       number;
  mood:      "comfy" | "mindful" | "careful" | "over";
  tone:      "ok" | "warn" | "bad";
  effective: number;
};

export type FixedStatus = {
  done:     boolean;
  daysLeft: number;
  deadline: number;
  urgency:  "done" | "overdue" | "soon" | "open";
};

// ── Range options ─────────────────────────────────────────────────────────────
export type RangeOption = { key: string; label: string; months: number };
