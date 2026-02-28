import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  CalendarClock,
  MessageSquare,
  FilePlus2,
  Users,
  Coins,
  Calculator,
  Award,
  Receipt,
  BrainCircuit,
  Mail,
  ListChecks,
  Clock,
  UserCog,
  HardDrive,
  Bot,
  Cloud,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import logoUrl from "@assets/G2 - Logo_1755532156423.png";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

const mainNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Commesse", url: "/commesse", icon: FolderKanban },
  { title: "To Do", url: "/todo", icon: CheckSquare },
  { title: "Scadenze", url: "/scadenze", icon: CalendarClock },
  { title: "Comunicazioni", url: "/comunicazioni", icon: MessageSquare },
];

const gestioneNavItems = [
  { title: "Nuova Commessa", url: "/commesse/nuova", icon: FilePlus2 },
  { title: "Clienti", url: "/clienti", icon: Users },
  { title: "Costi", url: "/costi", icon: Coins },
  { title: "Calc. Parcella", url: "/parcella", icon: Calculator },
  { title: "Requisiti Tecnici", url: "/requisiti", icon: Award },
  { title: "Fatturazione", url: "/fatturazione", icon: Receipt },
];

const aiSubItems = [
  { title: "Comunicazioni", url: "/revisione-ai", icon: Mail },
  { title: "Task Proposte", url: "/revisione-ai/tasks", icon: ListChecks },
  { title: "Scadenze Proposte", url: "/revisione-ai/scadenze", icon: Clock },
];

const sistemaNavItems = [
  { title: "Utenti", url: "/sistema/utenti", icon: UserCog },
  { title: "Storage", url: "/sistema/storage", icon: HardDrive },
  { title: "Config AI", url: "/sistema/ai-config", icon: Bot },
  { title: "OneDrive Browser", url: "/sistema/onedrive-browser", icon: Cloud },
  { title: "OneDrive Config", url: "/sistema/onedrive-config", icon: Settings },
];

function NavItem({ item, location }: { item: { title: string; url: string; icon: React.ComponentType<{ className?: string }> }; location: string }) {
  const isActive = item.url === "/" ? location === "/" : location.startsWith(item.url);
  const { setOpenMobile, isMobile } = useSidebar();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={item.title}
      >
        <Link
          href={item.url}
          onClick={() => { if (isMobile) setOpenMobile(false); }}
        >
          <item.icon className="h-4 w-4" />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export default function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const { setOpenMobile, isMobile } = useSidebar();
  const isAiActive = location.startsWith("/revisione-ai");

  const handleLogout = async () => {
    await logout();
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <img
                  src={logoUrl}
                  alt="G2"
                  className="h-8 w-8 rounded-md object-contain shrink-0"
                />
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold text-sm">G2 Ingegneria</span>
                  <span className="text-xs text-sidebar-foreground/60">Gestione Commesse</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* PRINCIPALE - visible to all */}
        <SidebarGroup>
          <SidebarGroupLabel>Principale</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <NavItem key={item.url} item={item} location={location} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* GESTIONE - admin only */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Gestione</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {gestioneNavItems.map((item) => (
                  <NavItem key={item.url} item={item} location={location} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* AI - admin only, collapsible */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Intelligenza Artificiale</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <Collapsible defaultOpen={isAiActive} className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="Revisione AI" isActive={isAiActive}>
                        <BrainCircuit className="h-4 w-4" />
                        <span>Revisione AI</span>
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {aiSubItems.map((item) => {
                          const isSubActive = location === item.url;
                          return (
                            <SidebarMenuSubItem key={item.url}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isSubActive}
                              >
                                <Link
                                  href={item.url}
                                  onClick={() => { if (isMobile) setOpenMobile(false); }}
                                >
                                  <item.icon className="h-4 w-4" />
                                  <span>{item.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* SISTEMA - admin only */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Sistema</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sistemaNavItems.map((item) => (
                  <NavItem key={item.url} item={item} location={location} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold shrink-0">
                {user?.fullName?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="text-sm font-medium truncate">{user?.fullName}</span>
                <span className="text-xs text-sidebar-foreground/60">
                  {user?.role === "admin" ? "Amministratore" : "Utilizzatore"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="flex items-center gap-1 px-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-8 w-8 text-sidebar-foreground/70 hover:text-destructive"
                title="Esci"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
