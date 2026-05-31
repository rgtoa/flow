/**
 * Creates the two Supabase Auth accounts (Rafael and Thrisha) and inserts
 * their profile rows. Run once after creating the Supabase project:
 *
 *   npm run seed
 *
 * Re-running is safe — it checks for existing users first.
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local so we can read the Supabase keys
config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

// Service-role client bypasses RLS — only safe in scripts, never in app code
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface UserSeed {
  email: string;
  password: string;
  username: "rafael" | "thrisha";
  display_name: string;
  theme: "billionaire" | "girly";
  currency: "PHP" | "QAR";
}

const USERS: UserSeed[] = [
  {
    email: process.env.RAFAEL_EMAIL ?? "rafael@flow.app",
    password: process.env.RAFAEL_PASSWORD ?? "",
    username: "rafael",
    display_name: "Rafael",
    theme: "billionaire",
    currency: "PHP",
  },
  {
    email: process.env.THRISHA_EMAIL ?? "thrisha@flow.app",
    password: process.env.THRISHA_PASSWORD ?? "",
    username: "thrisha",
    display_name: "Thrisha",
    theme: "girly",
    currency: "QAR",
  },
];

async function seed() {
  console.log("🌱  Seeding users…\n");

  for (const u of USERS) {
    if (!u.password) {
      console.warn(
        `⚠️   No password set for ${u.display_name} — check RAFAEL_PASSWORD / THRISHA_PASSWORD in .env.local`
      );
      continue;
    }

    // Check if the user already exists
    const { data: existing } = await admin.auth.admin.listUsers();
    const alreadyExists = existing?.users.some((x) => x.email === u.email);

    let userId: string;

    if (alreadyExists) {
      console.log(`ℹ️   ${u.display_name} already exists — skipping auth creation`);
      const found = existing!.users.find((x) => x.email === u.email)!;
      userId = found.id;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true, // skip email verification for a private app
      });

      if (error || !data.user) {
        console.error(`❌  Failed to create ${u.display_name}:`, error?.message);
        continue;
      }

      userId = data.user.id;
      console.log(`✓  Created auth user: ${u.display_name} (${u.email})`);
    }

    // Upsert the profile row
    const { error: profileErr } = await admin.from("profiles").upsert(
      {
        id: userId,
        username: u.username,
        display_name: u.display_name,
        theme: u.theme,
        currency: u.currency,
      },
      { onConflict: "id" }
    );

    if (profileErr) {
      console.error(
        `❌  Failed to upsert profile for ${u.display_name}:`,
        profileErr.message
      );
    } else {
      console.log(`✓  Profile upserted: ${u.display_name}`);
    }
  }

  console.log("\n✅  Done. You can now run `npm run dev` and draw your pattern.");
}

seed().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
