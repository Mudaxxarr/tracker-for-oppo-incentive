import { notFound } from "next/navigation";
import { getBillingEvents, getTenantById } from "@/lib/admin/dealers";
import { BillingClient } from "./billing-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminBillingPage({ params }: Props) {
  const { id } = await params;
  const [tenant, events] = await Promise.all([getTenantById(id), getBillingEvents(id)]);
  if (!tenant) notFound();

  return <BillingClient tenant={tenant} events={events} />;
}
