"use client";

import { useState, useTransition } from "react";
import PatternLock from "./PatternLock";
import { signInWithPattern } from "@/app/actions";
import type { UserName } from "@/lib/constants";

export default function LoginScreen() {
  const [isPending, startTransition] = useTransition();
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSolve = (who: UserName) => {
    setAuthError(null);
    startTransition(async () => {
      const result = await signInWithPattern(
        who.toLowerCase() as "rafael" | "thrisha"
      );
      // result is only returned when there's an error
      // (redirect() is called on success, which React handles as navigation)
      if (result?.error) {
        setAuthError(result.error);
      }
    });
  };

  return (
    <div className="app" data-theme="billionaire">
      <div
        className="screen"
        style={{ alignItems: "center", justifyContent: "center" }}
      >
        <div
          className="wrap"
          style={{
            maxWidth: 460,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 26,
            paddingTop: 24,
            paddingBottom: 24,
          }}
        >
          {/* Header */}
          <div
            className="center stack"
            style={{ gap: 10, alignItems: "center" }}
          >
            <div className="chip">🔐 secure entry</div>
            <h1
              className="display"
              style={{ fontSize: "clamp(34px,8vw,52px)" }}
            >
              Draw to unlock
            </h1>
            <p className="muted" style={{ fontSize: 15, maxWidth: 320 }}>
              Two people, two patterns. Your shape tells us whose money flow to
              open.
            </p>
          </div>

          {/* Pattern or loading state */}
          {isPending ? (
            <div
              style={{ padding: "40px 0", textAlign: "center" }}
              className="muted"
            >
              <p style={{ fontSize: 15 }}>Opening your flow…</p>
            </div>
          ) : (
            <PatternLock onSolve={handleSolve} />
          )}

          {/* Auth error */}
          {authError && (
            <p
              style={{
                color: "var(--neg)",
                fontWeight: 600,
                fontSize: 13,
                maxWidth: 340,
                textAlign: "center",
              }}
            >
              {authError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
