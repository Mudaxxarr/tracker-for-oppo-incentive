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
 * Test-sandbox only. Mirror of the owner ViewSwitcher so you can jump back to the
 * Admin View from the dealer portal. Admin uses the owner session (independent of
 * the dealer cookie): if the owner session is live you land straight in admin,
 * otherwise /admin bounces to the owner login. Never shown to real dealers.
 */
export function DealerViewSwitcher() {
  return (
    <div className="flex items-center gap-1.5">
      <Eye className="size-4 shrink-0 text-primary" />
      <Select
        value="dealer"
        onValueChange={(v) => {
          if (v === "admin") window.location.href = "/admin/dealers";
        }}
      >
        <SelectTrigger className="h-8 w-[132px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="dealer">Dealer View</SelectItem>
          <SelectItem value="admin">Admin View</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
