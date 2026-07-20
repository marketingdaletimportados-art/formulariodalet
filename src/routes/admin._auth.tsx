import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/_auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/admin" });
    }
    // Verify admin role server-side (SECURITY DEFINER function).
    const { data: isAdmin, error } = await supabase.rpc("is_admin");
    if (error || !isAdmin) {
      await supabase.auth.signOut();
      throw redirect({ to: "/admin", search: { unauthorized: "1" } as never });
    }
    return { user: data.session.user };
  },
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  ),
  component: () => <Outlet />,
});
