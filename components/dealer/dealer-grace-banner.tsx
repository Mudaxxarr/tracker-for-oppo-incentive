import { AlertTriangle } from "lucide-react";

export function DealerGraceBanner() {
  return (
    <div className="flex items-center gap-2 border-b border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
      <AlertTriangle className="size-4 shrink-0" />
      <span>
        Your subscription has expired. Access continues in grace period — contact
        your administrator to renew.
      </span>
    </div>
  );
}
