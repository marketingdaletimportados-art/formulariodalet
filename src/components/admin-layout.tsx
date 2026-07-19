import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileText, Users, Settings, LogOut, Menu, Loader2, ShieldCheck } from "lucide-react";
import { DaletLogo } from "./dalet-logo";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { toast } from "sonner";

const nav = [
  { title: "Visão geral", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Autorizações", url: "/admin/autorizacoes", icon: FileText },
  { title: "Vendedores", url: "/admin/vendedores", icon: Users },
  { title: "Configurações", url: "/admin/configuracoes", icon: Settings },
] as const;

function AppSidebar({ email }: { email: string | null }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      navigate({ to: "/admin", replace: true });
    } catch {
      toast.error("Não foi possível sair. Tente novamente.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3">
        <DaletLogo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {email && (
          <div className="px-2 py-2 text-xs group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-1.5 text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="font-medium">Administrador</span>
            </div>
            <div className="mt-0.5 truncate text-muted-foreground" title={email}>
              {email}
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-destructive"
            >
              {loggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              <span>{loggingOut ? "Saindo..." : "Sair"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AdminLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <AppSidebar email={email} />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background px-4">
            <SidebarTrigger>
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
            {email && (
              <div className="ml-auto hidden text-right text-xs text-muted-foreground sm:block">
                <div className="font-medium text-foreground">{email}</div>
                <div>Administrador</div>
              </div>
            )}
          </header>
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
