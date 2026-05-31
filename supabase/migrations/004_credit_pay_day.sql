-- ============================================================
-- Migration 004 — add pay_day column to accounts
-- Run this in the Supabase SQL Editor after 003.
-- ============================================================

alter table accounts add column if not exists pay_day integer;
