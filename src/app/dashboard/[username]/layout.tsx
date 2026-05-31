import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import type { Profile } from "@/lib/database.types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asProfile(d: any): Profile | null { return d as Profile | null; }

// Partner-view layout — overrides dashboard/layout.tsx for /dashboard/[username].
// Sets the *partner's* theme, shows a read-only banner, and a "← back" button.
export default async function PartnerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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

  // If you somehow navigate to your own username URL, redirect to /dashboard
  if (viewer.username === username) redirect("/dashboard");

  // Partner (person being viewed)
  const { data: partnerRaw } = await supabase.from("profiles").select("*").eq("username", username).single();
  const partner = asProfile(partnerRaw);
  if (!partner) notFound();

  const isRafael = partner.username === "rafael";

  return (
    // Use the PARTNER's theme so the whole UI matches their aesthetic
    <div className="app" data-theme={partner.theme}>
      <div className="screen">
        <header
          style={{
            borderBottom: "1px solid var(--line)",
            background: "color-mix(in oklch, var(--bg) 82%, transparent)",
            backdropFilter: "blur(12px)",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div className="wrap between" style={{ padding: "12px 0", minHeight: 64 }}>
            <div className="row" style={{ gap: 10 }}>
              {/* Back to own portfolio */}
              <a
                href="/dashboard"
                className="btn ghost"
                style={{ padding: "8px 12px", fontSize: 12.5, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 7 }}
              >
                ← back
              </a>
              <span className="display" style={{ fontSize: "clamp(16px,3vw,22px)" }}>
                {partner.display_name}&apos;s {isRafael ? "Portfolio" : "Garden"}
              </span>
            </div>

            <form action={signOut}>
              <button type="submit" className="btn ghost" style={{ padding: "8px 12px", fontSize: 12.5 }}>
                🔒 lock
              </button>
            </form>
          </div>
        </header>

        {/* Read-only banner */}
        <div className="readonly-bar">
          👁 Viewing as {viewer.display_name} · look but don&apos;t touch — only {partner.display_name} can edit this {isRafael ? "portfolio" : "garden"}
        </div>

        {children}
      </div>
    </div>
  );
}
