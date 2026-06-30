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

interface Props {
  data: Array<{ label: string; activations: number; earnings: number }>;
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);

export function DealerTrendChart({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Earnings — last 6 months</CardTitle>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="label" className="text-xs" />
            <YAxis className="text-xs" width={44} tickFormatter={(v) => compact(Number(v))} />
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
              type="monotone"
              dataKey="earnings"
              stroke="var(--primary)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="activations"
              stroke="var(--color-chart-3)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              opacity={0.55}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
