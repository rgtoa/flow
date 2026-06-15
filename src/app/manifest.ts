import type { MetadataRoute } from "next";

// Served by Next at /manifest.webmanifest. Drives installability + standalone
// launch on both iOS (Add to Home Screen) and Android.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Flow — Money Tracker",
    short_name: "Flow",
    description: "Rafael & Thrisha's private money flow tracker",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
