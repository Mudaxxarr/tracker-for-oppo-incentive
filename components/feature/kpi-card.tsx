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

  return (
    <Card className={cn(dimmed && "opacity-60", className)}>
      <CardHeader className="flex-row items-center justify-between gap-2 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </CardHeader>
      <CardContent className="space-y-1.5">
        <motion.div className="font-mono text-xl font-semibold tabular-nums">{text}</motion.div>
        {progress ? (
          <div className="space-y-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: "0%" }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {progress.current} / {progress.target} ({Math.round(pct)}%)
            </p>
          </div>
        ) : null}
        {helper ? <p className="text-xs text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}
