"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { adminLoginAction, adminSetupAction, type LoginState } from "./actions";
import { Eye, EyeOff } from "lucide-react";

const INITIAL: LoginState = {};

function PasswordInput({ id = "password", name = "password", placeholder = "••••••••", autoComplete = "current-password", disabled }: {
  id?: string; name?: string; placeholder?: string; autoComplete?: string; disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} disabled={disabled} placeholder={placeholder} className="pr-10" />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} tabIndex={-1}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminLoginAction, INITIAL);
  const [email, setEmail] = useState("");
  return (
    <form action={formAction}>
      <div className="rounded-xl border bg-card space-y-5 p-6">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="email">Email</label>
          <Input id="email" name="email" type="email" autoComplete="email" autoFocus disabled={pending}
            value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="password">Password</label>
          <PasswordInput disabled={pending} />
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
          <PasswordInput id="password" autoComplete="new-password" placeholder="Min 8 characters" disabled={pending} />
          {state.fieldErrors?.password && <p className="text-xs text-destructive">{state.fieldErrors.password}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="confirm">Confirm password</label>
          <PasswordInput id="confirm" name="confirm" autoComplete="new-password" disabled={pending} />
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
