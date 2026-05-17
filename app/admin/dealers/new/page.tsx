"use client";

import { useActionState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { createTenantAction, type CreateTenantState } from "./actions";
import { cn } from "@/lib/utils";
import { Copy, Mail } from "lucide-react";
import Link from "next/link";

export default function NewDealerPage() {
  const [state, formAction, pending] = useActionState<CreateTenantState, FormData>(
    createTenantAction,
    {},
  );

  if (state.credentials) {
    const c = state.credentials;
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Dealer Created</h1>
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="text-base text-green-800 dark:text-green-200">
              Credentials — share these once, they will not be shown again
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <CredRow label="Email" value={c.adminEmail} />
            <CredRow label="Temp Password" value={c.tempPassword} mono />
          </CardContent>
          <CardFooter className="flex gap-2">
            <a href={c.mailtoLink} className={cn(buttonVariants({ size: "sm" }))}>
              <Mail className="mr-1 size-4" />
              Open in Mail
            </a>
            <Link href="/admin/dealers" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Back to dealers</Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">New Dealer Account</h1>
      <form action={formAction} className="max-w-md">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Field id="businessName" label="Business Name" placeholder="Al-Hassan Electronics" />
            <Field id="ownerEmail" label="Owner Email" type="email" placeholder="owner@example.com" />
            <Field
              id="adminEmail"
              label="Admin Login Email"
              type="email"
              placeholder="admin@example.com"
            />
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="planMonths">
                Plan Duration (months)
              </label>
              <Input
                id="planMonths"
                name="planMonths"
                type="number"
                min={1}
                max={60}
                defaultValue={12}
                disabled={pending}
              />
            </div>
            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create Account"}
            </Button>
            <Link href="/admin/dealers" className={cn(buttonVariants({ variant: "outline" }))}>Cancel</Link>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  type = "text",
  placeholder,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <Input id={id} name={id} type={type} placeholder={placeholder} required />
    </div>
  );
}

function CredRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
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
