/**
 * tracker-helpers.ts
 * Converts between Supabase DB rows â†” the app's RafaelData / ThrishaData shapes.
 * Also contains persistence helpers that write back to Supabase from client components.
 */
// The Supabase client type varies slightly between SSR/browser variants and
// @supabase/supabase-js versions. Using SupabaseGeneric avoids the mismatch.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseGeneric = any;

import type { Database } from "./database.types";
import type {
  RafaelData, ThrishaData, Entry, Division, SavingsGoal, Recurrence,
} from "./types";
import { isoDate, todayISO } from "./engine";

type DB = Database["public"]["Tables"];
type DbEntry     = DB["entries"]["Row"];
type DbAccount   = DB["accounts"]["Row"];
type DbDivision  = DB["divisions"]["Row"];
type DbGoal      = DB["savings_goals"]["Row"];
type DbSettings  = DB["user_settings"]["Row"];

// â”€â”€ DB row â†’ app shape â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function dbEntryToEntry(e: DbEntry): Entry {
  return {
    id:         e.id,
    type:       e.type as Entry["type"],
    amount:     Number(e.amount),
    account:    e.account_key    ?? undefined,
    toAccount:  e.to_account_key ?? undefined,
    division:   e.division_ref   ?? undefined,
    category:   e.category       ?? "",
    note:       e.note,
    recurrence: e.recurrence as Recurrence,
  };
}

export function assembleRafaelData(
  settings:  DbSettings | null,
  accounts:  DbAccount[],
  entries:   DbEntry[],
): RafaelData {
  const debit  = accounts.find((a) => a.account_key === "debit");
  const credit = accounts.find((a) => a.account_key === "credit");
  const banks  = accounts
    .filter((a) => a.account_type === "bank")
    .sort((a, b) => a.sort_order - b.sort_order);

  return {
    setupDone:   settings?.setup_done ?? false,
    startDate:   settings?.start_date ?? todayISO(),
    lastUpdated: settings ? new Date(settings.updated_at).getTime() : Date.now(),
    accounts: {
      debit:  { name: debit?.name  ?? "Debit Â· Default", balance: Number(debit?.balance  ?? 0), use: true },
      credit: { name: credit?.name ?? "Credit card", balance: Number(credit?.balance ?? 0), use: credit?.is_active ?? false, statementDay: credit?.statement_day ?? undefined, payDay: credit?.pay_day ?? undefined, dueDay: credit?.due_day ?? undefined },
    },
    banks:   banks.map((b) => ({ id: b.id, name: b.name, balance: Number(b.balance) })),
    entries: entries.map(dbEntryToEntry),
  };
}

export function assembleThrishaData(
  settings:  DbSettings | null,
  divisions: DbDivision[],
  goals:     DbGoal[],
  entries:   DbEntry[],
): ThrishaData {
  const buildDivision = (d: DbDivision): Division => {
    const base: Division = {
      id:          d.id,
      name:        d.name,
      color:       d.color,
      limit:       Number(d.budget_limit),
      spent:       Number(d.spent),
      carryover:   Number(d.carryover),
      mode:        d.mode as Division["mode"],
      deadlineDay: d.deadline_day ?? undefined,
      isSavings:   d.is_savings,
    };
    if (d.is_savings) {
      base.balance = Number(d.balance);
      base.pockets = goals
        .filter((g) => g.division_id === d.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((g): SavingsGoal => ({
          id:      g.id,
          name:    g.name,
          color:   g.color,
          amount:  Number(g.amount),
          monthly: Number(g.monthly),
        }));
    }
    return base;
  };

  return {
    setupDone:     settings?.setup_done     ?? false,
    startDate:     settings?.start_date     ?? todayISO(),
    lastUpdated:   settings ? new Date(settings.updated_at).getTime() : Date.now(),
    monthlyIncome: Number(settings?.monthly_income ?? 0),
    payday:        settings?.payday         ?? 15,
    lastRollover:  settings?.last_rollover  ?? null,
    divisions:     divisions
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(buildDivision),
    entries: entries.map(dbEntryToEntry),
  };
}

// â”€â”€ app shape â†’ DB row helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function entryToDbRow(entry: Entry, userId: string): DB["entries"]["Insert"] {
  return {
    id:               entry.id,
    user_id:          userId,
    type:             entry.type,
    amount:           entry.amount,
    account_key:      entry.account   ?? null,
    to_account_key:   entry.toAccount ?? null,
    division_ref:     entry.division  ?? null,
    category:         entry.category,
    note:             entry.note,
    recurrence:       entry.recurrence as unknown as DB["entries"]["Insert"]["recurrence"],
  };
}

// â”€â”€ Persistence helpers (call from client components) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// These work directly with the browser Supabase client (RLS handles auth).

export async function persistRafaelSetup(
  supabase: SupabaseGeneric,
  userId:   string,
  data:     RafaelData,
): Promise<void> {
  // 1. Upsert settings
  const { error: settingsErr } = await supabase.from("user_settings").upsert({
    user_id:    userId,
    setup_done: data.setupDone,
    start_date: data.startDate,
  }, { onConflict: "user_id" });
  if (settingsErr) console.error("[persist] user_settings upsert failed:", settingsErr);

  // 2. Replace all accounts for this user
  const { error: delErr } = await supabase.from("accounts").delete().eq("user_id", userId);
  if (delErr) console.error("[persist] accounts delete failed:", delErr);

  const rows: DB["accounts"]["Insert"][] = [];
  rows.push({ user_id: userId, account_key: "debit",  name: data.accounts.debit.name,  balance: data.accounts.debit.balance,  account_type: "debit",  is_active: true,                      sort_order: 0 });
  rows.push({ user_id: userId, account_key: "credit", name: data.accounts.credit.name, balance: data.accounts.credit.balance, account_type: "credit", is_active: data.accounts.credit.use, sort_order: 1, statement_day: data.accounts.credit.statementDay ?? null, pay_day: data.accounts.credit.payDay ?? null, due_day: data.accounts.credit.dueDay ?? null });
  data.banks.forEach((b, i) => rows.push({ user_id: userId, account_key: b.id, name: b.name, balance: b.balance, account_type: "bank", is_active: true, sort_order: 2 + i }));
  if (rows.length) {
    const { error: accErr } = await supabase.from("accounts").insert(rows);
    if (accErr) console.error("[persist] accounts insert failed:", accErr);
  }
}

export async function addEntry(
  supabase: SupabaseGeneric,
  userId:   string,
  entry:    Entry,
): Promise<void> {
  const { error } = await supabase.from("entries").insert(entryToDbRow(entry, userId));
  if (error) console.error("[persist] entries insert failed:", error);
}

export async function deleteEntry(
  supabase: SupabaseGeneric,
  entryId:  string,
): Promise<void> {
  await supabase.from("entries").delete().eq("id", entryId);
}

/**
 * Touch user_settings.updated_at so the "Last updated" timestamp reflects
 * any change — not just settings edits. The DB trigger handles the actual
 * timestamp value; we just need to issue any UPDATE to the row.
 */
export async function touchLastUpdated(
  supabase: SupabaseGeneric,
  userId:   string,
): Promise<void> {
  await supabase
    .from("user_settings")
    .update({ updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}

export async function persistThrishaSettings(
  supabase: SupabaseGeneric,
  userId:   string,
  data:     Pick<ThrishaData, "setupDone" | "startDate" | "monthlyIncome" | "payday" | "lastRollover">,
): Promise<void> {
  const { error } = await supabase.from("user_settings").upsert({
    user_id:        userId,
    setup_done:     data.setupDone,
    start_date:     data.startDate,
    monthly_income: data.monthlyIncome,
    payday:         data.payday,
    last_rollover:  data.lastRollover ?? undefined,
  }, { onConflict: "user_id" });
  if (error) console.error("[persist] user_settings upsert failed:", error);
}

export async function persistDivisions(
  supabase:  SupabaseGeneric,
  userId:    string,
  divisions: Division[],
): Promise<void> {
  // Replace all divisions for this user
  const { error: delErr } = await supabase.from("divisions").delete().eq("user_id", userId);
  if (delErr) console.error("[persist] divisions delete failed:", delErr);
  if (!divisions.length) return;

  const divRows: DB["divisions"]["Insert"][] = divisions.map((d, i) => ({
    id:           d.id,
    user_id:      userId,
    name:         d.name,
    color:        d.color,
    budget_limit: d.limit,
    spent:        d.spent,
    carryover:    d.carryover,
    mode:         d.mode,
    deadline_day: d.deadlineDay ?? null,
    is_savings:   d.isSavings,
    balance:      d.balance ?? 0,
    sort_order:   i,
  }));
  const { error: divErr } = await supabase.from("divisions").insert(divRows);
  if (divErr) console.error("[persist] divisions insert failed:", divErr);

  // Savings goals
  for (const d of divisions) {
    if (d.isSavings && d.pockets?.length) {
      const goalRows: DB["savings_goals"]["Insert"][] = d.pockets.map((p, i) => ({
        id:          p.id,
        division_id: d.id,
        name:        p.name,
        color:       p.color,
        amount:      p.amount,
        monthly:     p.monthly,
        sort_order:  i,
      }));
      await supabase.from("savings_goals").insert(goalRows);
    }
  }
}

// â”€â”€ Server-side data loading (used in page.tsx) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function loadRafaelData(
  supabase: SupabaseGeneric,
  userId:   string,
): Promise<RafaelData> {
  const [settingsRes, accountsRes, entriesRes] = await Promise.all([
    supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("accounts").select("*").eq("user_id", userId),
    supabase.from("entries").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);
  return assembleRafaelData(
    settingsRes.data,
    accountsRes.data ?? [],
    entriesRes.data  ?? [],
  );
}

export async function loadThrishaData(
  supabase: SupabaseGeneric,
  userId:   string,
): Promise<ThrishaData> {
  const [settingsRes, divisionsRes, goalsRes, entriesRes] = await Promise.all([
    supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("divisions").select("*").eq("user_id", userId),
    supabase.from("savings_goals").select("*"),
    supabase.from("entries").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);
  return assembleThrishaData(
    settingsRes.data,
    divisionsRes.data ?? [],
    goalsRes.data     ?? [],
    entriesRes.data   ?? [],
  );
}

