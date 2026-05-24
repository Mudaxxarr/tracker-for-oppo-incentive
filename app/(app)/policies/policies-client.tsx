"use client";

import { useActionState, useEffect, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPKR } from "@/lib/format";
import {
  createActivationIncentiveAction,
  createDealerIncentiveAction,
  createStockInAction,
  createTargetBonusAction,
  deletePolicyAction,
  updateTargetBonusAction,
  updateStockInAction,
  updateActivationIncentiveAction,
  updateDealerIncentiveAction,
  type PolicyFormState,
} from "./actions";
import { Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import type {
  ActivationIncentivePolicyRow,
  StockInPolicyRow,
  DealerIncentivePolicyRow,
} from "@/lib/db/queries/policies";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";

export interface PolicyAchievements {
  targetBonus: Record<string, number>;
  stockIn: Record<string, number>;
  activationIncentive: Record<string, number>;
  dealerIncentive: Record<string, number>;
}

interface TargetBonusRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  targetActivationsQty: number;
  bonusPercent: number;
}

interface Props {
  models: ModelWithCurrentPrice[];
  targetBonus: TargetBonusRow[];
  stockIn: StockInPolicyRow[];
  activationIncentive: ActivationIncentivePolicyRow[];
  dealerIncentive: DealerIncentivePolicyRow[];
  achievements: PolicyAchievements;
  hasDealer: boolean;
}

function isLive(start: string, end: string) {
  const today = new Date().toISOString().slice(0, 10);
  return start <= today && today <= end;
}

// ---- Progress helpers ----
function tierColor(pct: number) {
  if (pct >= 90) return { fill: "#22c55e", bg: "rgba(34,197,94,0.15)", text: "text-green-600 dark:text-green-400" };
  if (pct >= 70) return { fill: "#84cc16", bg: "rgba(132,204,22,0.15)", text: "text-lime-600 dark:text-lime-400" };
  if (pct >= 40) return { fill: "#f97316", bg: "rgba(249,115,22,0.15)", text: "text-orange-500 dark:text-orange-400" };
  return { fill: "#ef4444", bg: "rgba(239,68,68,0.15)", text: "text-red-500 dark:text-red-400" };
}

function MiniProgress({ current, target }: { current: number; target: number }) {
  const pct = Math.min(100, target > 0 ? (current / target) * 100 : 0);
  const { fill, bg, text } = tierColor(pct);
  return (
    <div className="space-y-0.5 min-w-[120px]">
      <div className="relative h-1.5 overflow-hidden rounded-full" style={{ background: bg }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: fill }}
        />
      </div>
      <p className={`text-[11px] font-medium tabular-nums ${text}`}>
        {current} / {target} <span className="opacity-70">({Math.round(pct)}%)</span>
      </p>
    </div>
  );
}

function AchievementBadge({ count, label }: { count: number; label: string }) {
  return (
    <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
      {count} {label}
    </span>
  );
}

// ---- Main client ----
export function PoliciesClient(props: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editId, setEditId] = useState<string | null>(null);

  const onDelete = (
    type: "target-bonus" | "stock-in" | "activation-incentive" | "dealer-incentive",
    id: string,
    label: string
  ) => {
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deletePolicyAction(type, id);
        toast.success("Policy deleted");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  };

  const onEditDone = () => { setEditId(null); router.refresh(); };

  if (!props.hasDealer) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Policies</h1>
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Create a Dealer ID first to manage policies.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { achievements } = props;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Policies</h1>
        <p className="text-sm text-muted-foreground">
          Set incentive rules from OPPO HQ that the engine applies to your activations and purchases.
        </p>
      </div>

      <Tabs defaultValue="target-bonus">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="target-bonus">Target Bonus (1%)</TabsTrigger>
          <TabsTrigger value="stock-in">Stock-In</TabsTrigger>
          <TabsTrigger value="activation-incentive">Activation</TabsTrigger>
          <TabsTrigger value="dealer-incentive">Dealer</TabsTrigger>
        </TabsList>

        {/* ------ Target Bonus ------ */}
        <TabsContent value="target-bonus" className="space-y-4 pt-4">
          <PolicyCard title="Add Target Bonus">
            <TargetBonusForm onSuccess={() => { toast.success("Target bonus added"); router.refresh(); }} />
          </PolicyCard>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Target purchase qty</TableHead>
                    <TableHead className="text-right">Bonus %</TableHead>
                    <TableHead>Purchased</TableHead>
                    <TableHead></TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.targetBonus.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        No target-bonus policies yet.
                      </TableCell>
                    </TableRow>
                  ) : props.targetBonus.map((p) => {
                    const count = achievements.targetBonus[p.id] ?? 0;
                    if (editId === p.id) {
                      return <EditTargetBonusRow key={p.id} policy={p} onDone={onEditDone} onCancel={() => setEditId(null)} />;
                    }
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.periodStart)} → {formatDate(p.periodEnd)}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.targetActivationsQty}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.bonusPercent}%</TableCell>
                        <TableCell>
                          <MiniProgress current={count} target={p.targetActivationsQty} />
                        </TableCell>
                        <TableCell>
                          {isLive(p.periodStart, p.periodEnd)
                            ? <Badge>Live</Badge>
                            : <Badge variant="secondary">Expired</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setEditId(p.id)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => onDelete("target-bonus", p.id, "this target bonus policy")}>
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------ Stock-In ------ */}
        <TabsContent value="stock-in" className="space-y-4 pt-4">
          <PolicyCard title="Add Stock-In policy">
            <StockInForm models={props.models} onSuccess={() => { toast.success("Stock-In policy added"); router.refresh(); }} />
          </PolicyCard>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Per unit ₨</TableHead>
                    <TableHead className="text-right">Min qty</TableHead>
                    <TableHead>Purchased</TableHead>
                    <TableHead></TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.stockIn.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        No stock-in policies yet.
                      </TableCell>
                    </TableRow>
                  ) : props.stockIn.map((p) => {
                    const count = achievements.stockIn[p.id] ?? 0;
                    const minQ = p.minQty ?? null;
                    if (editId === p.id) {
                      return <EditStockInRow key={p.id} policy={p} onDone={onEditDone} onCancel={() => setEditId(null)} />;
                    }
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.modelName}</TableCell>
                        <TableCell>{formatDate(p.periodStart)} → {formatDate(p.periodEnd)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPKR(p.perUnitAmount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{minQ ?? "—"}</TableCell>
                        <TableCell>
                          {minQ != null
                            ? <MiniProgress current={count} target={minQ} />
                            : <AchievementBadge count={count} label="units" />}
                        </TableCell>
                        <TableCell>
                          {isLive(p.periodStart, p.periodEnd)
                            ? <Badge>Live</Badge>
                            : <Badge variant="secondary">Expired</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setEditId(p.id)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => onDelete("stock-in", p.id, `stock-in for ${p.modelName}`)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------ Activation Incentive ------ */}
        <TabsContent value="activation-incentive" className="space-y-4 pt-4">
          <PolicyCard title="Add Activation Incentive">
            <ActivationIncentiveForm models={props.models} onSuccess={() => { toast.success("Activation incentive added"); router.refresh(); }} />
          </PolicyCard>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Per unit ₨</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead>Achievement</TableHead>
                    <TableHead></TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.activationIncentive.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        No activation incentives yet.
                      </TableCell>
                    </TableRow>
                  ) : props.activationIncentive.map((p) => {
                    const count = achievements.activationIncentive[p.id] ?? 0;
                    if (editId === p.id) {
                      return <EditActivationIncentiveRow key={p.id} policy={p} onDone={onEditDone} onCancel={() => setEditId(null)} />;
                    }
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.modelName}</TableCell>
                        <TableCell>{formatDate(p.periodStart)} → {formatDate(p.periodEnd)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPKR(p.perUnitAmount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.targetQty ?? "—"}</TableCell>
                        <TableCell>
                          {p.targetQty != null
                            ? <MiniProgress current={count} target={p.targetQty} />
                            : <AchievementBadge count={count} label="activated" />}
                        </TableCell>
                        <TableCell>
                          {isLive(p.periodStart, p.periodEnd)
                            ? <Badge>Live</Badge>
                            : <Badge variant="secondary">Expired</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setEditId(p.id)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => onDelete("activation-incentive", p.id, `activation incentive for ${p.modelName}`)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------ Dealer Incentive ------ */}
        <TabsContent value="dealer-incentive" className="space-y-4 pt-4">
          <PolicyCard title="Add Dealer Incentive">
            <DealerIncentiveForm models={props.models} onSuccess={() => { toast.success("Dealer incentive added"); router.refresh(); }} />
          </PolicyCard>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Target qty</TableHead>
                    <TableHead className="text-right">Per unit ₨</TableHead>
                    <TableHead>Achievement</TableHead>
                    <TableHead></TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {props.dealerIncentive.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        No dealer-incentive policies yet.
                      </TableCell>
                    </TableRow>
                  ) : props.dealerIncentive.map((p) => {
                    const count = achievements.dealerIncentive[p.id] ?? 0;
                    if (editId === p.id) {
                      return <EditDealerIncentiveRow key={p.id} policy={p} onDone={onEditDone} onCancel={() => setEditId(null)} />;
                    }
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {p.modelName ?? <span className="text-xs text-muted-foreground">All models</span>}
                        </TableCell>
                        <TableCell>{formatDate(p.periodStart)} → {formatDate(p.periodEnd)}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.targetTotalActivations}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPKR(p.perUnitAmount)}</TableCell>
                        <TableCell>
                          <MiniProgress current={count} target={p.targetTotalActivations} />
                        </TableCell>
                        <TableCell>
                          {isLive(p.periodStart, p.periodEnd)
                            ? <Badge>Live</Badge>
                            : <Badge variant="secondary">Expired</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setEditId(p.id)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => onDelete("dealer-incentive", p.id, "this dealer-incentive policy")}>
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PolicyCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function MonthDefaults() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

function ModelSelect({
  models,
  value,
  onChange,
  required,
  placeholder = "Choose model…",
}: {
  models: ModelWithCurrentPrice[];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const selected = models.find((m) => m.id === value);
  return (
    <Select value={value} onValueChange={(v) => typeof v === "string" && onChange(v)}>
      <SelectTrigger className="w-full" aria-required={required}>
        <span className={selected ? "" : "text-muted-foreground"}>
          {selected?.name ?? placeholder}
        </span>
      </SelectTrigger>
      <SelectContent>
        {models.map((m) => (
          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TargetBonusForm({ onSuccess }: { onSuccess?: () => void }) {
  const [state, action, pending] = useActionState<PolicyFormState, FormData>(createTargetBonusAction, {});
  const { start, end } = MonthDefaults();
  useEffect(() => {
    if (state.ok) onSuccess?.();
    else if (state.error) toast.error(state.error);
  }, [state, onSuccess]);
  return (
    <form action={action} className="space-y-3">
      <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-400">
        <strong>How it works:</strong> Once your <strong>regular purchases</strong> in the period meet the target qty, you earn the bonus % on <strong>all activations</strong> that month — calculated the same way as the base 4%.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Period start</label>
          <Input name="periodStart" type="date" defaultValue={start} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Period end</label>
          <Input name="periodEnd" type="date" defaultValue={end} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Target purchase qty</label>
          <Input name="targetActivationsQty" type="number" min={1} placeholder="e.g. 100" required />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Bonus %</label>
          <Input name="bonusPercent" type="number" step="any" min={0} defaultValue={1} placeholder="1" required />
        </div>
        <Button type="submit" className="sm:col-span-4" disabled={pending}>
          {pending ? "Saving…" : "Add Target Bonus"}
        </Button>
      </div>
    </form>
  );
}

function StockInForm({ models, onSuccess }: { models: ModelWithCurrentPrice[]; onSuccess?: () => void }) {
  const [state, action, pending] = useActionState<PolicyFormState, FormData>(createStockInAction, {});
  const [modelId, setModelId] = useState("");
  const { start, end } = MonthDefaults();
  useEffect(() => {
    if (state.ok) { setModelId(""); onSuccess?.(); }
    else if (state.error) toast.error(state.error);
  }, [state, onSuccess]);
  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
      <input type="hidden" name="modelId" value={modelId} />
      <div className="sm:col-span-2">
        <ModelSelect models={models} value={modelId} onChange={setModelId} required />
      </div>
      <Input name="periodStart" type="date" defaultValue={start} required />
      <Input name="periodEnd" type="date" defaultValue={end} required />
      <Input name="perUnitAmount" type="number" step="any" min={0} placeholder="Per unit ₨" required />
      <Input name="minQty" type="number" min={1} placeholder="Min qty (required)" required />
      <Button type="submit" className="sm:col-span-5" disabled={pending || !modelId}>
        {pending ? "Saving…" : "Add Stock-In"}
      </Button>
    </form>
  );
}

function ActivationIncentiveForm({ models, onSuccess }: { models: ModelWithCurrentPrice[]; onSuccess?: () => void }) {
  const [state, action, pending] = useActionState<PolicyFormState, FormData>(createActivationIncentiveAction, {});
  const [modelId, setModelId] = useState("");
  const { start, end } = MonthDefaults();
  useEffect(() => {
    if (state.ok) { setModelId(""); onSuccess?.(); }
    else if (state.error) toast.error(state.error);
  }, [state, onSuccess]);
  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
      <input type="hidden" name="modelId" value={modelId} />
      <div className="sm:col-span-2">
        <ModelSelect models={models} value={modelId} onChange={setModelId} required />
      </div>
      <Input name="periodStart" type="date" defaultValue={start} required />
      <Input name="periodEnd" type="date" defaultValue={end} required />
      <Input name="perUnitAmount" type="number" step="any" min={0} placeholder="Per unit ₨" required />
      <Input name="targetQty" type="number" min={1} placeholder="Target qty (required)" required />
      <Button type="submit" className="sm:col-span-5" disabled={pending || !modelId}>
        {pending ? "Saving…" : "Add Activation Incentive"}
      </Button>
    </form>
  );
}

// ---- Edit row components ----

function EditTargetBonusRow({ policy, onDone, onCancel }: {
  policy: TargetBonusRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState<PolicyFormState, FormData>(updateTargetBonusAction, {});
  const [periodStart, setPeriodStart] = useState(policy.periodStart);
  const [periodEnd, setPeriodEnd] = useState(policy.periodEnd);
  const [targetQty, setTargetQty] = useState(String(policy.targetActivationsQty));
  const [bonusPercent, setBonusPercent] = useState(String(policy.bonusPercent));
  useEffect(() => {
    if (state.ok) { toast.success("Updated"); onDone(); }
    else if (state.error) toast.error(state.error);
  }, [state, onDone]);
  return (
    <TableRow className="bg-muted/30">
      <TableCell colSpan={6}>
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={policy.id} />
          <Input name="periodStart" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required className="w-36" />
          <Input name="periodEnd" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required className="w-36" />
          <div className="space-y-0.5">
            <label className="text-[10px] text-muted-foreground">Target purchase qty</label>
            <Input name="targetActivationsQty" type="number" min={1} value={targetQty} onChange={(e) => setTargetQty(e.target.value)} required className="w-28" />
          </div>
          <div className="space-y-0.5">
            <label className="text-[10px] text-muted-foreground">Bonus %</label>
            <Input name="bonusPercent" type="number" step="any" min={0} value={bonusPercent} onChange={(e) => setBonusPercent(e.target.value)} required className="w-24" />
          </div>
          <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </form>
      </TableCell>
    </TableRow>
  );
}

function EditStockInRow({ policy, onDone, onCancel }: {
  policy: StockInPolicyRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState<PolicyFormState, FormData>(updateStockInAction, {});
  const [periodStart, setPeriodStart] = useState(policy.periodStart);
  const [periodEnd, setPeriodEnd] = useState(policy.periodEnd);
  const [perUnitAmount, setPerUnitAmount] = useState(String(policy.perUnitAmount));
  const [minQty, setMinQty] = useState(String(policy.minQty ?? ""));
  useEffect(() => {
    if (state.ok) { toast.success("Updated"); onDone(); }
    else if (state.error) toast.error(state.error);
  }, [state, onDone]);
  return (
    <TableRow className="bg-muted/30">
      <TableCell colSpan={7}>
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={policy.id} />
          <input type="hidden" name="modelId" value={policy.modelId} />
          <Input name="periodStart" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required className="w-36" />
          <Input name="periodEnd" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required className="w-36" />
          <Input name="perUnitAmount" type="number" step="any" min={0} value={perUnitAmount} onChange={(e) => setPerUnitAmount(e.target.value)} required className="w-28" placeholder="Per unit ₨" />
          <Input name="minQty" type="number" min={1} value={minQty} onChange={(e) => setMinQty(e.target.value)} required className="w-24" placeholder="Min qty" />
          <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </form>
      </TableCell>
    </TableRow>
  );
}

function EditActivationIncentiveRow({ policy, onDone, onCancel }: {
  policy: ActivationIncentivePolicyRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState<PolicyFormState, FormData>(updateActivationIncentiveAction, {});
  const [periodStart, setPeriodStart] = useState(policy.periodStart);
  const [periodEnd, setPeriodEnd] = useState(policy.periodEnd);
  const [perUnitAmount, setPerUnitAmount] = useState(String(policy.perUnitAmount));
  const [targetQty, setTargetQty] = useState(String(policy.targetQty ?? ""));
  useEffect(() => {
    if (state.ok) { toast.success("Updated"); onDone(); }
    else if (state.error) toast.error(state.error);
  }, [state, onDone]);
  return (
    <TableRow className="bg-muted/30">
      <TableCell colSpan={7}>
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={policy.id} />
          <input type="hidden" name="modelId" value={policy.modelId} />
          <Input name="periodStart" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required className="w-36" />
          <Input name="periodEnd" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required className="w-36" />
          <Input name="perUnitAmount" type="number" step="any" min={0} value={perUnitAmount} onChange={(e) => setPerUnitAmount(e.target.value)} required className="w-28" placeholder="Per unit ₨" />
          <Input name="targetQty" type="number" min={1} value={targetQty} onChange={(e) => setTargetQty(e.target.value)} required className="w-24" placeholder="Target qty" />
          <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </form>
      </TableCell>
    </TableRow>
  );
}

function EditDealerIncentiveRow({ policy, onDone, onCancel }: {
  policy: DealerIncentivePolicyRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState<PolicyFormState, FormData>(updateDealerIncentiveAction, {});
  const [periodStart, setPeriodStart] = useState(policy.periodStart);
  const [periodEnd, setPeriodEnd] = useState(policy.periodEnd);
  const [targetTotal, setTargetTotal] = useState(String(policy.targetTotalActivations));
  const [perUnitAmount, setPerUnitAmount] = useState(String(policy.perUnitAmount));
  useEffect(() => {
    if (state.ok) { toast.success("Updated"); onDone(); }
    else if (state.error) toast.error(state.error);
  }, [state, onDone]);
  return (
    <TableRow className="bg-muted/30">
      <TableCell colSpan={7}>
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={policy.id} />
          <Input name="periodStart" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required className="w-36" />
          <Input name="periodEnd" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required className="w-36" />
          <Input name="targetTotalActivations" type="number" min={1} value={targetTotal} onChange={(e) => setTargetTotal(e.target.value)} required className="w-28" placeholder="Target qty" />
          <Input name="perUnitAmount" type="number" step="any" min={0} value={perUnitAmount} onChange={(e) => setPerUnitAmount(e.target.value)} required className="w-28" placeholder="Per unit ₨" />
          <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </form>
      </TableCell>
    </TableRow>
  );
}

function DealerIncentiveForm({ models, onSuccess }: { models: ModelWithCurrentPrice[]; onSuccess?: () => void }) {
  const [state, action, pending] = useActionState<PolicyFormState, FormData>(createDealerIncentiveAction, {});
  const [modelId, setModelId] = useState("");
  const { start, end } = MonthDefaults();
  useEffect(() => {
    if (state.ok) { setModelId(""); onSuccess?.(); }
    else if (state.error) toast.error(state.error);
  }, [state, onSuccess]);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="modelId" value={modelId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Model (optional — leave blank for global)</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <ModelSelect models={models} value={modelId} onChange={setModelId} placeholder="All models (global)…" />
            </div>
            {modelId ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setModelId("")} className="shrink-0 text-xs">
                Clear
              </Button>
            ) : null}
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Per unit amount ₨</label>
          <Input name="perUnitAmount" type="number" step="any" min={0} placeholder="Amount per unit" required />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Period start</label>
          <Input name="periodStart" type="date" defaultValue={start} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Period end</label>
          <Input name="periodEnd" type="date" defaultValue={end} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Target activations qty</label>
          <Input name="targetTotalActivations" type="number" min={1} placeholder="Target qty" required />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Add Dealer Incentive"}
      </Button>
    </form>
  );
}
