import type { Metadata } from "next";
import LoginScreen from "@/components/auth/LoginScreen";

export const metadata: Metadata = {
  title: "Unlock — Flow",
};

// Thin server-component wrapper — keeps the page.tsx as a server component
// so Next.js can add metadata, while the interactive pattern lock lives in
// the client component (LoginScreen).
export default function LoginPage() {
  return <LoginScreen />;
}
