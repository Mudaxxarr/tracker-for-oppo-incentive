"use client";

import { useActionState, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, RefreshCw, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import {
  addTeamMemberAction,
  resetTeamMemberPasswordAction,
  toggleTeamMemberActiveAction,
  deleteTeamMemberAction,
} from "./actions";
import { DEALER_TEAM_LIMIT } from "@/lib/constants";

interface Member { id: string; email: string; role: string; isActive: boolean; createdAt: string }
type AddState = { error?: string; tempPassword?: string; email?: string };

export function TeamClient({ tenantId, members }: { tenantId: string; members: Member[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [addState, addAction, adding] = useActionState<AddState, FormData>(addTeamMemberAction, {});
  const [showAdd, setShowAdd] = useState(false);
  const [resetResult, setResetResult] = useState<{ email: string; tempPassword: string } | null>(null);

  const canAdd = members.length < DEALER_TEAM_LIMIT;

  const onReset = (userId: string) => {
    startTransition(async () => {
      try {
        const result = await resetTeamMemberPasswordAction(userId, tenantId);
        setResetResult(result);
        router.refresh();
      } catch { toast.error("Failed to reset password"); }
    });
  };

  const onToggle = (userId: string, current: boolean) => {
    startTransition(async () => {
      try {
        await toggleTeamMemberActiveAction(userId, !current, tenantId);
        toast.success(current ? "Member deactivated" : "Member activated");
        router.refresh();
      } catch { toast.error("Failed to update"); }
    });
  };

  const onDelete = (userId: string, email: string) => {
    if (!confirm(`Delete "${email}"? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        const result = await deleteTeamMemberAction(userId, tenantId);
        if (!result.ok) { toast.error(result.error ?? "Failed to delete"); return; }
        toast.success("Team member deleted");
        router.refresh();
      } catch { toast.error("Failed to delete"); }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Team Members</h1>
          <p className="text-sm text-muted-foreground">
            {members.length} / {DEALER_TEAM_LIMIT} members used
          </p>
        </div>
        {canAdd && (
          <Button onClick={() => setShowAdd(!showAdd)}>
            <UserPlus className="size-4" />
            Add Exec
          </Button>
        )}
      </div>

      {showAdd && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium">Add Sales Officer (exec)</h2>
          <form action={addAction} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="tenantId" value={tenantId} />
            <Input name="email" type="email" placeholder="Email / username" required />
            <Input name="password" type="password" placeholder="Password (min 6)" required minLength={6} />
            <Button type="submit" disabled={adding}>{adding ? "Adding…" : "Add"}</Button>
          </form>
          {addState.error && <p className="mt-2 text-sm text-destructive">{addState.error}</p>}
          {addState.tempPassword && (
            <p className="mt-2 rounded-md bg-emerald-50 p-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Added <strong>{addState.email}</strong>! Temp password: <strong>{addState.tempPassword}</strong>
            </p>
          )}
        </div>
      )}

      {resetResult && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Password reset for <strong>{resetResult.email}</strong>: <strong>{resetResult.tempPassword}</strong>
          <Button variant="ghost" size="sm" className="ml-2 h-auto p-0 text-amber-700" onClick={() => setResetResult(null)}>Dismiss</Button>
        </div>
      )}

      {members.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">No team members yet.</p>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
              <div>
                <p className="text-sm font-medium">{m.email}</p>
                <p className="text-xs text-muted-foreground">Joined {m.createdAt.slice(0, 10)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={m.role === "admin" ? "default" : "secondary"} className="capitalize">{m.role}</Badge>
                <Badge variant={m.isActive ? "default" : "secondary"}>{m.isActive ? "Active" : "Inactive"}</Badge>
                <Button variant="ghost" size="icon" onClick={() => onReset(m.id)} title="Reset password">
                  <RefreshCw className="size-4" />
                </Button>
                {m.role !== "admin" && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => onToggle(m.id, m.isActive)} title={m.isActive ? "Deactivate" : "Activate"}>
                      {m.isActive ? <ToggleRight className="size-4 text-emerald-600" /> : <ToggleLeft className="size-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(m.id, m.email)} title="Delete">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
