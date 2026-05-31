import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  if (username === "rafael") {
    const data = await loadRafaelData(supabase, partner.id);

    // Guard: partner hasn't set up yet — show empty state here on the server,
    // not inside the client component, to avoid any hydration edge cases.
    if (!data.setupDone) {
      return <PartnerNotSetUp name="Rafael" noun="portfolio" />;
    }

    return (
      <RafaelTracker
        initialData={data}
        userId={partner.id}
        canEdit={false}
        theme={theme}
        currency={currency}
      />
    );
  }

  // Thrisha
  const data = await loadThrishaData(supabase, partner.id);

  if (!data.setupDone || data.divisions.length === 0) {
    return <PartnerNotSetUp name="Thrisha" noun="garden" />;
  }

  return (
    <ThrishaTracker
      initialData={data}
      userId={partner.id}
      canEdit={false}
      theme={theme}
      currency={currency}
    />
  );
}
