"use client";

import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { switchActiveDealerIdAction } from "@/app/dealer/actions";
import { useRouter } from "next/navigation";
import { IdCard } from "lucide-react";

export interface DealerIdOption {
  id: string;
  name: string;
}

/** Top-bar switcher for dealers who own multiple Dealer IDs. Only rendered
 *  when there are 2+ IDs (single-ID dealers just see their shop name). */
export function DealerIdSwitcher({
  options,
  activeId,
}: {
  options: DealerIdOption[];
  activeId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const activeName = options.find((d) => d.id === activeId)?.name ?? "Select ID";

  return (
    <Select
      value={activeId ?? undefined}
      onValueChange={(value) => {
        if (typeof value !== "string" || !value || value === activeId) return;
        startTransition(async () => {
          await switchActiveDealerIdAction(value);
          router.refresh();
        });
      }}
      disabled={isPending}
    >
      <SelectTrigger className="h-8 w-[130px] sm:w-[180px]" aria-label="Active Dealer ID">
        <div className="flex min-w-0 items-center gap-1.5">
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
