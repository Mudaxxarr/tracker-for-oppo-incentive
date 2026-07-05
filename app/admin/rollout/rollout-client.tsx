"use client";

import { useActionState, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { setFeatureRolloutAction, broadcastTrialAction, type RolloutActionState, type BroadcastTrialState } from "./actions";
import { PREVIEW_CATALOG, BADGE_LABEL, BADGE_COLOR } from "@/lib/dealer-previews";
import { ALL_FEATURE_KEYS, DEALER_FEATURE_LABELS } from "@/lib/dealer-features";
import { DEALER_ADDONS } from "@/lib/dealer-addons";
import type { TenantFeatureRow } from "@/lib/admin/dealers";
import { FlaskConical, Rocket, Undo2, Sparkles, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const CANARY_LS_KEY = "oppo_rollout_canary";

interface FlagRow {
  key: string;
  label: string;
  isAddon: boolean;
}

const FLAG_ROWS: FlagRow[] = [
  ...ALL_FEATURE_KEYS.map((k) => ({ key: k as string, label: DEALER_FEATURE_LABELS[k], isAddon: false })),
  ...DEALER_ADDONS.map((a) => ({ key: a.key as string, label: `${a.label} (add-on)`, isAddon: true })),
];

export function RolloutClient({ tenants }: { tenants: TenantFeatureRow[] }) {
  const [state, action, pending] = useActionState<RolloutActionState, FormData>(
    setFeatureRolloutAction,
    {},
  );
  const [broadcastState, broadcastAction, broadcastPending] = useActionState<BroadcastTrialState, FormData>(
    broadcastTrialAction,
    {},
  );
  const [canaryId, setCanaryId] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CANARY_LS_KEY);
      if (saved && tenants.some((t) => t.id === saved)) setCanaryId(saved);
    } catch { /* ignore */ }
  }, [tenants]);

  const pickCanary = (id: string) => {
    setCanaryId(id);
    try { localStorage.setItem(CANARY_LS_KEY, id); } catch { /* ignore */ }
  };

  const canary = tenants.find((t) => t.id === canaryId) ?? null;
  const total = tenants.length;

  const enabledFor = (key: string) =>
    tenants.filter((t) => (t.features as Record<string, boolean | undefined>)[key] === true);

  const stageBadge = (n: number, canaryOn: boolean) => {
    if (n === 0) return <Badge variant="outline">Off</Badge>;
    if (n === total) return <Badge>Live</Badge>;
    if (n === 1 && canaryOn) return <Badge variant="secondary">Canary</Badge>;
    return <Badge variant="secondary">Partial</Badge>;
  };

  const confirmAll = (e: React.FormEvent<HTMLFormElement>, msg: string) => {
    if (!window.confirm(msg)) e.preventDefault();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Staged Rollout</h1>
        <p className="text-sm text-muted-foreground">
          Ship a feature to one tenant first, verify it in the dealer portal, then release it everywhere. One click rolls it back.
        </p>
      </div>

      {/* The three stages: a real sequence, in order */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FlaskConical className="size-4 text-muted-foreground" />
            1 · Canary
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Enable the flag for your canary tenant only. No other dealer sees anything.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Rocket className="size-4 text-muted-foreground" />
            2 · Verify, then go live
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Open the canary&apos;s portal via Enter Portal on its dealer page. Happy? Enable for all.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Undo2 className="size-4 text-muted-foreground" />
            3 · Rollback anytime
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Disable for all turns the feature off everywhere instantly. Code stays deployed; nobody sees it.
          </p>
        </div>
      </div>

      {/* Canary tenant */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Canary tenant</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <select
            value={canaryId}
            onChange={(e) => pickCanary(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">— pick a tenant —</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.businessName} ({t.status})
              </option>
            ))}
          </select>
          {canary ? (
            <span className="text-sm text-muted-foreground">
              Canary buttons below act on <span className="font-medium text-foreground">{canary.businessName}</span>.
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              Tip: create a test tenant for yourself and pick it here. It remembers your choice.
            </span>
          )}
        </CardContent>
      </Card>

      {/* Flag matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Features &amp; add-ons ({total} tenants)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {FLAG_ROWS.map((f) => {
                  const enabled = enabledFor(f.key);
                  const canaryOn =
                    canary != null &&
                    (canary.features as Record<string, boolean | undefined>)[f.key] === true;
                  return (
                    <TableRow key={f.key}>
                      <TableCell>
                        <span className="text-sm font-medium">{f.label}</span>
                        <span className="ml-2 font-mono text-[11px] text-muted-foreground">{f.key}</span>
                      </TableCell>
                      <TableCell label="Stage">{stageBadge(enabled.length, canaryOn)}</TableCell>
                      <TableCell label="Enabled" className="text-right font-mono text-sm tabular-nums">
                        {enabled.length} / {total}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <form action={action}>
                            <input type="hidden" name="featureKey" value={f.key} />
                            <input type="hidden" name="scope" value="one" />
                            <input type="hidden" name="tenantId" value={canaryId} />
                            <input type="hidden" name="enable" value={canaryOn ? "false" : "true"} />
                            <Button size="sm" variant="outline" type="submit" disabled={pending || !canaryId}>
                              {canaryOn ? "Canary off" : "Canary on"}
                            </Button>
                          </form>
                          <form
                            action={action}
                            onSubmit={(e) => confirmAll(e, `Enable "${f.label}" for ALL active tenants?`)}
                          >
                            <input type="hidden" name="featureKey" value={f.key} />
                            <input type="hidden" name="scope" value="all" />
                            <input type="hidden" name="enable" value="true" />
                            <Button size="sm" variant="outline" type="submit" disabled={pending || enabled.length === total}>
                              Enable all
                            </Button>
                          </form>
                          <form
                            action={action}
                            onSubmit={(e) => confirmAll(e, `Disable "${f.label}" for ALL tenants? Dealers lose access immediately.`)}
                          >
                            <input type="hidden" name="featureKey" value={f.key} />
                            <input type="hidden" name="scope" value="all" />
                            <input type="hidden" name="enable" value="false" />
                            <Button size="sm" variant="ghost" type="submit" disabled={pending || enabled.length === 0}>
                              Disable all
                            </Button>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {state.error && <p className="px-4 py-3 text-sm text-destructive">{state.error}</p>}
        </CardContent>
      </Card>

      {/* Trial Broadcast */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Radio className="size-4 text-primary" />
            <CardTitle className="text-base">Trial Broadcast</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Grant a time-limited trial to all active dealers at once. They see it in their &quot;What&apos;s New&quot; page.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Trial</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PREVIEW_CATALOG.map((preview) => (
                  <TableRow key={preview.key}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", BADGE_COLOR[preview.badge])}>
                          {BADGE_LABEL[preview.badge]}
                        </span>
                        <span className="text-sm font-medium">{preview.label}</span>
                      </div>
                    </TableCell>
                    <TableCell label="Trial">
                      <span className="text-xs text-muted-foreground">{preview.trialDays}d free</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        <form action={broadcastAction}>
                          <input type="hidden" name="previewKey" value={preview.key} />
                          <input type="hidden" name="action" value="grant" />
                          <Button size="sm" variant="default" type="submit" disabled={broadcastPending} className="gap-1.5">
                            <Sparkles className="size-3" />
                            Broadcast {preview.trialDays}d Trial
                          </Button>
                        </form>
                        <form action={broadcastAction}>
                          <input type="hidden" name="previewKey" value={preview.key} />
                          <input type="hidden" name="action" value="revoke" />
                          <Button size="sm" variant="ghost" type="submit" disabled={broadcastPending}>
                            Revoke All
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {broadcastState.error && <p className="px-4 py-3 text-sm text-destructive">{broadcastState.error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
