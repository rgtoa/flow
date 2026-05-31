import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flow — Private Money Tracker",
  description: "Rafael & Thrisha's personal money flow app",
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
      <body>{children}</body>
    </html>
  );
}
