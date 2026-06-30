import { cn } from "@/lib/utils";

const PKR = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});
const NUM = new Intl.NumberFormat("en-PK");

interface Props {
  value: number | null | undefined;
  format?: "currency" | "number";
  className?: string;
  fallback?: string;
}

/**
 * Renders financial values and stock counts in Geist Mono.
 * All PKR amounts, unit counts, and model codes must use this component.
 */
export function DataValue({ value, format = "number", className, fallback = "—" }: Props) {
  if (value == null || !Number.isFinite(value as number)) {
    return (
      <span className={cn("font-mono text-sm tabular-nums text-muted-foreground", className)}>
        {fallback}
      </span>
    );
  }
  const formatted = format === "currency" ? PKR.format(value) : NUM.format(value);
  return (
    <span className={cn("font-mono text-sm tabular-nums", className)}>
      {formatted}
    </span>
  );
}
