-- ============================================================
-- Migration 001 — initial schema
-- Run this in the Supabase SQL editor (not the CLI) for a
-- quick first-time setup without installing supabase-cli.
-- ============================================================

-- ── Profiles ─────────────────────────────────────────────────────────────────
-- One row per user, created by the seed script.
-- id references auth.users so deleting a Supabase Auth user cascades here.
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null
                  check (username in ('rafael', 'thrisha')),
  display_name  text not null,
  theme         text not null default 'billionaire'
                  check (theme in ('billionaire', 'girly')),
  currency      text not null default 'PHP'
                  check (currency in ('PHP', 'QAR')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-update updated_at on row change
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table profiles enable row level security;

-- Any authenticated user can read any profile
-- (This app has exactly 2 users who both know about each other)
create policy "profiles_select"
  on profiles for select
  to authenticated
  using (true);

-- Users can only update their own profile (theme, currency preferences)
create policy "profiles_update"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- The seed script uses the service role (bypasses RLS) for inserts
-- No insert policy needed for normal app use
