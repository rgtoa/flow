import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { loadRafaelData, loadThrishaData } from "@/lib/tracker-helpers";
import RafaelTracker from "@/components/tracker/rafael/RafaelTracker";
import ThrishaTracker from "@/components/tracker/thrisha/ThrishaTracker";
import type { Metadata } from "next";
import type { Profile } from "@/lib/database.types";
import type { RafaelData, ThrishaData, Currency, Theme } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asProfile(d: any): Profile | null { return d as Profile | null; }

// The PWA launches at /dashboard, so this is where the iOS status bar style is
// captured at install/launch time. Pick the icon colour that contrasts with the
// owner's theme: dark icons on Thrisha's light theme, white on Rafael's dark.
export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  const { data } = await supabase.from("profiles").select("theme").eq("id", user.id).single();
  const theme = (data as { theme?: string } | null)?.theme;
  const statusBarStyle = theme === "girly" ? "default" : "black-translucent";
  return { appleWebApp: { capable: true, statusBarStyle, title: "Flow" } };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: raw } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = asProfile(raw);
  if (!profile) redirect("/login");

  const isRafael    = profile.username === "rafael";
  const partnerSlug = isRafael ? "thrisha" : "rafael";
  const partnerLabel = isRafael ? "Thrisha's Garden 🌸" : "Rafael's Portfolio 👑";
  const currency    = profile.currency as Currency;
  const theme       = profile.theme    as Theme;

  const data = isRafael
    ? await loadRafaelData(supabase, user.id)
    : await loadThrishaData(supabase, user.id);

  return (
    // .app sets the theme; .screen provides the flex-column full-height container
    <div className="app" data-theme={theme}>
      <div className="screen">

        {/* ── Top bar ───────────────────────────────────────────── */}
        <header
          style={{
            borderBottom: "1px solid var(--line)",
            background: "color-mix(in oklch, var(--bg) 82%, transparent)",
            backdropFilter: "blur(12px)",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div className="wrap between" style={{ paddingTop: 12, paddingBottom: 12, minHeight: 56, flexWrap: "wrap", gap: 8 }}>
            <span className="display" style={{ fontSize: "clamp(15px,3vw,22px)", whiteSpace: "nowrap" }}>
              {profile.display_name}&apos;s {isRafael ? "Portfolio" : "Garden"}
            </span>

            <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
              {/* Peek at partner — show full label on ≥600px, emoji-only below */}
              <a
                href={`/dashboard/${partnerSlug}`}
                className="btn ghost"
                style={{
                  padding: "8px 12px", fontSize: 12.5,
                  textDecoration: "none",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  whiteSpace: "nowrap",
                }}
              >
                👀 <span className="tg-label">{partnerLabel}</span>
              </a>

              <form action={signOut}>
                <button
                  type="submit"
                  className="btn ghost"
                  style={{ padding: "8px 12px", fontSize: 12.5, whiteSpace: "nowrap" }}
                >
                  🔒 <span className="tg-label">lock</span>
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* ── Tracker ───────────────────────────────────────────── */}
        {isRafael ? (
          <RafaelTracker
            initialData={data as RafaelData}
            userId={user.id}
            canEdit={true}
            theme={theme}
            currency={currency}
          />
        ) : (
          <ThrishaTracker
            initialData={data as ThrishaData}
            userId={user.id}
            canEdit={true}
            theme={theme}
            currency={currency}
          />
        )}
      </div>
    </div>
  );
}
