"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, Undo2 } from "lucide-react";

export type ReliefAction = (
  kind: string,
  id: string,
  granted: boolean,
) => Promise<{ error?: string; ok?: boolean }>;

/**
 * "Achieved" override for a single policy (audit finding #7).
 *
 * The company sometimes posts a policy to a dealer even though the target was not
 * met. Flipping this forces the policy's gate; the payout still computes on the
 * dealer's real activity, so nothing is fabricated — but it does move money, which
 * is why granting it goes through a confirmation that asks the owner to cross-check.
 * Reverting is deliberately friction-free: undoing a mistake should be easy.
 */
export function ReliefToggle({
  kind,
  id,
  granted,
  action,
  disabled,
}: {
  kind: string;
  id: string;
  granted: boolean;
  action: ReliefAction;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  const apply = (next: boolean) => {
    start(async () => {
      const res = await action(kind, id, next);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(next ? "Marked as achieved" : "Relief reverted");
      setConfirming(false);
      router.refresh();
    });
  };

  if (granted) {
    return (
      <div className="flex items-center gap-1">
        <Badge className="gap-1 bg-emerald-600 px-1.5 py-0 text-[10px] hover:bg-emerald-600">
          <CheckCircle2 className="size-3" />
          Achieved
        </Badge>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[10px]"
          disabled={pending || disabled}
          onClick={() => apply(false)}
        >
          <Undo2 className="size-3" />
          Revert
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-6 px-2 text-[10px]"
        disabled={pending || disabled}
        onClick={() => setConfirming(true)}
      >
        Mark achieved
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Has the company actually posted this policy?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks the policy achieved even though its target was not met, so it will
              start paying out. The amount is still calculated on real activity — no volume
              is invented — but please cross-check with the company first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={(e) => { e.preventDefault(); apply(true); }}>
              {pending ? "Saving…" : "Yes, mark achieved"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
