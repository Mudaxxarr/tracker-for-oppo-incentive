"use client";
import { useActionState, useEffect } from "react";
import { staffLoginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function StaffLoginPage() {
  const [state, action, pending] = useActionState(staffLoginAction, {});

  useEffect(() => {
    if (state.success) {
      // Hard reload so the layout re-fetches auth from scratch (bypasses router cache)
      window.location.href = "/dashboard";
    }
  }, [state.success]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">Staff Login</h1>
          <p className="text-sm text-muted-foreground">Alhamd Telecom — OPPO ID Tracker</p>
        </div>
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Username</label>
            <Input name="username" autoComplete="username" required autoFocus />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Password</label>
            <Input name="password" type="password" autoComplete="current-password" required />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending || state.success}>
            {pending || state.success ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          Owner?{" "}
          <a href="/login" className="underline">
            Owner login →
          </a>
        </p>
      </div>
    </div>
  );
}
