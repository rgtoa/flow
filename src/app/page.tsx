import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Root page: just a router. The real UI lives at /login and /dashboard.
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
