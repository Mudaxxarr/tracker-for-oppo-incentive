"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { lockAction } from "@/app/(app)/actions";
import { Lock } from "lucide-react";

export function LockButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Lock"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await lockAction();
        });
      }}
    >
      <Lock className="size-4" />
    </Button>
  );
}
