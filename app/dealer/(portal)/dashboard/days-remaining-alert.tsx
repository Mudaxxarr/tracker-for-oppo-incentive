"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

interface Props {
  daysLeft: number;
  expiresAt: string;
}

export function DaysRemainingAlert({ daysLeft, expiresAt }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (daysLeft <= 3) setOpen(true);
  }, [daysLeft]);

  if (daysLeft > 3) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm border-destructive">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5 shrink-0" />
            Subscription Expiring Soon
          </DialogTitle>
          <DialogDescription className="text-sm">
            Your subscription expires on <strong>{expiresAt}</strong>.{" "}
            {daysLeft <= 0
              ? "Your access has expired or expires today."
              : `Only ${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining.`}{" "}
            Contact your admin to renew before losing access.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
