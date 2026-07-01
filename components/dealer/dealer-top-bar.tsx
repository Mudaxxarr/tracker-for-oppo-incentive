import { ThemeToggle } from "@/components/feature/theme-toggle";
import { logoutAction } from "@/app/dealer/actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DealerLogoTrigger } from "./dealer-logo-trigger";
import { LogOut } from "lucide-react";

interface DealerTopBarProps {
  businessName: string;
  shopName?: string | null;
  isAdmin?: boolean;
}

export function DealerTopBar({ businessName, shopName, isAdmin }: DealerTopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card px-3 md:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 font-medium">
        <DealerLogoTrigger isAdmin={isAdmin} />
        <span className="truncate text-sm">{shopName ?? businessName}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <form action={logoutAction}>
          <button
            type="submit"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "gap-1.5",
            )}
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </form>
      </div>
    </header>
  );
}
