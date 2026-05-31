-- ============================================================
-- Migration 004 — add credit card billing cycle columns to accounts
-- Run this in the Supabase SQL Editor after 003.
-- ============================================================

alter table accounts add column if not exists statement_day integer; -- day statement closes
alter table accounts add column if not exists pay_day       integer; -- planned pay-in-full day
alter table accounts add column if not exists due_day       integer; -- actual bank deadline
