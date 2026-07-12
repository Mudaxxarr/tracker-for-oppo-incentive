"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { adminLoginAction, adminSetupAction, type LoginState } from "./actions";

const INITIAL: LoginState = {};

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminLoginAction, INITIAL);
  return (
    <form action={formAction}>
      <div className="rounded-xl border bg-card space-y-5 p-6">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="email">Email</label>
          <Input id="email" name="email" type="email" autoComplete="email" autoFocus disabled={pending} placeholder="admin@example.com" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="password">Password</label>
          <Input id="password" name="password" type="password" autoComplete="current-password" disabled={pending} placeholder="••••••••" />
        </div>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Dealer / Accountant? <a href="/dealer/login" className="font-medium text-primary underline underline-offset-2">Sign in here →</a>
        </p>
      </div>
    </form>
  );
}

export function AdminSetupForm() {
  const [state, formAction, pending] = useActionState(adminSetupAction, INITIAL);
  return (
    <form action={formAction}>
      <div className="rounded-xl border bg-card space-y-5 p-6">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="email">Email</label>
          <Input id="email" name="email" type="email" autoComplete="email" autoFocus disabled={pending} placeholder="admin@example.com" />
          {state.fieldErrors?.email && <p className="text-xs text-destructive">{state.fieldErrors.email}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="password">Password</label>
          <Input id="password" name="password" type="password" autoComplete="new-password" disabled={pending} placeholder="Min 8 characters" />
          {state.fieldErrors?.password && <p className="text-xs text-destructive">{state.fieldErrors.password}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="confirm">Confirm password</label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" disabled={pending} placeholder="••••••••" />
          {state.fieldErrors?.confirm && <p className="text-xs text-destructive">{state.fieldErrors.confirm}</p>}
        </div>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </div>
    </form>
  );
}
