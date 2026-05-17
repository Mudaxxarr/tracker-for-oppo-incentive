"use client";

import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { switchDealerAction } from "@/app/(app)/actions";
import { useRouter } from "next/navigation";
import { IdCard } from "lucide-react";

export interface DealerOption {
  id: string;
  name: string;
}

export function DealerSwitcher({
  options,
  activeId,
}: {
  options: DealerOption[];
  activeId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (options.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <IdCard className="size-4" />
        No dealer IDs yet
      </div>
    );
  }

  const activeName =
    options.find((d) => d.id === activeId)?.name ?? "Select Dealer ID";

  return (
    <Select
      value={activeId ?? undefined}
      onValueChange={(value) => {
        if (typeof value !== "string" || !value) return;
        startTransition(async () => {
          await switchDealerAction(value);
          router.refresh();
        });
      }}
      disabled={isPending}
    >
      <SelectTrigger
        className="w-[160px] sm:w-[200px] md:w-[220px]"
        aria-label="Active Dealer ID"
      >
        <div className="flex min-w-0 items-center gap-2">
          <IdCard className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate text-sm">{activeName}</span>
        </div>
      </SelectTrigger>
      <SelectContent>
        {options.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
