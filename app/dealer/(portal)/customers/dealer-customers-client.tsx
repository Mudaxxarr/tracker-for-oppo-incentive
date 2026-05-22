"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  createDealerCustomerAction,
  getCustomerActivationsAction,
  type CustomerFormState,
} from "./actions";
import { formatDate, formatPKR } from "@/lib/format";
import { toast } from "sonner";
import type { CustomerRow, CustomerActivation } from "@/lib/db/queries/customers";
import { UserPlus, Search, ChevronRight } from "lucide-react";

interface Props {
  initial: CustomerRow[];
}

export function DealerCustomersClient({ initial }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [activations, setActivations] = useState<CustomerActivation[]>([]);
  const [loadingActivations, setLoadingActivations] = useState(false);
  const [, startTransition] = useTransition();
  const [state, action, pending] = useActionState<CustomerFormState, FormData>(
    createDealerCustomerAction,
    {}
  );

  const filtered = initial.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.cnic ?? "").includes(q)
    );
  });

  const openCustomer = async (c: CustomerRow) => {
    setSelected(c);
    setLoadingActivations(true);
    const acts = await getCustomerActivationsAction(c.id);
    setActivations(acts);
    setLoadingActivations(false);
  };

  if (state.ok && !pending) {
    toast.success("Customer added");
    startTransition(() => router.refresh());
  }
  if (state.error && !pending) {
    toast.error(state.error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-sm text-muted-foreground">Build your customer database to track sale history.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="size-4" />
            New customer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Input name="name" placeholder="Full name" required />
            <Input name="phone" type="tel" placeholder="Phone number" required />
            <Input name="cnic" placeholder="CNIC (optional)" />
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add customer"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Search className="size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, CNIC…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <span className="ml-auto text-sm text-muted-foreground">
              {filtered.length} of {initial.length}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>CNIC</TableHead>
                  <TableHead className="text-right">Purchases</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      {search ? "No customers match." : "No customers yet. Add your first one above."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => openCustomer(c)}
                    >
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="tabular-nums">{c.phone}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{c.cnic ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={c.activationCount > 0 ? "default" : "outline"}>
                          {c.activationCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(c.createdAt.slice(0, 10))}</TableCell>
                      <TableCell>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>{selected.name}</SheetTitle>
                <p className="text-sm text-muted-foreground">{selected.phone}{selected.cnic ? ` · ${selected.cnic}` : ""}</p>
              </SheetHeader>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Purchase history</h3>
                  {loadingActivations ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : activations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No purchases recorded for this customer yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Model</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activations.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="text-sm">{a.modelName}</TableCell>
                            <TableCell className="text-sm">{formatDate(a.activationDate)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {formatPKR(a.dealerPriceSnapshot)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
