"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { USERS, PATTERN_MIDPOINTS, type UserName } from "@/lib/constants";

type Status = "idle" | "bad" | Lowercase<UserName>;

interface Point {
  x: number;
  y: number;
}

interface Props {
  onSolve: (who: UserName) => void;
}

export default function PatternLock({ onSolve }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const centers = useRef<Point[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  const computeCenters = useCallback(() => {
    const g = gridRef.current;
    if (!g) return;
    const r = g.getBoundingClientRect();
    const cell = r.width / 3;
    centers.current = Array.from({ length: 9 }, (_, i) => ({
      x: (i % 3) * cell + cell / 2,
      y: Math.floor(i / 3) * cell + cell / 2,
    }));
  }, []);

  useEffect(() => {
    computeCenters();
    window.addEventListener("resize", computeCenters);
    return () => window.removeEventListener("resize", computeCenters);
  }, [computeCenters]);

  const localPt = (e: React.MouseEvent | React.TouchEvent): Point => {
    const g = gridRef.current!;
    const r = g.getBoundingClientRect();
    const t = "touches" in e ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };

  const hitNode = (pt: Point): number => {
    const cell = gridRef.current!.getBoundingClientRect().width / 3;
    const rad = cell * 0.36;
    for (let i = 0; i < 9; i++) {
      const c = centers.current[i];
      if (c && Math.hypot(pt.x - c.x, pt.y - c.y) < rad) return i;
    }
    return -1;
  };

  // Android-style: automatically include pass-through nodes
  const addNode = (i: number, cur: number[]): number[] => {
    if (cur.includes(i)) return cur;
    const next = [...cur];
    const last = cur[cur.length - 1];
    if (last != null) {
      const mid = PATTERN_MIDPOINTS[`${last}-${i}`];
      if (mid != null && !next.includes(mid)) next.push(mid);
    }
    next.push(i);
    return next;
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    if (status !== "idle" && status !== "bad") return;
    computeCenters();
    setStatus("idle");
    const pt = localPt(e);
    const i = hitNode(pt);
    setDrawing(true);
    setPointer(pt);
    setSel(i >= 0 ? [i] : []);
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    e.preventDefault(); // prevent scroll while drawing
    const pt = localPt(e);
    setPointer(pt);
    const i = hitNode(pt);
    if (i >= 0) setSel((s) => addNode(i, s));
  };

  const end = () => {
    if (!drawing) return;
    setDrawing(false);
    setPointer(null);

    const seq = sel.join(",");
    let match: UserName | null = null;
    for (const [name, user] of Object.entries(USERS) as [UserName, typeof USERS[UserName]][]) {
      if (user.pattern.join(",") === seq) match = name;
    }

    if (match) {
      setStatus(match.toLowerCase() as Lowercase<UserName>);
      setTimeout(() => onSolve(match!), 720);
    } else if (sel.length > 0) {
      setStatus("bad");
      setTimeout(() => {
        setSel([]);
        setStatus("idle");
      }, 650);
    } else {
      setSel([]);
    }
  };

  const lineColor =
    status === "bad"
      ? "var(--neg)"
      : status !== "idle"
      ? "var(--pos)"
      : "var(--accent)";

  const pathPts = sel.map((i) => centers.current[i]).filter(Boolean);

  return (
    <div className="stack" style={{ alignItems: "center", gap: 22 }}>
      <div
        ref={gridRef}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
        className="no-sel"
        style={{
          position: "relative",
          width: "min(78vw, 320px)",
          aspectRatio: "1",
          touchAction: "none",
          cursor: "pointer",
          animation: status === "bad" ? "shake .5s" : "none",
        }}
      >
        {/* Connection lines */}
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          {pathPts.length > 0 && (
            <polyline
              points={
                pathPts.map((p) => `${p!.x},${p!.y}`).join(" ") +
                (drawing && pointer ? ` ${pointer.x},${pointer.y}` : "")
              }
              fill="none"
              stroke={lineColor}
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                filter: `drop-shadow(0 0 8px ${lineColor})`,
                transition: "stroke .3s",
              }}
            />
          )}
        </svg>

        {/* 3×3 node grid */}
        {Array.from({ length: 9 }).map((_, i) => {
          const on = sel.includes(i);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${(i % 3) * 33.333 + 16.666}%`,
                top: `${Math.floor(i / 3) * 33.333 + 16.666}%`,
                transform: "translate(-50%,-50%)",
                width: "22%",
                height: "22%",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `2px solid ${on ? lineColor : "var(--line)"}`,
                background: on
                  ? `color-mix(in oklch, ${lineColor} 22%, var(--surface))`
                  : "var(--surface)",
                boxShadow: on ? `0 0 18px -2px ${lineColor}` : "none",
                transition: "all .18s",
              }}
            >
              <div
                style={{
                  width: on ? "42%" : "28%",
                  height: on ? "42%" : "28%",
                  borderRadius: "50%",
                  background: on ? lineColor : "var(--line)",
                  transition: "all .18s",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Status message */}
      <div style={{ height: 24, textAlign: "center" }}>
        {status === "bad" && (
          <span style={{ color: "var(--neg)", fontWeight: 600, fontSize: 14 }}>
            Hmm, that&apos;s not a known pattern. Try again.
          </span>
        )}
        {status !== "idle" && status !== "bad" && (
          <span
            className="pop-in"
            style={{ color: "var(--pos)", fontWeight: 700, fontSize: 15 }}
          >
            ✓ Welcome back,{" "}
            {status === "rafael" ? "Rafael" : "Thrisha"} — opening your
            flow…
          </span>
        )}
      </div>
    </div>
  );
}
