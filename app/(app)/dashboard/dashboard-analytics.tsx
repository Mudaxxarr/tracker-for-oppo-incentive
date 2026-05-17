"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Smartphone } from "lucide-react";
import { getModelSalesAction, type ModelSaleRow } from "./actions";

type Preset = "month" | "week" | "today" | "custom";

function presetRange(p: Preset): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (p === "today") {
    const s = fmt(today);
    return { from: s, to: s };
  }
  if (p === "week") {
    const day = today.getDay(); // 0=Sun
    const start = new Date(today);
    start.setDate(today.getDate() - day);
    return { from: fmt(start), to: fmt(today) };
  }
  if (p === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: fmt(start), to: fmt(end) };
  }
  return { from: fmt(today), to: fmt(today) };
}

interface Props {
  initialRows: ModelSaleRow[];
  initialFrom: string;
  initialTo: string;
}

export function DashboardAnalytics({ initialRows, initialFrom, initialTo }: Props) {
  const [rows, setRows] = useState<ModelSaleRow[]>(initialRows);
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [pending, startTransition] = useTransition();

  const load = (f: string, t: string) => {
    startTransition(async () => {
      const data = await getModelSalesAction(f, t);
      setRows(data);
    });
  };

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const { from: f, to: t } = presetRange(p);
      setFrom(f);
      setTo(t);
      load(f, t);
    }
  };

  useEffect(() => {
    if (preset !== "custom") {
      const { from: f, to: t } = presetRange(preset);
      setFrom(f);
      setTo(t);
      load(f, t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = rows.reduce((s, r) => s + r.qty, 0);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Smartphone className="size-4" />
          Model-wise Sales
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {(["month", "week", "today", "custom"] as Preset[]).map((p) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                preset === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {p === "month" ? "This Month" : p === "week" ? "This Week" : p === "today" ? "Today" : "Custom"}
            </button>
          ))}
          {preset === "custom" && (
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-7 w-32 text-xs"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-7 w-32 text-xs"
              />
              <Button size="sm" className="h-7 text-xs" onClick={() => load(from, to)}>
                Apply
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {pending ? (
          <div className="p-6 text-center text-sm text-muted-foreground animate-pulse">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No activations in this period.
          </div>
        ) : (
          <div className="divide-y">
            {rows.map((r) => {
              const pct = total > 0 ? (r.qty / total) * 100 : 0;
              return (
                <div key={r.modelId} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-36 shrink-0 text-sm font-medium truncate">{r.modelName}</div>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 text-right text-sm font-semibold tabular-nums">
                    {r.qty} sold
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between px-4 py-3 text-xs font-medium text-muted-foreground border-t">
              <span>{rows.length} model(s)</span>
              <span className="font-semibold text-foreground tabular-nums">{total} total</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
