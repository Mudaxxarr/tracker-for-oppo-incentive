"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Trash2, Copy, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createAccountantAction, deleteAccountantAction, type CreateAccountantState } from "./actions";

interface Member {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface Props {
  members: Member[];
  isAdmin: boolean;
}

export function DealerTeamClient({ members, isAdmin }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const accountant = members.find((m) => m.role === "exec") ?? null;

  const onDelete = (id: string) => {
    if (!confirm("Delete this accountant login? They will no longer be able to sign in.")) return;
    startTransition(async () => {
      const res = await deleteAccountantAction(id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Accountant login removed");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="size-5" />
        <h1 className="text-xl font-semibold">Team &amp; Accountant</h1>
      </div>

      {isAdmin && !accountant ? <CreateAccountantCard /> : null}

      <div className="space-y-2">
        {members.map((u) => (
          <div key={u.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{u.email}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {u.role === "admin" ? "Main dealer" : "Accountant"} · joined {u.createdAt.slice(0, 10)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant={u.isActive ? "default" : "secondary"}>{u.isActive ? "Active" : "Inactive"}</Badge>
              {isAdmin && u.role === "exec" ? (
                <Button variant="ghost" size="icon" aria-label="Delete accountant" onClick={() => onDelete(u.id)}>
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 py-4 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            The accountant login can post <strong>purchases &amp; activations</strong> for you, but cannot see
            reports/billing or manage prices, IDs, team or settings. Anything sensitive they do (e.g. Cross-Region
            OUT) shows up as a warning on your Dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateAccountantCard() {
  const router = useRouter();
  const [state, action, pending] = useActionState<CreateAccountantState, FormData>(createAccountantAction, {});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state.error]);

  const copy = async () => {
    if (!state.tempPassword) return;
    try {
      await navigator.clipboard.writeText(`${state.email}\n${state.tempPassword}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  if (state.ok && state.tempPassword) {
    return (
      <Card className="border-primary/40">
        <CardHeader><CardTitle className="text-base">Accountant login created</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Save these now — the password is shown <strong>only once</strong>. Share them with your accountant to sign in at the dealer login.
          </p>
          <div className="space-y-1 rounded-lg border bg-muted/30 p-3 font-mono text-sm">
            <div><span className="text-muted-foreground">Email: </span>{state.email}</div>
            <div><span className="text-muted-foreground">Password: </span><strong>{state.tempPassword}</strong></div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" onClick={() => router.refresh()}>Done</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Create accountant login</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          One accountant login who can post purchases &amp; activations in your place. A one-time password is generated.
        </p>
        <form action={action} className="flex flex-col gap-3 sm:flex-row">
          <Input name="email" type="email" placeholder="accountant@email.com" required className="sm:flex-1" />
          <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create login"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
