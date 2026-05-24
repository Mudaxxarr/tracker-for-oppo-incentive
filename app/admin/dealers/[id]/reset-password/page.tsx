import { notFound } from "next/navigation";
import { getTenantById } from "@/lib/admin/dealers";
import { ResetPasswordClient } from "./reset-password-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ResetPasswordPage({ params }: Props) {
  const { id } = await params;
  const tenant = await getTenantById(id);
  if (!tenant) notFound();

  return (
    <ResetPasswordClient
      tenantId={id}
      businessName={tenant.businessName}
      users={tenant.users}
    />
  );
}
