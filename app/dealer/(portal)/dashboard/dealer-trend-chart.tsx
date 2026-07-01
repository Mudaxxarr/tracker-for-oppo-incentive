"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  data: Array<{ label: string; activations: number; earnings: number }>;
  className?: string;
  contentClassName?: string;
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);

export function DealerTrendChart({ data, className, contentClassName }: Props) {
  return (
    <Card className={cn(
      "dashboard-card-live h-full min-w-0 rounded-xl border border-border bg-card shadow-none",
      className,
    )}>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm font-medium">Earnings trend</CardTitle>
          <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-primary" />
              Earnings
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-muted-foreground" />
              Activations
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("h-64 min-w-0", contentClassName)}>
        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={1}
          minHeight={1}
          initialDimension={{ width: 640, height: 260 }}
          debounce={50}
        >
          <LineChart accessibilityLayer data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.28} vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              className="text-xs"
            />
            <YAxis
              yAxisId="earnings"
              axisLine={false}
              tickLine={false}
              width={44}
              className="text-xs"
              tickFormatter={(v) => compact(Number(v))}
            />
            <YAxis
              yAxisId="activations"
              orientation="right"
              axisLine={false}
              tickLine={false}
              width={28}
              className="text-xs"
              tickFormatter={(v) => String(v)}
            />
            <Tooltip
              formatter={(v, name) =>
                name === "earnings"
                  ? [formatPKR(Number(v)), "Earnings"]
                  : [String(v ?? ""), "Activations"]
              }
              labelClassName="text-xs"
              contentStyle={{
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line
              yAxisId="earnings"
              type="monotone"
              dataKey="earnings"
              stroke="var(--primary)"
              strokeWidth={2.25}
              dot={{ r: 3 }}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="activations"
              type="monotone"
              dataKey="activations"
              stroke="var(--muted-foreground)"
              strokeWidth={1.75}
              strokeDasharray="4 3"
              dot={false}
              opacity={0.65}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
