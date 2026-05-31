// Transparent parent — just ensures auth is checked before any /dashboard/* page.
// Each child (page.tsx and [username]/layout.tsx) renders its own full wrapper
// so themes and headers don't stack.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <>{children}</>;
}
