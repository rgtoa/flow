/**
 * Demo seed data — mirrors prototype/engine.jsx SEED constant.
 * Used by "Load sample data" buttons in both trackers.
 *
 * All IDs are hardcoded valid UUIDs so Supabase accepts them as primary keys.
 * Division IDs are defined as constants so entries can cross-reference them.
 */
import { todayISO, monthAnchorISO, isoDate, addDays } from "./engine";
import type { RafaelData, ThrishaData } from "./types";

const today  = todayISO();
const anchor = monthAnchorISO();
const stamp  = Date.now();

// ── Thrisha division IDs (entries reference these) ────────────────────────────
const DIV_SAV = "a1a1a1a1-0001-4000-8000-000000000001";
const DIV_D2  = "a1a1a1a1-0002-4000-8000-000000000002";
const DIV_D3  = "a1a1a1a1-0003-4000-8000-000000000003";
const DIV_D4  = "a1a1a1a1-0004-4000-8000-000000000004";
const DIV_D5  = "a1a1a1a1-0005-4000-8000-000000000005";
const DIV_D6  = "a1a1a1a1-0006-4000-8000-000000000006";

export const SEED: { Rafael: RafaelData; Thrisha: ThrishaData } = {
  Rafael: {
    setupDone:   true,
    startDate:   today,
    lastUpdated: stamp,
    accounts: {
      debit:  { name: "Debit · Default", balance: 48200, use: true },
      credit: { name: "Amex Platinum",   balance: -3150, use: true },
    },
    banks: [
      { id: "b1", name: "Goldman Vault", balance: 215000 },
      { id: "b2", name: "Chase Reserve", balance: 86400  },
    ],
    entries: [
      { id: "b1b1b1b1-0001-4000-8000-000000000001", type: "income",   amount: 18500, account: "debit",  category: "Salary",         note: "Base comp",         recurrence: { kind: "monthly", startDate: anchor } },
      { id: "b1b1b1b1-0002-4000-8000-000000000002", type: "income",   amount: 22000, account: "b1",     category: "Dividends",      note: "Equity dividends",  recurrence: { kind: "custom", interval: 3, unit: "month", startDate: anchor } },
      { id: "b1b1b1b1-0003-4000-8000-000000000003", type: "expense",  amount: 6200,  account: "debit",  category: "Bill",           note: "Penthouse lease",   recurrence: { kind: "monthly", startDate: anchor } },
      { id: "b1b1b1b1-0004-4000-8000-000000000004", type: "expense",  amount: 420,   account: "credit", category: "Subscription",   note: "Software + clubs",  recurrence: { kind: "monthly", startDate: anchor } },
      { id: "b1b1b1b1-0005-4000-8000-000000000005", type: "expense",  amount: 540,   account: "credit", category: "Grocery",        note: "Whole Foods",       recurrence: { kind: "custom", interval: 1, unit: "week", startDate: today } },
      { id: "b1b1b1b1-0006-4000-8000-000000000006", type: "expense",  amount: 9800,  account: "credit", category: "Leisure",        note: "Maldives trip",     recurrence: { kind: "once", date: isoDate(addDays(new Date(), 24)) } },
      { id: "b1b1b1b1-0007-4000-8000-000000000007", type: "expense",  amount: 1300,  account: "debit",  category: "Transportation", note: "Driver + fuel",     recurrence: { kind: "monthly", startDate: anchor } },
      { id: "b1b1b1b1-0008-4000-8000-000000000008", type: "transfer", amount: 8000,  account: "debit",  toAccount: "b1", category: "Transfer", note: "Sweep to vault", recurrence: { kind: "monthly", startDate: anchor } },
    ],
  },
  Thrisha: {
    setupDone:     true,
    startDate:     today,
    lastUpdated:   stamp,
    monthlyIncome: 5400,
    payday:        15,
    lastRollover:  anchor.slice(0, 7),
    divisions: [
      { id: DIV_SAV, name: "Savings",    color: "var(--pos)",      limit: 1200, spent: 1200, carryover: 0, mode: "fixed",     deadlineDay: 1,  isSavings: true,  balance: 8600, pockets: [
        { id: "c2c2c2c2-0001-4000-8000-000000000001", name: "Travel ✈️",  color: "var(--blue)", amount: 4200, monthly: 700 },
        { id: "c2c2c2c2-0002-4000-8000-000000000002", name: "Emergency",  color: "var(--neg)",  amount: 3000, monthly: 500 },
      ]},
      { id: DIV_D2, name: "Food",        color: "var(--accent)",   limit: 700,  spent: 430,  carryover: 50, mode: "recurring", isSavings: false },
      { id: DIV_D3, name: "Self-care",   color: "var(--lav)",      limit: 450,  spent: 380,  carryover: 0,  mode: "recurring", isSavings: false },
      { id: DIV_D4, name: "Leisure",     color: "var(--blue)",     limit: 500,  spent: 540,  carryover: 0,  mode: "recurring", isSavings: false },
      { id: DIV_D5, name: "Rent",        color: "var(--transfer)", limit: 900,  spent: 900,  carryover: 0,  mode: "fixed",     deadlineDay: 5,  isSavings: false },
      { id: DIV_D6, name: "Phone bill",  color: "var(--neg)",      limit: 80,   spent: 0,    carryover: 0,  mode: "fixed",     deadlineDay: 20, isSavings: false },
    ],
    entries: [
      { id: "c3c3c3c3-0001-4000-8000-000000000001", type: "income",  amount: 5400, division: null,    category: "Monthly income", note: "main job",           recurrence: { kind: "monthly", startDate: anchor } },
      { id: "c3c3c3c3-0002-4000-8000-000000000002", type: "income",  amount: 600,  division: null,    category: "Side gig",       note: "etsy shop",          recurrence: { kind: "custom", interval: 2, unit: "week", startDate: today } },
      { id: "c3c3c3c3-0003-4000-8000-000000000003", type: "expense", amount: 430,  division: DIV_D2,  category: "Food",           note: "groceries + treats", recurrence: { kind: "once", date: today } },
      { id: "c3c3c3c3-0004-4000-8000-000000000004", type: "expense", amount: 380,  division: DIV_D3,  category: "Self-care",      note: "nails + skincare",   recurrence: { kind: "once", date: today } },
      { id: "c3c3c3c3-0005-4000-8000-000000000005", type: "expense", amount: 540,  division: DIV_D4,  category: "Leisure",        note: "concert tickets 😬", recurrence: { kind: "once", date: today } },
      { id: "c3c3c3c3-0006-4000-8000-000000000006", type: "expense", amount: 900,  division: DIV_D5,  category: "Rent",           note: "rent share",         recurrence: { kind: "once", date: today } },
    ],
  },
};
