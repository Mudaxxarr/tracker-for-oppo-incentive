import { ThemeToggle } from "@/components/feature/theme-toggle";
import { logoutAction } from "@/app/dealer/actions";
import { Button } from "@/components/ui/button";
import { Activity, LogOut } from "lucide-react";

interface DealerTopBarProps {
  businessName: string;
}

export function DealerTopBar({ businessName }: DealerTopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-3 backdrop-blur md:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 font-semibold">
        <Activity className="size-5 shrink-0 text-primary" />
        <span className="truncate text-sm">{businessName}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="icon" title="Sign out">
            <LogOut className="size-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
