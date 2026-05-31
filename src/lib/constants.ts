// User definitions — the only two users this app will ever have.
// Patterns are checked client-side; credentials live in server-only env vars.
export const USERS = {
  Rafael: {
    username: "rafael" as const,
    displayName: "Rafael",
    // Top row (0→1→2) + right column (5→8) — draws a sharp "7"
    pattern: [0, 1, 2, 5, 8],
    defaultTheme: "billionaire" as const,
    currency: "PHP" as const,
    currencySymbol: "₱",
  },
  Thrisha: {
    username: "thrisha" as const,
    displayName: "Thrisha",
    // Diamond: top(1) → right(5) → bottom(7) → left(3)
    pattern: [1, 5, 7, 3],
    defaultTheme: "girly" as const,
    currency: "QAR" as const,
    currencySymbol: "QR ",
  },
} as const;

export type UserName = keyof typeof USERS;
export type Username = "rafael" | "thrisha";
export type Theme = "billionaire" | "girly";
export type Currency = "PHP" | "QAR";

// Android-style pass-through nodes: drawing from 0→2 auto-includes node 1
export const PATTERN_MIDPOINTS: Record<string, number> = {
  "0-2": 1, "2-0": 1,
  "3-5": 4, "5-3": 4,
  "6-8": 7, "8-6": 7,
  "0-6": 3, "6-0": 3,
  "1-7": 4, "7-1": 4,
  "2-8": 5, "8-2": 5,
  "0-8": 4, "8-0": 4,
  "2-6": 4, "6-2": 4,
};

// Rafael's expense categories (used in the add-transaction UI)
export const EXPENSE_CATS = [
  "Bill",
  "Subscription",
  "Food",
  "Leisure",
  "Transportation",
] as const;

// 10 aesthetic girly colors — index 0 is mint green (Savings default)
export const GIRLY_COLORS = [
  "#4ade80",  // mint green  ← Savings default
  "#fda4af",  // blush rose
  "#f472b6",  // hot pink
  "#e879f9",  // fuchsia / orchid
  "#c084fc",  // lilac
  "#60a5fa",  // baby blue
  "#2dd4bf",  // teal
  "#fde047",  // butter yellow
  "#fb923c",  // coral / peach
  "#f43f5e",  // rose red
] as const;
