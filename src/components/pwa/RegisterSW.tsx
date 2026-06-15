"use client";

import { useEffect } from "react";

// Registers the service worker after the page loads. Failures are swallowed —
// the app works fine without it; the SW only adds offline-launch + app feel.
export default function RegisterSW() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
