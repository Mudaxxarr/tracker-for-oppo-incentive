"use client";

import { useActionState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { teamUnlockAction, type TeamUnlockState } from "./actions";
import { Users } from "lucide-react";

export function TeamUnlockForm() {
  const [state, formAction, pending] = useActionState<TeamUnlockState, FormData>(
    teamUnlockAction,
    {}
  );

  return (
    <form action={formAction}>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" />
            Team Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="text-sm font-medium" htmlFor="pin">
            Team PIN
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
            {pending ? "Unlocking…" : "Enter Team View"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
