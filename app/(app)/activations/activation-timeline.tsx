"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Smartphone } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate, formatPKR } from "@/lib/format";
import type { ActivationDateGroup } from "@/lib/activations/activation-stats";

interface Props {
  groups: ActivationDateGroup[];
}

/** Day-wise activation timeline. All dates collapsed by default — tap a date to
 *  reveal its per-model breakdown. Scrolls with the page (no pagination). */
export function ActivationTimeline({ groups }: Props) {
  const [openDate, setOpenDate] = useState<string | null>(null);

  if (groups.length === 0) {
    return <EmptyState icon={Smartphone} title="No activations in this range." description="Try a wider date range or clear filters." />;
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const open = openDate === group.date;
        return (
          <div key={group.date} className="overflow-hidden rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setOpenDate(open ? null : group.date)}
              className="flex w-full flex-wrap items-center justify-between gap-2 bg-muted/40 px-4 py-3 text-left"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-semibold">{formatDate(group.date)}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{group.count} activation{group.count === 1 ? "" : "s"}</span>
                {group.crossRegionCount > 0 ? (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <StatusBadge status="neutral" label={`${group.crossRegionCount} CR`} />
                  </>
                ) : null}
              </div>
              {open ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
            </button>

            {open && (
              <div className="divide-y border-t bg-background">
                {group.models.map((m) => (
                  <div key={m.modelId} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {m.modelName}
                      {m.crossRegionCount > 0 ? (
                        <StatusBadge status="neutral" label={`${m.crossRegionCount} CR`} className="ml-1.5 align-middle" />
                      ) : null}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums font-semibold">{m.count}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-2 text-xs font-medium">
                  <span className="text-muted-foreground">Stock value @ dealer ₨</span>
                  <span className="tabular-nums">{formatPKR(group.totalDealerValue)}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
