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
import { ReliefToggle } from "@/components/feature/relief-toggle";
import { BulkDealerIncentiveForm } from "@/components/feature/bulk-dealer-incentive-form";
import { formatDate, formatPKR } from "@/lib/format";
import {
  createActivationIncentiveAction,
  createDealerIncentiveAction,
  createStockInAction,
  createCombinedStockInAction,
  createTargetBonusAction,
  deletePolicyAction,
  updateTargetBonusAction,
  updateStockInAction,
  updateActivationIncentiveAction,
  updateDealerIncentiveAction,
  type PolicyFormState,
  setPolicyReliefAction,
  bulkCreateDealerIncentivesAction,
} from "./actions";
import { Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import type {
  ActivationIncentivePolicyRow,
  StockInPolicyRow,
  CombinedStockInPolicyRow,
  DealerIncentivePolicyRow,
} from "@/lib/db/queries/policies";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";

export interface PolicyAchievements {
  targetBonus: Record<string, number>;
  stockIn: Record<string, number>;
  combinedStockIn: Record<string, number>;
  activationIncentive: Record<string, number>;
  dealerIncentive: Record<string, number>;
}

interface TargetBonusRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  targetActivationsQty: number;
  bonusPercent: number;
  bonusCapQty: number | null;
  reliefGranted: boolean;
}

interface Props {
  models: ModelWithCurrentPrice[];
  targetBonus: TargetBonusRow[];
  stockIn: StockInPolicyRow[];
  combinedStockIn: CombinedStockInPolicyRow[];
  activationIncentive: ActivationIncentivePolicyRow[];
  dealerIncentive: DealerIncentivePolicyRow[];
  achievements: PolicyAchievements;
  hasDealer: boolean;
}

function isLive(start: string, end: string) {
  const today = new Date().toISOString().slice(0, 10);
  return start <= today && today <= end;
}

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

export function DealerPoliciesClient(props: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editId, setEditId] = useState<string | null>(null);
  const [showCombinedForm, setShowCombinedForm] = useState(false);
  const [showCombinedDI, setShowCombinedDI] = useState(false);

  const onDelete = (
    type: "target-bonus" | "stock-in" | "combined-stock-in" | "activation-incentive" | "dealer-incentive",
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
                        <TableCell label="Target qty" className="text-right tabular-nums">{p.targetActivationsQty}</TableCell>
                        <TableCell label="Bonus %" className="text-right tabular-nums">
                          {p.bonusPercent}%
                          {p.bonusCapQty != null && (
                            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                              (first {p.bonusCapQty})
                            </span>
                          )}
                        </TableCell>
                        <TableCell label="Purchased">
                          <MiniProgress current={count} target={p.targetActivationsQty} />
                        </TableCell>
                        <TableCell>
                          {isLive(p.periodStart, p.periodEnd)
                            ? <Badge>Live</Badge>
                            : <Badge variant="secondary">Expired</Badge>}
                          <div className="mt-1">
                            <ReliefToggle kind="target_bonus" id={p.id} granted={p.reliefGranted} action={setPolicyReliefAction} />
                          </div>
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
                        <TableCell label="Period">{formatDate(p.periodStart)} → {formatDate(p.periodEnd)}</TableCell>
                        <TableCell label="Per unit ₨" className="text-right tabular-nums">{formatPKR(p.perUnitAmount)}</TableCell>
                        <TableCell label="Min qty" className="text-right tabular-nums">{minQ ?? "—"}</TableCell>
                        <TableCell label="Purchased">
                          {minQ != null
                            ? <MiniProgress current={count} target={minQ} />
                            : <AchievementBadge count={count} label="units" />}
                        </TableCell>
                        <TableCell>
                          {isLive(p.periodStart, p.periodEnd)
                            ? <Badge>Live</Badge>
                            : <Badge variant="secondary">Expired</Badge>}
                          <div className="mt-1">
                            <ReliefToggle kind="stock_in" id={p.id} granted={p.reliefGranted} action={setPolicyReliefAction} />
                          </div>
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

          {/* Combined stock-in: separate entry — grouped target, per-model rate */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">Combined Stock-In Policy</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  One target counted across several models together; each model paid at its own rate.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowCombinedForm((v) => !v)}>
                {showCombinedForm ? "Close" : "+ Combined policy"}
              </Button>
            </CardHeader>
            {showCombinedForm && (
              <CardContent>
                <CombinedStockInForm
                  models={props.models}
                  onSuccess={() => { setShowCombinedForm(false); toast.success("Combined stock-in policy added"); router.refresh(); }}
                />
              </CardContent>
            )}
          </Card>

          {props.combinedStockIn.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Models (rate / unit)</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Target qty</TableHead>
                      <TableHead>Combined purchased</TableHead>
                      <TableHead></TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {props.combinedStockIn.map((p) => {
                      const count = props.achievements.combinedStockIn[p.id] ?? 0;
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="space-y-0.5">
                              {p.models.map((m) => (
                                <div key={m.modelId} className="text-sm">
                                  <span className="font-medium">{m.modelName}</span>{" "}
                                  <span className="tabular-nums text-muted-foreground">— {formatPKR(m.perUnitAmount)}</span>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell label="Period">{formatDate(p.periodStart)} → {formatDate(p.periodEnd)}</TableCell>
                          <TableCell label="Target qty" className="text-right tabular-nums">{p.targetQty}</TableCell>
                          <TableCell label="Combined purchased"><MiniProgress current={count} target={p.targetQty} /></TableCell>
                          <TableCell>
                            {isLive(p.periodStart, p.periodEnd)
                              ? <Badge>Live</Badge>
                              : <Badge variant="secondary">Expired</Badge>}
                            <div className="mt-1">
                              <ReliefToggle kind="combined_stock_in" id={p.id} granted={p.reliefGranted} action={setPolicyReliefAction} />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => onDelete("combined-stock-in", p.id, "combined stock-in policy")}>
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
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
                        <TableCell label="Period">{formatDate(p.periodStart)} → {formatDate(p.periodEnd)}</TableCell>
                        <TableCell label="Per unit ₨" className="text-right tabular-nums">{formatPKR(p.perUnitAmount)}</TableCell>
                        <TableCell label="Target" className="text-right tabular-nums">{p.targetQty ?? "—"}</TableCell>
                        <TableCell label="Achievement">
                          {p.targetQty != null
                            ? <MiniProgress current={count} target={p.targetQty} />
                            : <AchievementBadge count={count} label="activated" />}
                        </TableCell>
                        <TableCell>
                          {isLive(p.periodStart, p.periodEnd)
                            ? <Badge>Live</Badge>
                            : <Badge variant="secondary">Expired</Badge>}
                          <div className="mt-1">
                            <ReliefToggle kind="activation_incentive" id={p.id} granted={p.reliefGranted} action={setPolicyReliefAction} />
                          </div>
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
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-base">Combined Dealer Incentive</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  One activation target counted across all models together; each model paid at its own rate.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowCombinedDI((v) => !v)}>
                {showCombinedDI ? "Close" : "+ Combined policy"}
              </Button>
            </CardHeader>
            {showCombinedDI && (
              <CardContent>
                <BulkDealerIncentiveForm
                  models={props.models}
                  action={bulkCreateDealerIncentivesAction}
                  defaultStart={MonthDefaults().start}
                  defaultEnd={MonthDefaults().end}
                  onSuccess={() => { setShowCombinedDI(false); toast.success("Dealer incentives saved"); router.refresh(); }}
                />
              </CardContent>
            )}
          </Card>
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
                        <TableCell label="Period">{formatDate(p.periodStart)} → {formatDate(p.periodEnd)}</TableCell>
                        <TableCell label="Target qty" className="text-right tabular-nums">{p.targetTotalActivations}</TableCell>
                        <TableCell label="Per unit ₨" className="text-right tabular-nums">{formatPKR(p.perUnitAmount)}</TableCell>
                        <TableCell label="Achievement">
                          <MiniProgress current={count} target={p.targetTotalActivations} />
                        </TableCell>
                        <TableCell>
                          {isLive(p.periodStart, p.periodEnd)
                            ? <Badge>Live</Badge>
                            : <Badge variant="secondary">Expired</Badge>}
                          <div className="mt-1">
                            <ReliefToggle kind="dealer_incentive" id={p.id} granted={p.reliefGranted} action={setPolicyReliefAction} />
                          </div>
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
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Bonus cap (phones)</label>
          <Input name="bonusCapQty" type="number" min={1} placeholder="Leave blank = no cap" />
          <p className="text-[10px] text-muted-foreground">
            Once the purchase target is met, only the first N phones activated in this period earn the bonus.
          </p>
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

function EditTargetBonusRow({ policy, onDone, onCancel }: {
  policy: TargetBonusRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState<PolicyFormState, FormData>(updateTargetBonusAction, {});
  const [periodStart, setPeriodStart] = useState(policy.periodStart);
  const [periodEnd, setPeriodEnd] = useState(policy.periodEnd);
  const [targetQty, setTargetQty] = useState(String(policy.targetActivationsQty));
  const [bonusPct, setBonusPct] = useState(String(policy.bonusPercent));
  const [bonusCapQty, setBonusCapQty] = useState(policy.bonusCapQty == null ? "" : String(policy.bonusCapQty));
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
            <Input name="bonusPercent" type="number" step="any" min={0} value={bonusPct} onChange={(e) => setBonusPct(e.target.value)} required className="w-24" />
          </div>
          <div className="space-y-0.5">
            <label className="text-[10px] text-muted-foreground">Bonus cap</label>
            <Input name="bonusCapQty" type="number" min={1} value={bonusCapQty} onChange={(e) => setBonusCapQty(e.target.value)} placeholder="no cap" className="w-24" />
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
  const [perUnit, setPerUnit] = useState(String(policy.perUnitAmount));
  const [minQty, setMinQty] = useState(policy.minQty != null ? String(policy.minQty) : "");
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
          <Input name="perUnitAmount" type="number" step="any" min={0} value={perUnit} onChange={(e) => setPerUnit(e.target.value)} required className="w-28" placeholder="Per unit ₨" />
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
  const [perUnit, setPerUnit] = useState(String(policy.perUnitAmount));
  const [targetQty, setTargetQty] = useState(policy.targetQty != null ? String(policy.targetQty) : "");
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
          <Input name="perUnitAmount" type="number" step="any" min={0} value={perUnit} onChange={(e) => setPerUnit(e.target.value)} required className="w-28" placeholder="Per unit ₨" />
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
  const [perUnit, setPerUnit] = useState(String(policy.perUnitAmount));
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
          <Input name="perUnitAmount" type="number" step="any" min={0} value={perUnit} onChange={(e) => setPerUnit(e.target.value)} required className="w-28" placeholder="Per unit ₨" />
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

function CombinedStockInForm({ models, onSuccess }: { models: ModelWithCurrentPrice[]; onSuccess?: () => void }) {
  const { start, end } = MonthDefaults();
  const [periodStart, setPeriodStart] = useState(start);
  const [periodEnd, setPeriodEnd] = useState(end);
  const [target, setTarget] = useState("");
  const [rates, setRates] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const chosen = models
      .filter((m) => rates[m.id] !== undefined && rates[m.id] !== "" && Number(rates[m.id]) >= 0)
      .map((m) => ({ modelId: m.id, perUnitAmount: Number(rates[m.id]) }));
    if (chosen.length < 2) { toast.error("Pick at least 2 models with a rate (use the single Stock-In form for one model)"); return; }
    if (!target || Number(target) < 1) { toast.error("Enter a valid combined target quantity"); return; }
    setPending(true);
    startTransition(async () => {
      const res = await createCombinedStockInAction({ periodStart, periodEnd, targetQty: Number(target), models: chosen });
      setPending(false);
      if (res.ok) { setRates({}); setTarget(""); onSuccess?.(); }
      else toast.error(res.error ?? "Failed");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Period start</label>
          <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Period end</label>
          <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
        </div>
      </div>
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-3 py-2.5 dark:border-amber-800/50 dark:bg-amber-950/20">
        <label className="text-xs font-medium text-amber-700 dark:text-amber-400">Combined Target Quantity</label>
        <p className="mb-1.5 mt-0.5 text-xs text-muted-foreground">
          Once total purchases across the selected models reach this number, every model below earns its rate on its full quantity.
        </p>
        <Input type="number" min={1} placeholder="e.g. 20" value={target} onChange={(e) => setTarget(e.target.value)} className="max-w-[140px]" required />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Per-model rate — leave blank to exclude a model from the group</p>
        <div className="rounded-lg border divide-y">
          {models.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-3 py-2">
              <span className="flex-1 text-sm font-medium">{m.name}</span>
              <Input
                type="number" step="any" min={0} placeholder="₨ per unit"
                value={rates[m.id] ?? ""}
                onChange={(e) => setRates((r) => ({ ...r, [m.id]: e.target.value }))}
                className="w-32 text-right"
              />
            </div>
          ))}
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Saving…" : "Save Combined Stock-In Policy"}
      </Button>
    </form>
  );
}
