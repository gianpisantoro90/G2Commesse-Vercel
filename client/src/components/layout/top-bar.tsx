import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { NotificationCenter } from "@/components/notifications/notification-center";

interface TopBarProps {
  title?: string;
}

export default function TopBar({ title }: TopBarProps) {
  return (
    <header className="flex h-12 items-center gap-2 border-b bg-background px-4 shrink-0">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />
      {title && (
        <h1 className="text-sm font-semibold text-foreground truncate">
          {title}
        </h1>
      )}
      <div className="ml-auto flex items-center gap-2">
        <NotificationCenter />
      </div>
    </header>
  );
}
