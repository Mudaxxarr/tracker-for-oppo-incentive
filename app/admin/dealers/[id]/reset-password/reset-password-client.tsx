"use client";

import { useActionState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { resetPasswordAction, type ResetPasswordState } from "./actions";
import { Copy, Mail } from "lucide-react";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface Props {
  tenantId: string;
  businessName: string;
  users: User[];
}

export function ResetPasswordClient({ tenantId, businessName, users }: Props) {
  const [state, formAction, pending] = useActionState<ResetPasswordState, FormData>(
    resetPasswordAction,
    {},
  );

  if (state.credentials) {
    const c = state.credentials;
    const subject = encodeURIComponent("Your OPPO Tracker Password Reset");
    const body = encodeURIComponent(
      `Your dealer portal password has been reset.\n\nEmail: ${c.email}\nNew Password: ${c.tempPassword}\n\nPlease log in and change your password.`,
    );
    const mailtoLink = `mailto:${c.email}?subject=${subject}&body=${body}`;

    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Password Reset — {businessName}</h1>
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="text-base text-green-800 dark:text-green-200">
              New credentials — share these once
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <CredRow label="Dealer Login ID" value={c.email} />
            <CredRow label="New Password" value={c.tempPassword} mono />
          </CardContent>
          <CardFooter className="flex gap-2">
            <a href={mailtoLink} className={cn(buttonVariants({ size: "sm" }))}>
              <Mail className="mr-1 size-4" />
              Open in Mail
            </a>
            <Link
              href={`/admin/dealers/${tenantId}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Back to dealer
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Reset Password — {businessName}</h1>
      <p className="text-sm text-muted-foreground">
        Select a user to generate a new temporary password.
      </p>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="space-y-2 max-w-lg">
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium">{u.email}</p>
              <p className="text-xs text-muted-foreground">
                {u.role} &middot; {u.isActive ? "Active" : "Inactive"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role}</Badge>
              <form action={formAction}>
                <input type="hidden" name="userId" value={u.id} />
                <Button type="submit" variant="outline" size="sm" disabled={pending}>
                  Reset Password
                </Button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <Link
        href={`/admin/dealers/${tenantId}`}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
      >
        Back
      </Link>
    </div>
  );
}

function CredRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  function copy() {
    navigator.clipboard.writeText(value).catch(() => {});
  }
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span className={mono ? "font-mono" : ""}>{value}</span>
      <button type="button" onClick={copy} className="text-muted-foreground hover:text-foreground">
        <Copy className="size-3.5" />
      </button>
    </div>
  );
}
