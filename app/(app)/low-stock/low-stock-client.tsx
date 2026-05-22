"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setThresholdAction } from "./actions";
import { toast } from "sonner";
import type { ModelWithCurrentPrice } from "@/lib/db/queries/models";
import { AlertTriangle, BellOff, Check } from "lucide-react";

interface LowStockAlert {
  modelId: string;
  modelName: string;
  threshold: number;
  dealerId: string;
  dealerName: string;
  currentStock: number;
}

interface Props {
  models: ModelWithCurrentPrice[];
  alerts: LowStockAlert[];
}

function ThresholdInput({ model }: { model: ModelWithCurrentPrice & { lowStockThreshold?: number | null } }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState(model.lowStockThreshold?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const n = value.trim() === "" ? null : parseInt(value);
    if (value.trim() !== "" && (isNaN(n!) || n! < 0)) { toast.error("Enter a valid number"); return; }
    setSaving(true);
    const res = await setThresholdAction(model.id, n);
    setSaving(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success(n === null ? "Threshold cleared" : `Threshold set to ${n}`);
      startTransition(() => router.refresh());
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        max={9999}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="—"
        className="w-20 text-center"
      />
      <Button size="sm" variant="ghost" onClick={save} disabled={saving}>
        <Check className="size-4" />
      </Button>
    </div>
  );
}

export function LowStockClient({ models, alerts }: Props) {
  const [showAll, setShowAll] = useState(false);
  const activeModels = models.filter((m) => m.isActive);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Low-Stock Alerts</h1>
        <p className="text-sm text-muted-foreground">
          Set per-model thresholds. Dealers see a warning when their stock drops below the threshold.
        </p>
      </div>

      {/* Active alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            Current Low-Stock Alerts ({alerts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {alerts.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <BellOff className="size-8 mx-auto mb-2 text-muted-foreground/40" />
              No dealers are below any threshold right now.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dealer</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Threshold</TableHead>
                    <TableHead className="text-right">Deficit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((a, i) => (
                    <TableRow key={i} className="hover:bg-amber-50/50">
                      <TableCell className="font-medium">{a.dealerName}</TableCell>
                      <TableCell>{a.modelName}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">{a.currentStock}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{a.threshold}</TableCell>
                      <TableCell className="text-right text-amber-600 font-semibold">
                        -{a.threshold - a.currentStock}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Threshold settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Model Thresholds</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show thresholds only" : "Show all models"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Alert When Stock Below</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeModels
                  .filter((m) => showAll || (m as ModelWithCurrentPrice & { lowStockThreshold?: number | null }).lowStockThreshold != null)
                  .map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>
                        <ThresholdInput model={m as ModelWithCurrentPrice & { lowStockThreshold?: number | null }} />
                      </TableCell>
                    </TableRow>
                  ))}
                {!showAll && activeModels.filter((m) => (m as ModelWithCurrentPrice & { lowStockThreshold?: number | null }).lowStockThreshold != null).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="py-8 text-center text-sm text-muted-foreground">
                      No thresholds set yet. Click "Show all models" to configure.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
