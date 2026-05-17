"use client";

import { useTransition } from "react";
import { lockTeamAction } from "@/app/team/actions";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { Users, Lock } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import Link from "next/link";

export function TeamTopBar() {
  const [, startTransition] = useTransition();

  const onLock = () => {
    if (!confirm("Exit team view?")) return;
    startTransition(async () => {
      await lockTeamAction();
    });
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-3 backdrop-blur md:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 font-semibold">
        <Users className="size-5 shrink-0 text-primary" />
        <span className="hidden truncate lg:inline">{APP_NAME}</span>
        <span className="hidden truncate sm:inline lg:hidden">OPPO ID Tracker</span>
        <span className="truncate sm:hidden">OPPO</span>
        <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
          Team View
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/dashboard" className="hidden text-xs text-muted-foreground underline-offset-2 hover:underline md:inline">
          Admin
        </Link>
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={onLock} className="gap-1.5">
          <Lock className="size-3.5" />
          <span className="hidden sm:inline">Exit</span>
        </Button>
      </div>
    </header>
  );
}
