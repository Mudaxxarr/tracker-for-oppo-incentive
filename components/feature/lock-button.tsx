"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { lockAction } from "@/app/(app)/actions";
import { LogOut } from "lucide-react";

export function LockButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Sign out"
      className="gap-1.5"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await lockAction();
        });
      }}
    >
      <LogOut className="size-4" />
      <span className="hidden sm:inline">Sign out</span>
    </Button>
  );
}
