"use client";

import { useActionState, useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loginAction, type LoginState } from "./actions";
import { LogIn, Eye, EyeOff } from "lucide-react";

export function LoginForm({ hideAdminLink = false }: { hideAdminLink?: boolean }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );
  // Controlled so a wrong-password submit doesn't wipe the Login ID (React resets
  // uncontrolled fields after a form action).
  const [loginId, setLoginId] = useState("");
  const [showPass, setShowPass] = useState(false);

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
              Login ID
            </label>
            <Input
              id="dealerId"
              name="dealerId"
              type="text"
              autoComplete="username"
              autoFocus
              disabled={pending}
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="the login ID or email your admin gave you"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPass ? "text" : "password"}
                autoComplete="current-password"
                disabled={pending}
                placeholder="••••••••"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
                tabIndex={-1}
              >
                {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <strong>Main dealer:</strong> use the Login ID your admin gave you. <strong>Accountant:</strong> use the email &amp; password your main dealer created for you (Team page).
          </p>
          {!hideAdminLink && (
            <p className="text-center text-xs text-muted-foreground">
              Owner / Admin? <a href="/login" className="font-medium text-primary underline underline-offset-2">Sign in here →</a>
            </p>
          )}
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
