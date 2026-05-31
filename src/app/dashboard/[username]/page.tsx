import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { loadRafaelData, loadThrishaData } from "@/lib/tracker-helpers";
import RafaelTracker from "@/components/tracker/rafael/RafaelTracker";
import ThrishaTracker from "@/components/tracker/thrisha/ThrishaTracker";
import type { Profile } from "@/lib/database.types";
import type { Currency, Theme } from "@/lib/types";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asProfile(d: any): Profile | null { return d as Profile | null; }

// Shown when the partner hasn't set up their tracker yet.
// Server-rendered so there's no chance of the client component showing
// the editable onboarding by mistake.
function PartnerNotSetUp({ name, noun }: { name: string; noun: string }) {
  return (
    <div className="scroll grow">
      <div
        className="wrap center"
        style={{
          paddingTop: "16vh",
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: 48 }}>🌱</span>
        <h2 className="display" style={{ fontSize: 26 }}>
          {name} hasn&apos;t built their {noun} yet
        </h2>
        <p className="muted" style={{ fontSize: 14.5 }}>
          Once {name} sets up their money flow, you&apos;ll be able to peek at it here.
        </p>
      </div>
    </div>
  );
}

export default async function PartnerPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  if (username !== "rafael" && username !== "thrisha") notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Viewer (logged-in user)
  const { data: viewerRaw } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const viewer = asProfile(viewerRaw);
  if (!viewer) redirect("/login");

  // Redirect to own dashboard if someone navigates to their own username
  if (viewer.username === username) redirect("/dashboard");

  // Partner (person being viewed)
  const { data: partnerRaw } = await supabase.from("profiles").select("*").eq("username", username).single();
  const partner = asProfile(partnerRaw);
  if (!partner) notFound();

  const currency = partner.currency as Currency;
  const theme    = partner.theme    as Theme;

  const partnerTitle = username === "rafael" ? "Rafael's Portfolio" : "Thrisha's Garden";

  function Shell({ children }: { children: React.ReactNode }) {
    return (
      <div className="app" data-theme={theme}>
        <div className="screen">
          {/* Top bar */}
          <header style={{ borderBottom: "1px solid var(--line)", background: "color-mix(in oklch, var(--bg) 82%, transparent)", backdropFilter: "blur(12px)", position: "relative", zIndex: 2 }}>
            <div className="wrap between" style={{ paddingTop: 12, paddingBottom: 12, minHeight: 56, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <a href="/dashboard" className="btn ghost" style={{ padding: "8px 12px", fontSize: 12.5, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                  ← <span className="tg-label">back</span>
                </a>
                <span className="display" style={{ fontSize: "clamp(14px,3vw,20px)", whiteSpace: "nowrap" }}>{partnerTitle}</span>
              </div>
              <form action={signOut}>
                <button type="submit" className="btn ghost" style={{ padding: "8px 12px", fontSize: 12.5, whiteSpace: "nowrap" }}>
                  🔒 <span className="tg-label">lock</span>
                </button>
              </form>
            </div>
          </header>
          {/* Read-only banner */}
          <div className="readonly-bar" style={{ fontSize: 12 }}>
            👁 Viewing as {viewer?.display_name} · look but don&apos;t touch — only {partner?.display_name} can edit this
          </div>
          {children}
        </div>
      </div>
    );
  }

  if (username === "rafael") {
    const data = await loadRafaelData(supabase, partner.id);

    if (!data.setupDone) {
      return <Shell><PartnerNotSetUp name="Rafael" noun="portfolio" /></Shell>;
    }

    return (
      <Shell>
        <RafaelTracker
          initialData={data}
          userId={partner.id}
          canEdit={false}
          theme={theme}
          currency={currency}
        />
      </Shell>
    );
  }

  // Thrisha
  const data = await loadThrishaData(supabase, partner.id);

  if (!data.setupDone || data.divisions.length === 0) {
    return <Shell><PartnerNotSetUp name="Thrisha" noun="garden" /></Shell>;
  }

  return (
    <Shell>
      <ThrishaTracker
        initialData={data}
        userId={partner.id}
        canEdit={false}
        theme={theme}
        currency={currency}
      />
    </Shell>
  );
}
