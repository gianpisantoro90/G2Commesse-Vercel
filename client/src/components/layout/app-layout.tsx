import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import AppSidebar from "@/components/layout/app-sidebar";
import TopBar from "@/components/layout/top-bar";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function AppLayout({ children, title }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <TopBar title={title} />
        <div className="flex-1 overflow-auto p-4 md:p-6" id="main-content">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
