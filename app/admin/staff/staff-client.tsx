"use client";
import { useActionState, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, RefreshCw, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { createStaffAction, resetStaffPasswordAction, toggleStaffActiveAction, deleteStaffAction } from "./actions";

interface StaffRow { id: string; username: string; role: string; isActive: boolean; createdAt: string }
type StaffFormState = { error?: string; tempPassword?: string };

export function StaffClient({ staff }: { staff: StaffRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [createState, createAction, creating] = useActionState<StaffFormState, FormData>(createStaffAction, {});
  const [resetState, resetAction, resetting] = useActionState<StaffFormState, FormData>(resetStaffPasswordAction, {});
  const [showAdd, setShowAdd] = useState(false);
  const [resetId, setResetId] = useState<string | null>(null);

  const onToggle = (id: string, current: boolean) => {
    startTransition(async () => {
      try {
        await toggleStaffActiveAction(id, !current);
        toast.success(current ? "Staff member deactivated" : "Staff member activated");
        router.refresh();
      } catch { toast.error("Failed to update"); }
    });
  };

  const onDelete = (id: string, username: string) => {
    if (!confirm(`Delete staff member "${username}"? They will lose access immediately.`)) return;
    startTransition(async () => {
      try {
        await deleteStaffAction(id);
        toast.success("Staff member deleted");
        router.refresh();
      } catch { toast.error("Failed to delete"); }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Staff Management</h1>
          <p className="text-sm text-muted-foreground">Manage SO and Accountant access to the owner portal.</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>
          <UserPlus className="size-4" />
          Add Staff
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium">Add new staff member</h2>
          <form action={createAction} className="grid gap-3 sm:grid-cols-4">
            <Input name="username" placeholder="Username" required />
            <Input name="password" type="password" placeholder="Password (min 6)" required minLength={6} />
            <select name="role" className="rounded-md border bg-background px-3 py-2 text-sm" required>
              <option value="so">Sales Officer (SO)</option>
              <option value="accountant">Accountant</option>
            </select>
            <Button type="submit" disabled={creating}>{creating ? "Adding…" : "Add"}</Button>
          </form>
          {createState.error && <p className="mt-2 text-sm text-destructive">{createState.error}</p>}
          {createState.tempPassword && (
            <p className="mt-2 rounded-md bg-emerald-50 p-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Created! Temp password: <strong>{createState.tempPassword}</strong>
            </p>
          )}
        </div>
      )}

      {resetId && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium">Reset password</h2>
          <form action={resetAction} className="flex gap-3">
            <input type="hidden" name="staffId" value={resetId} />
            <Button type="submit" variant="destructive" disabled={resetting}>{resetting ? "Resetting…" : "Confirm Reset"}</Button>
            <Button type="button" variant="outline" onClick={() => setResetId(null)}>Cancel</Button>
          </form>
          {resetState.tempPassword && (
            <p className="mt-2 rounded-md bg-amber-50 p-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              New temp password: <strong>{resetState.tempPassword}</strong>
            </p>
          )}
          {resetState.error && <p className="mt-2 text-sm text-destructive">{resetState.error}</p>}
        </div>
      )}

      {staff.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">No staff members yet.</p>
      ) : (
        <div className="space-y-2">
          {staff.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
              <div>
                <p className="text-sm font-medium">{s.username}</p>
                <p className="text-xs text-muted-foreground">Joined {s.createdAt.slice(0, 10)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={s.role === "accountant" ? "default" : "secondary"} className="capitalize">{s.role}</Badge>
                <Badge variant={s.isActive ? "default" : "secondary"}>{s.isActive ? "Active" : "Inactive"}</Badge>
                <Button variant="ghost" size="icon" onClick={() => setResetId(s.id)} title="Reset password">
                  <RefreshCw className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onToggle(s.id, s.isActive)} title={s.isActive ? "Deactivate" : "Activate"}>
                  {s.isActive ? <ToggleRight className="size-4 text-emerald-600" /> : <ToggleLeft className="size-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(s.id, s.username)} title="Delete">
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
