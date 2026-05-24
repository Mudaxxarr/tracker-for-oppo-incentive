"use client";

import { useActionState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LogIn, ShieldCheck } from "lucide-react";
import { adminLoginAction, adminSetupAction, type LoginState } from "./actions";

const INITIAL: LoginState = {};

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminLoginAction, INITIAL);
  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LogIn className="size-4" />
            Admin Login
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="email">Email</label>
            <Input id="email" name="email" type="email" autoComplete="email" autoFocus disabled={pending} placeholder="admin@example.com" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="password">Password</label>
            <Input id="password" name="password" type="password" autoComplete="current-password" disabled={pending} placeholder="••••••••" />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

export function AdminSetupForm() {
  const [state, formAction, pending] = useActionState(adminSetupAction, INITIAL);
  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" />
            Create Admin Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Set up your admin credentials. This only happens once.</p>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="email">Email</label>
            <Input id="email" name="email" type="email" autoComplete="email" autoFocus disabled={pending} placeholder="admin@example.com" />
            {state.fieldErrors?.email && <p className="text-xs text-destructive">{state.fieldErrors.email}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="password">Password</label>
            <Input id="password" name="password" type="password" autoComplete="new-password" disabled={pending} placeholder="Min 8 characters" />
            {state.fieldErrors?.password && <p className="text-xs text-destructive">{state.fieldErrors.password}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="confirm">Confirm Password</label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" disabled={pending} placeholder="••••••••" />
            {state.fieldErrors?.confirm && <p className="text-xs text-destructive">{state.fieldErrors.confirm}</p>}
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating account…" : "Create account & sign in"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
