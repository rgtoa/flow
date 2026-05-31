// Port of the Icon function from prototype/themes.jsx
// Minimal stroke icons matching the original design exactly.
import React from "react";

interface Props {
  name: string;
  size?: number;
  stroke?: number;
  style?: React.CSSProperties;
  className?: string;
}

const PATHS: Record<string, React.ReactNode> = {
  plus:      <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  check:     <path d="M4 12.5l5 5 11-11" />,
  x:         <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
  chevR:     <path d="M9 6l6 6-6 6" />,
  chevL:     <path d="M15 6l-6 6 6 6" />,
  chevD:     <path d="M6 9l6 6 6-6" />,
  arrowUp:   <><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></>,
  arrowDown: <><path d="M12 5v14" /><path d="M6 13l6 6 6-6" /></>,
  transfer:  <><path d="M7 8h12l-3-3" /><path d="M17 16H5l3 3" /></>,
  eye:       <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  lock:      <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  edit:      <><path d="M4 20h4l11-11-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></>,
  trash:     <><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 13h10l1-13" /></>,
  spark:     <><path d="M12 3v4" /><path d="M12 17v4" /><path d="M3 12h4" /><path d="M17 12h4" /><path d="M6 6l2.5 2.5" /><path d="M15.5 15.5L18 18" /><path d="M18 6l-2.5 2.5" /><path d="M8.5 15.5L6 18" /></>,
  heart:     <path d="M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.4.8-1.2 2-2.4 4-2.4 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20z" />,
  crown:     <path d="M3 7l4 4 5-6 5 6 4-4-2 12H5L3 7z" />,
  calendar:  <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 9h16" /><path d="M9 3v4M15 3v4" /></>,
  repeat:    <><path d="M4 9l3-3 3 3" /><path d="M7 6v7a4 4 0 0 0 4 4h6" /><path d="M20 15l-3 3-3-3" /></>,
  card:      <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></>,
  bank:      <><path d="M4 10h16M5 10l7-5 7 5M6 10v8M10 10v8M14 10v8M18 10v8M4 20h16" /></>,
  wallet:    <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M16 12h3" /></>,
  sliders:   <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2.2" /><circle cx="8" cy="17" r="2.2" /></>,
  bell:      <><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  flower:    <><circle cx="12" cy="12" r="2.4" /><path d="M12 4a3 3 0 0 1 0 6M12 14a3 3 0 0 1 0 6M4 12a3 3 0 0 1 6 0M14 12a3 3 0 0 1 6 0" /></>,
};

export default function Icon({ name, size = 20, stroke = 1.8, style, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
    >
      {PATHS[name] ?? null}
    </svg>
  );
}
