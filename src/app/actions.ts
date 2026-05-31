"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ── Auth ─────────────────────────────────────────────────────────────────────
// Credentials are read from server-only env vars (no NEXT_PUBLIC_ prefix).
// The client only sends the username string ("rafael" | "thrisha") —
// the password never touches the browser.
const SERVER_CREDENTIALS = {
  rafael: {
    email: process.env.RAFAEL_EMAIL ?? "",
    password: process.env.RAFAEL_PASSWORD ?? "",
  },
  thrisha: {
    email: process.env.THRISHA_EMAIL ?? "",
    password: process.env.THRISHA_PASSWORD ?? "",
  },
} as const;

export async function signInWithPattern(
  who: "rafael" | "thrisha"
): Promise<{ error: string } | never> {
  const creds = SERVER_CREDENTIALS[who];

  if (!creds.email || !creds.password) {
    return {
      error:
        "Server configuration error — check RAFAEL_EMAIL / THRISHA_EMAIL env vars in .env.local.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });

  if (error) {
    // Don't leak the Supabase message — it may hint at valid email addresses
    return {
      error:
        "Authentication failed. Make sure you ran `npm run seed` to create the users.",
    };
  }

  // redirect() throws NEXT_REDIRECT — Next.js catches it and navigates the client
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
