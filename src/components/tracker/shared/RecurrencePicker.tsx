"use client";
import Icon from "./Icon";
import { todayISO } from "@/lib/engine";
import type { Recurrence } from "@/lib/types";

interface Props {
  rec: Recurrence;
  setRec: (r: Recurrence) => void;
}

export default function RecurrencePicker({ rec, setRec }: Props) {
  const kind = rec.kind;
  const startDate = rec.kind !== "once" ? rec.startDate : todayISO();

  return (
    <div className="stack" style={{ gap: 12 }}>
      <span className="label">How often?</span>
      <div className="tiles" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        {([
          { k: "monthly", t: "Monthly",  s: "every month",    ic: "repeat" },
          { k: "custom",  t: "Custom",   s: "weeks / months", ic: "sliders" },
          { k: "once",    t: "One-time", s: "single date",    ic: "calendar" },
        ] as const).map((o) => (
          <button
            key={o.k}
            className={"tile" + (kind === o.k ? " on" : "")}
            style={{ padding: 14, alignItems: "flex-start" }}
            onClick={() =>
              setRec(
                o.k === "monthly" ? { kind: "monthly", startDate }
                : o.k === "custom"  ? { kind: "custom",  interval: 1, unit: "month", startDate }
                :                     { kind: "once",    date: todayISO() }
              )
            }
          >
            <Icon name={o.ic} size={18} style={{ color: "var(--accent)" }} />
            <span className="t-title" style={{ fontSize: 14 }}>{o.t}</span>
            <span className="t-sub">{o.s}</span>
          </button>
        ))}
      </div>

      {kind === "custom" && (
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <span className="label">Every</span>
          <div className="seg">
            {([1, 2, 3] as const).map((i) => (
              <button
                key={i}
                className={rec.kind === "custom" && rec.interval === i ? "on" : ""}
                onClick={() => rec.kind === "custom" && setRec({ ...rec, interval: i })}
              >{i}</button>
            ))}
          </div>
          <div className="seg">
            {(["week", "month"] as const).map((u) => (
              <button
                key={u}
                className={rec.kind === "custom" && rec.unit === u ? "on" : ""}
                onClick={() => rec.kind === "custom" && setRec({ ...rec, unit: u })}
              >{u}{rec.kind === "custom" && rec.interval > 1 ? "s" : ""}</button>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <span className="label">{kind === "once" ? "On this date" : "Starting from"}</span>
        <input
          className="input"
          type="date"
          value={kind === "once" ? rec.date : rec.startDate}
          onChange={(e) =>
            setRec(
              kind === "once"
                ? { kind: "once",    date:      e.target.value }
                : kind === "monthly"
                ? { kind: "monthly", startDate: e.target.value }
                : { ...rec,          startDate: e.target.value }
            )
          }
        />
      </div>
    </div>
  );
}
