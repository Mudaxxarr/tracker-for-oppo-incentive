import { format } from "date-fns";
import { ThemeToggle } from "./theme-toggle";
import { DealerSwitcher, type DealerOption } from "./dealer-switcher";
import { LockButton } from "./lock-button";
import { APP_NAME } from "@/lib/constants";
import { Activity } from "lucide-react";

interface TopBarProps {
  dealers: DealerOption[];
  activeDealerId: string | null;
}

export function TopBar({ dealers, activeDealerId }: TopBarProps) {
  const monthLabel = format(new Date(), "MMM yyyy");
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/95 px-3 backdrop-blur md:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 font-semibold">
        <Activity className="size-5 shrink-0 text-primary" />
        <span className="hidden truncate lg:inline">{APP_NAME}</span>
        <span className="hidden truncate sm:inline lg:hidden">OPPO ID Tracker</span>
        <span className="truncate sm:hidden">OPPO</span>
      </div>
      <div className="hidden shrink-0 items-center gap-2 md:flex">
        <span className="hidden text-xs text-muted-foreground xl:inline">{monthLabel}</span>
        <DealerSwitcher options={dealers} activeId={activeDealerId} />
        <ThemeToggle />
        <LockButton />
      </div>
    </header>
  );
}
