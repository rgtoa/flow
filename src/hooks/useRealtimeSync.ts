"use client";
/**
 * useRealtimeSync
 *
 * Subscribes to Supabase Realtime postgres_changes for a given userId
 * and calls onSync() whenever any tracked table row changes.
 *
 * Also polls every POLL_INTERVAL_MS as a reliable fallback — Supabase
 * Realtime postgres_changes events are blocked by RLS when the viewer
 * is not the row owner, so polling guarantees the partner view stays fresh.
 *
 * Usage: wire this into the READ-ONLY (canEdit=false) tracker view so
 * the partner sees live updates when the owner mutates their data.
 *
 * Prerequisites: migration 003_enable_realtime.sql must be run so the
 * tables are part of the supabase_realtime publication.
 */
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// Tables that have a user_id column — use a filter for targeted delivery.
const USER_SCOPED = ["entries", "accounts", "user_settings", "divisions"] as const;

// savings_goals links via division_id, not user_id directly.
// For a 2-person app it's fine to receive all changes and let the callback
// decide whether to re-fetch.
const UNSCOPED = ["savings_goals"] as const;

/** How often to poll when the realtime event doesn't fire (RLS blocks it). */
const POLL_INTERVAL_MS = 20_000; // 20 s

export function useRealtimeSync(
  /** User ID whose data changes we want to watch */
  userId: string,
  /** Called on any relevant change — should re-fetch and update state */
  onSync: () => void,
  /** Set to false to disable the subscription (e.g. when canEdit=true) */
  enabled = true,
) {
  // Stable ref so the effect closure always calls the latest onSync callback
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  // Realtime subscription (fires instantly when events get through)
  useEffect(() => {
    if (!enabled || !userId) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;
    const channelName = `tracker-sync-${userId}`;

    const channel = supabase.channel(channelName);

    // Filtered subscriptions — only fire when this user's rows change
    for (const table of USER_SCOPED) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
        () => onSyncRef.current(),
      );
    }

    // Unfiltered — fires for any savings_goal change; harmless at 2-user scale
    for (const table of UNSCOPED) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => onSyncRef.current(),
      );
    }

    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        console.debug(`[realtime] subscribed to ${channelName}`);
        // Fetch once on subscribe to fill any gap between server render and
        // when the live connection became active.
        onSyncRef.current();
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, enabled]); // re-subscribe only if userId or enabled changes

  // Polling fallback — catches changes that RLS blocks from realtime delivery
  useEffect(() => {
    if (!enabled || !userId) return;

    const id = setInterval(() => {
      console.debug(`[realtime] poll refresh for ${userId}`);
      onSyncRef.current();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [userId, enabled]);
}
