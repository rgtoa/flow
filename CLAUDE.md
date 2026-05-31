# CLAUDE.md — Flow Money App

A private two-person money tracker for **Rafael** (₱ PHP) and **Thrisha** (QR QAR).
Each person has their own dashboard, tracker, and visualizations.
They can view each other's data in read-only mode.

---

## Quick start

```bash
npm install

# First-time setup (do this once):
# 1. Create a Supabase project at https://supabase.com
# 2. Copy .env.local.example → .env.local and fill in all values
# 3. Run the migration SQL in Supabase SQL Editor: supabase/migrations/001_init.sql
# 4. Create the two user accounts:
npm run seed

# Then start developing:
npm run dev        # http://localhost:3000  (Turbopack, fast HMR)
npm run build      # production build
```

---

## Environment variables

Copy `.env.local.example` → `.env.local` and fill in:

| Variable | Where to get it | Client-visible? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | ✓ yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | ✓ yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | ✗ no (seed only) |
| `RAFAEL_EMAIL` | You decide | ✗ no |
| `RAFAEL_PASSWORD` | You decide (strong password) | ✗ no |
| `THRISHA_EMAIL` | You decide | ✗ no |
| `THRISHA_PASSWORD` | You decide (strong password) | ✗ no |

`RAFAEL_PASSWORD` and `THRISHA_PASSWORD` are **server-only** (no `NEXT_PUBLIC_` prefix).
They are read only inside `src/app/actions.ts` (a Server Action) — never bundled into client JS.

---

## Auth design

- **No public signup.** Two users are created once via `npm run seed`.
- **Pattern lock** is the UI. Drawing the correct pattern identifies who you are.
- Pattern matching is client-side only (no round-trip). Once identified, the server action
  `signInWithPattern(who)` reads the password from env and calls Supabase Auth.
- Supabase manages sessions via HttpOnly cookies.
- `src/middleware.ts` protects every route: unauthenticated → `/login`, auth on login → `/dashboard`.

### Unlock patterns
| Person | Pattern nodes | Shape |
|---|---|---|
| Rafael | `[0, 1, 2, 5, 8]` | Top row + right column — a "7" |
| Thrisha | `[1, 5, 7, 3]` | Diamond ♦ |

Nodes are 0-indexed, row-major: `0 1 2 / 3 4 5 / 6 7 8`.
Android-style pass-through: drawing from 0→2 auto-includes node 1.

Patterns are defined in `src/lib/constants.ts`.

---

## Project structure

```
src/
├── app/
│   ├── globals.css              — CSS variables (both themes) + base styles
│   ├── layout.tsx               — Root HTML shell; loads Google Fonts
│   ├── page.tsx                 — Redirects to /dashboard or /login
│   ├── actions.ts               — Server Actions: signInWithPattern, signOut
│   ├── login/
│   │   └── page.tsx             — Thin wrapper that renders <LoginScreen>
│   └── dashboard/
│       ├── layout.tsx           — App shell (top bar, data-theme wrapper)
│       ├── page.tsx             — Main tracker (welcome + partner peek + placeholder)
│       └── [username]/
│           └── page.tsx         — Partner's tracker in read-only mode (not yet built)
├── components/
│   ├── auth/
│   │   ├── PatternLock.tsx      — 3×3 drag-to-connect node grid
│   │   └── LoginScreen.tsx      — Client wrapper; calls signInWithPattern
│   └── ui/                      — Shared primitives (Button, Card, Sheet…) — TODO
├── lib/
│   ├── supabase/
│   │   ├── client.ts            — Browser Supabase client (Client Components)
│   │   └── server.ts            — Server Supabase client (Server Components / Actions)
│   ├── constants.ts             — User patterns, themes, expense categories, colors
│   ├── types.ts                 — Shared TypeScript types
│   └── database.types.ts        — Supabase table types (update when schema changes)
├── hooks/                       — Real-time React hooks (not yet built)
└── middleware.ts                — Route protection + session refresh

prototype/                       — Original HTML/JSX prototype (READ-ONLY reference)
scripts/
└── seed-users.ts                — Creates Rafael + Thrisha in Supabase Auth
supabase/
└── migrations/
    └── 001_init.sql             — profiles table + RLS policies
```

---

## How real-time sync works (planned)

Not yet implemented. Plan for next sprint:

1. `src/hooks/useRealtime.ts` wraps `supabase.channel('table').on('postgres_changes', ...)`
2. Each tracker subscribes to its owner's rows in `entries` / `divisions`
3. Supabase pushes the change via WebSocket → React re-renders within ~1s

Why Supabase Realtime over polling: WebSocket push, no polling overhead, free tier supports this volume indefinitely.

---

## How to add a new expense category (Rafael)

Edit the `EXPENSE_CATS` array in `src/lib/constants.ts`. The UI reads it directly.

## How to add a new pocket color (Thrisha)

Edit `GIRLY_COLORS` in `src/lib/constants.ts`. Colors must be valid CSS values (CSS variables like `var(--lav)` are fine).

---

## Database schema (current state)

**Tables:** `profiles` only.

Coming next: `entries`, `user_accounts`, `user_settings`, `divisions`, `savings_goals`.

Run each new migration by pasting the SQL into the Supabase SQL editor and executing it.

---

## Dual theme system

Every color in the app uses CSS custom properties (`var(--accent)`, `var(--bg)`, etc.) defined in `src/app/globals.css` on `[data-theme="billionaire"]` and `[data-theme="girly"]`.

**Rule: never hardcode a color in a component.** Always use `var(--something)`.

The dashboard layout reads `profile.theme` from Supabase and sets `data-theme` on the `.app` wrapper.

Theme toggle (click 👑/🌸 in the top bar) will update `profiles.theme` via a Server Action and re-render the layout.

---

## Deployment

```
Vercel (frontend) + Supabase (database/auth)
```

1. Push to GitHub
2. Import repo in Vercel → add all env vars from `.env.local`
3. Deploy — Vercel sets `NODE_ENV=production` automatically

The Supabase DB is external; no Supabase changes needed for Vercel deployment.

---

## Known gotchas

- **Turbopack** (`npm run dev`): restart the dev server if you change `next.config.ts` or `tailwind.config.ts`
- **`cookies()` is async in Next.js 15**: always `await createClient()` in server code
- **Prototype reference**: `prototype/` has the full working design. Before building any tracker feature, read `prototype/rafael.jsx` or `prototype/thrisha.jsx` to understand exact expected behavior, data shapes, and edge cases.
- **RLS policies**: The seed script uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS. Normal app code uses the anon key, which is subject to RLS policies.
- **`redirect()` in Server Actions**: throws `NEXT_REDIRECT` internally — don't catch it. Return `{ error: string }` for real errors instead.
