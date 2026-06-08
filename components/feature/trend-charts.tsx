"use client";

import {
  Bar,
  BarChart,
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

interface MonthRow {
  label: string;
  total: number;
  activations: number;
}

const TOOLTIP_STYLE = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  fontSize: 12,
  color: "#0f172a",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07)",
  padding: "8px 12px",
};

const TICK_STYLE = { fontSize: 11, fill: "#94a3b8" };

export function TrendCharts({ data }: { data: MonthRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Last 6 months — total earnings</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
                tick={TICK_STYLE}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip
                formatter={(v) => [formatPKR(typeof v === "number" ? v : Number(v) || 0), "Earnings"]}
                contentStyle={TOOLTIP_STYLE}
                cursor={{ fill: "#f8fafc" }}
              />
              <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Activations trend</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={TICK_STYLE} axisLine={false} tickLine={false} />
              <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} width={36} />
              <Tooltip
                formatter={(v) => [String(v ?? ""), "Activations"]}
                contentStyle={TOOLTIP_STYLE}
              />
              <Line
                type="monotone"
                dataKey="activations"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#6366f1", strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
