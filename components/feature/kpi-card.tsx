"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number;
  format?: "currency" | "number";
  icon?: ReactNode;
  className?: string;
  helper?: string;
  highlightZero?: boolean;
  progress?: { current: number; target: number };
}

const PKR_INT = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});
const NUM_INT = new Intl.NumberFormat("en-PK");

function fmt(value: number, mode: "currency" | "number") {
  if (!Number.isFinite(value)) return "—";
  return mode === "currency" ? PKR_INT.format(value) : NUM_INT.format(value);
}

function progressColor(pct: number): string {
  if (pct >= 90) return "#22c55e"; // green-500
  if (pct >= 70) return "#84cc16"; // lime-500 (greenish-yellow)
  if (pct >= 40) return "#f97316"; // orange-500
  return "#ef4444";                // red-500
}

function progressBgColor(pct: number): string {
  if (pct >= 90) return "rgba(34,197,94,0.15)";
  if (pct >= 70) return "rgba(132,204,22,0.15)";
  if (pct >= 40) return "rgba(249,115,22,0.15)";
  return "rgba(239,68,68,0.15)";
}

export function KpiCard({
  label,
  value,
  format = "number",
  icon,
  className,
  helper,
  highlightZero = false,
  progress,
}: Props) {
  const motionValue = useMotionValue(0);
  const display = useTransform(motionValue, (v) => fmt(v, format));
  const [text, setText] = useState(fmt(0, format));

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.6, ease: "easeOut" });
    const unsub = display.on("change", (v) => setText(v));
    return () => {
      controls.stop();
      unsub();
    };
  }, [value, motionValue, display]);

  const dimmed = highlightZero && value === 0;
  const pct = progress
    ? Math.min(100, (progress.current / Math.max(1, progress.target)) * 100)
    : 0;
  const color = progressColor(pct);
  const bgColor = progressBgColor(pct);

  return (
    <Card className={cn(dimmed && "opacity-60", className)}>
      <CardHeader className="flex-row items-center justify-between gap-2 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </CardHeader>
      <CardContent className="space-y-1.5">
        <motion.div className="text-2xl font-semibold tabular-nums">{text}</motion.div>
        {progress ? (
          <div className="space-y-1">
            {/* Track */}
            <div
              className="relative h-2 overflow-hidden rounded-full"
              style={{ background: bgColor }}
            >
              {/* Fill bar with color */}
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: color }}
                initial={{ width: "0%" }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
              {/* Shimmer overlay — always animating */}
              <motion.div
                className="absolute inset-y-0 w-16 skew-x-[-20deg] rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
                }}
                animate={{ left: ["-4rem", "110%"] }}
                transition={{
                  duration: 1.6,
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatDelay: 0.6,
                }}
              />
            </div>
            <p
              className="text-[11px] font-medium tabular-nums"
              style={{ color }}
            >
              {progress.current} / {progress.target} ({Math.round(pct)}%)
            </p>
          </div>
        ) : null}
        {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}
