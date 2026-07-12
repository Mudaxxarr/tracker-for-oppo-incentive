"use client";

import { useActionState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loginAction, type LoginState } from "./actions";
import { LogIn } from "lucide-react";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LogIn className="size-4" />
            Dealer Login
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="dealerId">
              Email
            </label>
            <Input
              id="dealerId"
              name="dealerId"
              type="email"
              autoComplete="username"
              autoFocus
              disabled={pending}
              placeholder="you@email.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              disabled={pending}
              placeholder="••••••••"
            />
          </div>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Main dealer <strong>and</strong> accountant sign in here with their own email. The accountant login is created by the main dealer under <strong>Team</strong>.
          </p>
          <p className="text-center text-xs text-muted-foreground">
            Owner / Admin? <a href="/login" className="font-medium text-primary underline underline-offset-2">Sign in here →</a>
          </p>
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
