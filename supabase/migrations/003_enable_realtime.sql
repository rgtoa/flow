-- ============================================================
-- Migration 003 — enable Supabase Realtime on tracker tables
-- Run this in the Supabase SQL Editor after 002.
-- ============================================================

-- Add each tracker table to the supabase_realtime publication
-- so that postgres_changes events are broadcast to subscribed clients.
alter publication supabase_realtime add table entries;
alter publication supabase_realtime add table accounts;
alter publication supabase_realtime add table user_settings;
alter publication supabase_realtime add table divisions;
alter publication supabase_realtime add table savings_goals;
