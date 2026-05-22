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
import { Badge } from "@/components/ui/badge";
import { createCustomerAction, type CustomerFormState } from "./actions";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import type { CustomerRow } from "@/lib/db/queries/customers";
import { UserPlus, Search } from "lucide-react";

interface Props {
  initial: CustomerRow[];
}

export function CustomersClient({ initial }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();
  const [state, action, pending] = useActionState<CustomerFormState, FormData>(
    createCustomerAction,
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

  if (state.ok && !pending) {
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-sm text-muted-foreground">All customers across your active dealer ID.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="size-4" />
            Add customer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Input name="name" placeholder="Full name" required />
            <Input name="phone" placeholder="Phone number" required />
            <Input name="cnic" placeholder="CNIC (optional)" />
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add"}
            </Button>
          </form>
          {state.error && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
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
              {filtered.length} customer{filtered.length !== 1 ? "s" : ""}
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
                  <TableHead>Dealer ID</TableHead>
                  <TableHead className="text-right">Activations</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      {search ? "No customers match your search." : "No customers yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="tabular-nums">{c.phone}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{c.cnic ?? "—"}</TableCell>
                      <TableCell>{c.dealerName}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={c.activationCount > 0 ? "default" : "outline"}>
                          {c.activationCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(c.createdAt.slice(0, 10))}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
