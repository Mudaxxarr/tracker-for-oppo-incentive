"use client";

import { useActionState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { unlockAction, type UnlockState } from "./actions";
import { LockKeyhole } from "lucide-react";

export function UnlockForm() {
  const [state, formAction, pending] = useActionState<UnlockState, FormData>(
    unlockAction,
    {}
  );

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LockKeyhole className="size-4" />
            Unlock
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="text-sm font-medium" htmlFor="pin">
            PIN
          </label>
          <Input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={12}
            placeholder="••••••"
            disabled={pending}
          />
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Unlocking…" : "Unlock"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
