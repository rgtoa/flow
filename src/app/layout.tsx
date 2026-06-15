import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/pwa/RegisterSW";

export const metadata: Metadata = {
  title: "Flow — Private Money Tracker",
  description: "Rafael & Thrisha's personal money flow app",
  applicationName: "Flow",
  manifest: "/manifest.webmanifest",
  // Standalone "real app" behaviour on iOS. statusBarStyle is overridden
  // per-theme on the dashboard (see dashboard/page.tsx) so the status bar
  // icons stay legible on both the dark and light themes.
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Flow" },
  other: { "mobile-web-app-capable": "yes" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Draw under the notch/home indicator; globals.css pads with safe-area insets.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Load both theme font stacks up front to avoid FOUT on theme switch */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Marcellus&family=Archivo:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=DM+Serif+Display:ital@0;1&family=Quicksand:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
