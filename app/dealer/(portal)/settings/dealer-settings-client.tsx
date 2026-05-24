"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { changeDealerPasswordAction, purgeDealerAuditLogAction, type SettingsState } from "./actions";
import { toast } from "sonner";
import { Download, History, Lock } from "lucide-react";

interface Props {
  basePercent: number;
  defaultBonusPercent: number;
}

export function DealerSettingsClient({ basePercent, defaultBonusPercent }: Props) {
  const [pwState, pwAction, pwPending] = useActionState<SettingsState, FormData>(
    changeDealerPasswordAction,
    {},
  );

  useEffect(() => {
    if (pwState.ok) toast.success("Password updated");
    else if (pwState.error) toast.error(pwState.error);
  }, [pwState]);

  return (
    <>
      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="size-4" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={pwAction} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input name="currentPassword" type="password" placeholder="Current password" required disabled={pwPending} />
            <Input name="newPassword" type="password" placeholder="New password (6+ chars)" required disabled={pwPending} />
            <Input name="confirmPassword" type="password" placeholder="Confirm new password" required disabled={pwPending} />
            <Button type="submit" className="sm:col-span-3" disabled={pwPending}>
              {pwPending ? "Updating…" : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Constants (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Incentive Rates</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Base incentive %</dt>
              <dd className="text-xl font-bold tabular-nums">{basePercent}%</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Default target bonus %</dt>
              <dd className="text-xl font-bold tabular-nums">{defaultBonusPercent}%</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            These rates are set by OPPO and apply to your incentive calculations.
          </p>
        </CardContent>
      </Card>

      {/* Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="size-4" />
            Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Download a copy of your data — purchases, activations, transfers, and policies.
          </p>
          <a href="/api/dealer/backup" download className={cn(buttonVariants({ variant: "outline" }))}>
            <Download className="size-4" />
            Download backup
          </a>
        </CardContent>
      </Card>

      {/* Activity log purge */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" />
            Activity Log Housekeeping
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PurgeAuditForm />
        </CardContent>
      </Card>
    </>
  );
}

function PurgeAuditForm() {
  const [days, setDays] = useState("90");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Delete entries older than (days)</label>
        <Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} className="w-40" />
      </div>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          const n = Number(days);
          if (!confirm(`Permanently delete activity log entries older than ${n} days?`)) return;
          startTransition(async () => {
            const r = await purgeDealerAuditLogAction(n);
            if (r.ok) toast.success(`Deleted ${r.deleted} entries`);
            else toast.error(r.error ?? "Purge failed");
          });
        }}
      >
        {pending ? "Purging…" : "Purge"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Activity log is unbounded — trim occasionally if it grows large.
      </p>
    </div>
  );
}
