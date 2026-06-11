import { Clock } from "lucide-react";

export function DealerExpiryWarning({ daysLeft }: { daysLeft: number }) {
  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <Clock className="size-4 shrink-0" />
      <span>
        Your subscription expires in <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong>. Contact your
        administrator to renew before access is interrupted.
      </span>
    </div>
  );
}
