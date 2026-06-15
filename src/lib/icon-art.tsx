import type { ReactElement } from "react";

// "Cash flow stonks" app mark: a rising bar chart with a bold up-and-to-the-right
// arrow, on the gold→rose brand gradient (a blend of both themes). Drawn as an
// inline SVG data URI so resvg (inside next/og's ImageResponse) rasterises it
// reliably at any size. Shared by icon.tsx (512) and apple-icon.tsx (180).
export function FlowIconArt({ size }: { size: number }): ReactElement {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <g fill="#2a1e12" opacity="0.18">
      <rect x="14" y="66" width="13" height="20" rx="2"/>
      <rect x="32" y="56" width="13" height="30" rx="2"/>
      <rect x="50" y="44" width="13" height="42" rx="2"/>
      <rect x="68" y="30" width="13" height="56" rx="2"/>
    </g>
    <polyline points="16,70 35,57 53,48 80,22" fill="none" stroke="#1f1710" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M80 22 L60 22 L80 42 Z" fill="#1f1710"/>
  </svg>`;
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #ECC77F 0%, #E7A6B6 52%, #C98FB8 100%)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} width={size} height={size} alt="" />
    </div>
  );
}
