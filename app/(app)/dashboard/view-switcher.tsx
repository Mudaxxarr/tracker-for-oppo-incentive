"use client";

import { Eye } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Owner-only preview switcher. "Dealer View" hands off to the existing
 * admin impersonation route (owner-gated) which starts a dealer session for the
 * sandbox tenant and lands on the dealer portal. Only the owner ever sees this.
 */
export function ViewSwitcher({ testTenantId }: { testTenantId: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
      <Eye className="size-4 shrink-0 text-primary" />
      <span className="text-sm font-medium">Viewing as</span>
      <Select
        value="admin"
        onValueChange={(v) => {
          if (v === "dealer") window.location.href = `/api/admin/impersonate/${testTenantId}`;
        }}
      >
        <SelectTrigger className="h-8 w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">Admin View</SelectItem>
          <SelectItem value="dealer">Dealer View (Test)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
