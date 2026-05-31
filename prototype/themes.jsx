/* ============================================================
   themes.jsx — JS tokens, copy strings, shared atoms, icons
   ============================================================ */

// ---- per-aesthetic chart palette (read in SVG) ----
const CHART = {
  billionaire: {
    line:   "oklch(0.82 0.11 84)",
    fill0:  "rgba(205,170,98,0.30)",
    fill1:  "rgba(205,170,98,0.0)",
    grid:   "rgba(255,255,255,0.06)",
    axis:   "rgba(235,225,205,0.55)",
    pos:    "oklch(0.78 0.13 152)",
    neg:    "oklch(0.65 0.18 26)",
    dot:    "oklch(0.88 0.06 84)",
    glowId: "glowGold",
  },
  girly: {
    line:   "oklch(0.7 0.16 5)",
    fill0:  "rgba(245,150,190,0.34)",
    fill1:  "rgba(200,190,255,0.04)",
    grid:   "rgba(190,110,150,0.12)",
    axis:   "rgba(150,90,120,0.6)",
    pos:    "oklch(0.7 0.13 165)",
    neg:    "oklch(0.66 0.19 12)",
    dot:    "oklch(0.78 0.13 350)",
    glowId: "glowRose",
  },
};

// ---- copy that swaps with the aesthetic (toggle_scope: everything) ----
const COPY = {
  billionaire: {
    appName: "MERIDIAN",
    tagline: "Private Wealth Flow",
    greet: (n) => `Good to see you, ${n}.`,
    netLabel: "Projected Net Position",
    addCta: "New Transaction",
    generate: "Generate Projection",
    vizTitle: "Capital Trajectory",
    vizSub: "Day-by-day liquidity projection",
    emptyViz: "Log your positions, then generate the trajectory.",
    profileVerb: "Portfolio",
    settle: "Holdings",
  },
  girly: {
    appName: "moneybloom",
    tagline: "your cozy money garden ✿",
    greet: (n) => `hi ${n}, you got this 💗`,
    netLabel: "what you've got left",
    addCta: "add a moment",
    generate: "show my bloom",
    vizTitle: "your money bloom",
    vizSub: "day by day, petal by petal",
    emptyViz: "pop in your money moments, then watch it bloom 🌸",
    profileVerb: "garden",
    settle: "pockets",
  },
};

const { useState, useEffect, useRef, useMemo, useCallback } = React;

function clone(o) { return JSON.parse(JSON.stringify(o)); }

// ---- currency (per-person: Rafael = PHP, Thrisha = QAR) ----
const CURRENCIES = { PHP: { symbol: "₱" }, QAR: { symbol: "QR " } };
let ACTIVE_CCY = "PHP";
function setActiveCcy(code) { if (CURRENCIES[code]) ACTIVE_CCY = code; }
function ccySym() { return CURRENCIES[ACTIVE_CCY].symbol; }

// ---- money formatting ----
function fmtMoney(n, { sign = false, cents = false } = {}) {
  const neg = n < 0;
  const abs = Math.abs(n);
  const s = abs.toLocaleString("en-US", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  const core = ccySym() + s;
  if (sign) return (neg ? "−" : "+") + core;
  return (neg ? "−" : "") + core;
}
function fmtShort(n) {
  const a = Math.abs(n);
  let v;
  if (a >= 1e9) v = (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  else if (a >= 1e6) v = (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  else if (a >= 1e3) v = (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  else v = Math.round(n).toString();
  return ccySym() + v;
}

// ---- minimal stroke icons (UI primitives only) ----
function Icon({ name, size = 20, stroke = 1.8, style }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: stroke, strokeLinecap: "round", strokeLinejoin: "round", style };
  const paths = {
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    check: <path d="M4 12.5l5 5 11-11" />,
    x: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
    chevR: <path d="M9 6l6 6-6 6" />,
    chevL: <path d="M15 6l-6 6 6 6" />,
    chevD: <path d="M6 9l6 6 6-6" />,
    arrowUp: <><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></>,
    arrowDown: <><path d="M12 5v14" /><path d="M6 13l6 6 6-6" /></>,
    transfer: <><path d="M7 8h12l-3-3" /><path d="M17 16H5l3 3" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
    edit: <><path d="M4 20h4l11-11-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></>,
    trash: <><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 13h10l1-13" /></>,
    spark: <><path d="M12 3v4" /><path d="M12 17v4" /><path d="M3 12h4" /><path d="M17 12h4" /><path d="M6 6l2.5 2.5" /><path d="M15.5 15.5L18 18" /><path d="M18 6l-2.5 2.5" /><path d="M8.5 15.5L6 18" /></>,
    heart: <path d="M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.4.8-1.2 2-2.4 4-2.4 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20z" />,
    crown: <path d="M3 7l4 4 5-6 5 6 4-4-2 12H5L3 7z" />,
    calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 9h16" /><path d="M9 3v4M15 3v4" /></>,
    repeat: <><path d="M4 9l3-3 3 3" /><path d="M7 6v7a4 4 0 0 0 4 4h6" /><path d="M20 15l-3 3-3-3" /></>,
    card: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>,
    bank: <><path d="M4 10h16M5 10l7-5 7 5M6 10v8M10 10v8M14 10v8M18 10v8M4 20h16" /></>,
    wallet: <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M16 12h3" /></>,
    sliders: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2.2" /><circle cx="8" cy="17" r="2.2" /></>,
    bell: <><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
    flower: <><circle cx="12" cy="12" r="2.4" /><path d="M12 4a3 3 0 0 1 0 6M12 14a3 3 0 0 1 0 6M4 12a3 3 0 0 1 6 0M14 12a3 3 0 0 1 6 0" /></>,
  };
  return <svg {...p}>{paths[name] || null}</svg>;
}

// avatar disc
function Avatar({ who, size = 44, ring }) {
  const map = {
    Rafael: { bg: "linear-gradient(140deg,#2a2a2e,#16161a)", fg: "oklch(0.82 0.11 84)", glyph: "crown", ini: "R" },
    Thrisha: { bg: "linear-gradient(140deg,#ffd9ea,#ffeef6)", fg: "oklch(0.62 0.17 5)", glyph: "heart", ini: "T" },
  };
  const m = map[who];
  return (
    <div className="no-sel" style={{
      width: size, height: size, borderRadius: "50%", background: m.bg, color: m.fg,
      display: "flex", alignItems: "center", justifyContent: "center", flex: "none",
      fontFamily: 'var(--font-display)', fontSize: size * 0.42,
      boxShadow: ring ? "0 0 0 2px var(--bg), 0 0 0 4px var(--accent)" : "inset 0 0 0 1px rgba(255,255,255,0.08)",
    }}>
      {m.ini}
    </div>
  );
}

// time-of-day greeting (own profile only) + current date + last-updated stamp
function Greeting({ name, mine = true, lastUpdated }) {
  const now = new Date();
  const h = now.getHours();
  const part = h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  const emoji = h < 12 ? "🌅" : h < 18 ? "☀️" : "🌙";
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const updatedStr = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " · " +
      new Date(lastUpdated).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;
  return (
    <div className="stack" style={{ gap: 6, paddingBottom: 2 }}>
      <div className="between" style={{ flexWrap: "wrap", gap: 8 }}>
        {mine
          ? <span className="display" style={{ fontSize: "clamp(20px,4vw,26px)" }}>Good {part}, {name} {emoji}</span>
          : <span />}
        <span className="chip" style={{ fontSize: 11.5, fontWeight: 600 }}><Icon name="calendar" size={13} /> {dateStr}</span>
      </div>
      {updatedStr && <span className="muted" style={{ fontSize: 11, alignSelf: mine ? "flex-start" : "flex-end" }}>Last updated {updatedStr}</span>}
    </div>
  );
}

Object.assign(window, { CHART, COPY, fmtMoney, fmtShort, Icon, Avatar, Greeting, clone, setActiveCcy, ccySym,
  useState, useEffect, useRef, useMemo, useCallback });
