import Link from "next/link";
import { ThemeToggle } from "@/components/feature/theme-toggle";
import { logoutAction } from "@/app/dealer/actions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DealerLogoTrigger } from "./dealer-logo-trigger";
import { DealerViewSwitcher } from "./dealer-view-switcher";
import { DealerIdSwitcher, type DealerIdOption } from "./dealer-id-switcher";
import { LogOut, HelpCircle } from "lucide-react";

interface DealerTopBarProps {
  businessName: string;
  shopName?: string | null;
  isAdmin?: boolean;
  showViewSwitcher?: boolean;
  idOptions?: DealerIdOption[];
  activeDealerId?: string | null;
}

export function DealerTopBar({ businessName, shopName, isAdmin, showViewSwitcher, idOptions, activeDealerId }: DealerTopBarProps) {
  const showIdSwitcher = (idOptions?.length ?? 0) >= 2;
  return (
    <header
      className="sticky top-0 z-20 border-b border-border bg-card"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-14 items-center gap-3 px-3 md:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 font-medium">
          <DealerLogoTrigger isAdmin={isAdmin} />
          {showIdSwitcher ? (
            <DealerIdSwitcher options={idOptions!} activeId={activeDealerId ?? null} />
          ) : (
            <span className="truncate text-sm">{shopName ?? businessName}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {showViewSwitcher && <DealerViewSwitcher />}
          <Link
            href="/dealer/help"
            data-tour="help-button"
            aria-label="Help"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
          >
            <HelpCircle className="size-4" />
            <span className="hidden sm:inline">Help</span>
          </Link>
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
      </div>
    </header>
  );
}
