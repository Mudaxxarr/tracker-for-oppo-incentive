"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Smartphone } from "lucide-react";
import { dealerGetModelSalesAction, type ModelSaleRow } from "./actions";

type Preset = "month" | "week" | "today" | "custom";

const MODEL_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6",
  "#22c55e", "#3b82f6", "#a855f7", "#eab308", "#ef4444",
];

function presetRange(p: Preset): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (p === "today") { const s = fmt(today); return { from: s, to: s }; }
  if (p === "week") {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay());
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

export function DealerDashboardAnalytics({ initialRows, initialFrom, initialTo }: Props) {
  const [rows, setRows] = useState<ModelSaleRow[]>(initialRows);
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [pending, startTransition] = useTransition();

  const load = (f: string, t: string) => {
    startTransition(async () => {
      const data = await dealerGetModelSalesAction(f, t);
      setRows(data);
    });
  };

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") {
      const { from: f, to: t } = presetRange(p);
      setFrom(f); setTo(t);
      load(f, t);
    }
  };

  useEffect(() => {
    if (preset !== "custom") {
      const { from: f, to: t } = presetRange(preset);
      setFrom(f); setTo(t);
      load(f, t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = [...rows].sort((a, b) => b.qty - a.qty);
  const total = rows.reduce((s, r) => s + r.qty, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="size-4" />
              Activations by Model
            </CardTitle>
            {!pending && total > 0 && (
              <p className="mt-1">
                <span className="text-3xl font-bold tabular-nums">{total}</span>
                <span className="ml-1.5 text-sm text-muted-foreground">activations</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
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
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-7 w-32 text-xs" />
                <span className="text-xs text-muted-foreground">→</span>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-7 w-32 text-xs" />
                <Button size="sm" className="h-7 text-xs" onClick={() => load(from, to)}>Apply</Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {pending ? (
          <div className="space-y-3 px-4 pb-4">
            {[80, 55, 35, 20].map((w, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
                <div className="h-4 animate-pulse rounded-full bg-muted" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Smartphone className="size-8 opacity-25" />
            <p className="text-sm">No activations in this period.</p>
          </div>
        ) : (
          <div className="divide-y">
            {sorted.map((r, i) => {
              const pct = total > 0 ? (r.qty / total) * 100 : 0;
              const color = MODEL_COLORS[i % MODEL_COLORS.length];
              return (
                <div key={r.modelId} className="px-4 py-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {i + 1}
                      </span>
                      <span className="truncate text-sm font-medium">{r.modelName}</span>
                    </div>
                    <div className="ml-3 flex shrink-0 items-baseline gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground">{Math.round(pct)}%</span>
                      <span className="text-xl font-bold tabular-nums" style={{ color }}>
                        {r.qty}
                      </span>
                    </div>
                  </div>
                  <div
                    className="h-3 overflow-hidden rounded-full"
                    style={{ background: `${color}22` }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
              <span>{sorted.length} model{sorted.length !== 1 ? "s" : ""}</span>
              <span className="font-semibold tabular-nums text-foreground">{total} total</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
