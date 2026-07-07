"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DailyPoint } from "@/lib/purchases/purchase-stats";

interface Props {
  data: DailyPoint[];
  dataKey: "amount" | "qty";
  variant?: "card" | "sparkline";
  valueFormatter: (v: number) => string;
  color?: string;
  className?: string;
}

export function PurchaseTrendChart({ data, dataKey, variant = "card", valueFormatter, color = "var(--primary)", className }: Props) {
  const sparkline = variant === "sparkline";
  return (
    <div className={cn(sparkline ? "h-16" : "h-full min-h-[200px]", className)}>
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 640, height: 200 }} debounce={50}>
        <AreaChart data={data} margin={sparkline ? { top: 4, right: 0, left: 0, bottom: 0 } : { top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`purchase-trend-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={sparkline ? 0.5 : 0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {!sparkline && <CartesianGrid strokeDasharray="3 3" opacity={0.28} vertical={false} />}
          {!sparkline && (
            <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={10} className="text-xs" tickFormatter={(v) => formatDate(String(v)).slice(0, 6)} />
          )}
          {!sparkline && (
            <YAxis axisLine={false} tickLine={false} width={44} className="text-xs" tickFormatter={(v) => valueFormatter(Number(v))} />
          )}
          {!sparkline && (
            <Tooltip
              formatter={(v) => [valueFormatter(Number(v)), dataKey === "amount" ? "Amount" : "Quantity"]}
              labelFormatter={(v) => formatDate(String(v))}
              contentStyle={{ background: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            />
          )}
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={sparkline ? 1.75 : 2.25}
            fill={`url(#purchase-trend-${dataKey})`}
            dot={false}
            isAnimationActive={!sparkline}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
