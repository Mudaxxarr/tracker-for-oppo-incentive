"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  changePinAction,
  purgeAuditLogAction,
  updateConstantsAction,
  setTeamPinAction,
  type SettingsFormState,
} from "./actions";
import { lockAction } from "@/app/(app)/actions";
import { toast } from "sonner";
import { Lock, History, Users } from "lucide-react";
import Link from "next/link";

interface Props {
  initial: { basePercent: number; defaultBonusPercent: number };
}

export function SettingsClient({ initial }: Props) {
  const [pinState, pinAction, pinPending] = useActionState<SettingsFormState, FormData>(
    changePinAction,
    {}
  );
  const [constState, constAction, constPending] = useActionState<SettingsFormState, FormData>(
    updateConstantsAction,
    {}
  );
  const [teamPinState, teamPinAction, teamPinPending] = useActionState<SettingsFormState, FormData>(
    setTeamPinAction,
    {}
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (pinState.ok) toast.success("PIN updated");
    else if (pinState.error) toast.error(pinState.error);
  }, [pinState]);

  useEffect(() => {
    if (constState.ok) toast.success("Constants updated");
    else if (constState.error) toast.error(constState.error);
  }, [constState]);

  useEffect(() => {
    if (teamPinState.ok) toast.success("Team PIN updated");
    else if (teamPinState.error) toast.error(teamPinState.error);
  }, [teamPinState]);

  const onLock = () => {
    if (!confirm("Lock the app and require PIN re-entry?")) return;
    startTransition(async () => {
      await lockAction();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">PIN, constants, and backup.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change PIN</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={pinAction} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input name="currentPin" type="password" placeholder="Current PIN" required />
            <Input name="newPin" type="password" placeholder="New PIN (4–12 digits)" required />
            <Input name="confirmPin" type="password" placeholder="Confirm new PIN" required />
            <Button type="submit" className="sm:col-span-3" disabled={pinPending}>
              {pinPending ? "Updating…" : "Update PIN"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Constants</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={constAction} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Base %</label>
              <Input
                name="basePercent"
                type="number"
                step="any"
                defaultValue={initial.basePercent}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Default target bonus %</label>
              <Input
                name="defaultBonusPercent"
                type="number"
                step="any"
                defaultValue={initial.defaultBonusPercent}
                required
              />
            </div>
            <Button
              type="submit"
              className="self-end sm:col-span-1"
              disabled={constPending}
            >
              {constPending ? "Saving…" : "Save"}
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Base % is what the engine uses for the &quot;always-on&quot; per-phone incentive (default 4%).
            Default bonus % is pre-filled when adding a new Target Bonus policy.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Database backups are now managed by Supabase (automatic, off-site). Use the Supabase
            dashboard to download a snapshot if you need one.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <History className="-mt-0.5 mr-1 inline size-4" />
            Activity log housekeeping
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PurgeAuditForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" />
            Team Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Set a separate PIN for team members. They can access{" "}
            <Link href="/team/dashboard" className="underline underline-offset-2">
              Team View
            </Link>{" "}
            which includes Dashboard, Activations, Inventory, and Cross-Region.
          </p>
          <form action={teamPinAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              name="newTeamPin"
              type="password"
              placeholder="New team PIN (4–12 digits)"
              required
              disabled={teamPinPending}
            />
            <Input
              name="confirmTeamPin"
              type="password"
              placeholder="Confirm team PIN"
              required
              disabled={teamPinPending}
            />
            <Button type="submit" className="sm:col-span-2" disabled={teamPinPending}>
              {teamPinPending ? "Saving…" : "Set Team PIN"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={onLock}>
            <Lock className="size-4" />
            Lock app
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function PurgeAuditForm() {
  const [days, setDays] = useState("90");
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Delete entries older than (days)</label>
        <Input
          type="number"
          min={1}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className="w-40"
        />
      </div>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          const n = Number(days);
          if (!confirm(`Permanently delete activity log entries older than ${n} days?`)) return;
          startTransition(async () => {
            const r = await purgeAuditLogAction(n);
            if (r.ok) toast.success(`Deleted ${r.deleted} entries`);
            else toast.error(r.error ?? "Purge failed");
          });
        }}
      >
        {pending ? "Purging…" : "Purge"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Activity is unbounded by default; trim it occasionally if it grows large.
      </p>
    </div>
  );
}
