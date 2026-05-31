-- ============================================================
-- Migration 002 — tracker schema
-- Run after 001_init.sql
-- ============================================================

-- ── user_settings ─────────────────────────────────────────────────────────────
create table if not exists user_settings (
  user_id        uuid primary key references profiles(id) on delete cascade,
  setup_done     boolean not null default false,
  start_date     date,
  -- Thrisha only
  monthly_income numeric(12,2) not null default 0,
  payday         integer not null default 15 check (payday between 1 and 28),
  last_rollover  text, -- 'YYYY-MM'
  updated_at     timestamptz not null default now()
);

create trigger user_settings_updated_at
  before update on user_settings
  for each row execute function update_updated_at();

alter table user_settings enable row level security;
create policy "user_settings_select" on user_settings for select to authenticated using (true);
create policy "user_settings_upsert" on user_settings for insert to authenticated with check (auth.uid() = user_id);
create policy "user_settings_update" on user_settings for update to authenticated using (auth.uid() = user_id);

-- ── accounts (Rafael's debit / credit / banks) ────────────────────────────────
create table if not exists accounts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references profiles(id) on delete cascade not null,
  account_key  text not null,  -- 'debit', 'credit', or a short stable key for banks
  name         text not null,
  balance      numeric(12,2) not null default 0,
  account_type text not null check (account_type in ('debit','credit','bank')),
  is_active    boolean not null default true,
  sort_order   integer not null default 0
);

alter table accounts enable row level security;
create policy "accounts_select" on accounts for select to authenticated using (true);
create policy "accounts_insert" on accounts for insert to authenticated with check (auth.uid() = user_id);
create policy "accounts_update" on accounts for update to authenticated using (auth.uid() = user_id);
create policy "accounts_delete" on accounts for delete to authenticated using (auth.uid() = user_id);

-- ── entries ───────────────────────────────────────────────────────────────────
-- Covers both Rafael (income/expense/transfer with account_key)
-- and Thrisha (income/expense with division_ref).
create table if not exists entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references profiles(id) on delete cascade not null,
  type          text not null check (type in ('income','expense','transfer')),
  amount        numeric(12,2) not null,
  account_key   text,          -- Rafael: which account
  to_account_key text,         -- Rafael: transfer destination
  division_ref  text,          -- Thrisha: division id OR 'sav:<goalId>'
  category      text,
  note          text not null default '',
  recurrence    jsonb not null, -- { kind, date, startDate, interval, unit }
  created_at    timestamptz not null default now()
);

alter table entries enable row level security;
create policy "entries_select" on entries for select to authenticated using (true);
create policy "entries_insert" on entries for insert to authenticated with check (auth.uid() = user_id);
create policy "entries_delete" on entries for delete to authenticated using (auth.uid() = user_id);

-- ── divisions (Thrisha's money pockets) ───────────────────────────────────────
create table if not exists divisions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references profiles(id) on delete cascade not null,
  name          text not null,
  color         text not null,
  budget_limit  numeric(12,2) not null default 0,
  spent         numeric(12,2) not null default 0,
  carryover     numeric(12,2) not null default 0,
  mode          text not null check (mode in ('recurring','fixed')),
  deadline_day  integer check (deadline_day between 1 and 28),
  is_savings    boolean not null default false,
  balance       numeric(12,2) not null default 0,  -- for savings pocket
  sort_order    integer not null default 0
);

alter table divisions enable row level security;
create policy "divisions_select" on divisions for select to authenticated using (true);
create policy "divisions_insert" on divisions for insert to authenticated with check (auth.uid() = user_id);
create policy "divisions_update" on divisions for update to authenticated using (auth.uid() = user_id);
create policy "divisions_delete" on divisions for delete to authenticated using (auth.uid() = user_id);

-- ── savings_goals (sub-pockets inside Thrisha's Savings division) ─────────────
create table if not exists savings_goals (
  id           uuid primary key default gen_random_uuid(),
  division_id  uuid references divisions(id) on delete cascade not null,
  name         text not null,
  color        text not null,
  amount       numeric(12,2) not null default 0,  -- saved so far
  monthly      numeric(12,2) not null default 0,  -- auto-adds each month
  sort_order   integer not null default 0
);

alter table savings_goals enable row level security;
create policy "savings_goals_select" on savings_goals for select to authenticated using (true);
create policy "savings_goals_insert" on savings_goals for insert to authenticated
  with check (exists (select 1 from divisions where id = division_id and user_id = auth.uid()));
create policy "savings_goals_update" on savings_goals for update to authenticated
  using (exists (select 1 from divisions where id = division_id and user_id = auth.uid()));
create policy "savings_goals_delete" on savings_goals for delete to authenticated
  using (exists (select 1 from divisions where id = division_id and user_id = auth.uid()));
