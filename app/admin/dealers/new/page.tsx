"use client";

import Link from "next/link";
import { useActionState, useState, useTransition, type ReactNode } from "react";
import { Copy, Mail, ShieldCheck, Store, Upload } from "lucide-react";

import { createTenantAction, type CreateTenantState } from "./actions";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { compressImageFile } from "@/lib/compress-image";

const INITIAL_STATE: CreateTenantState = {};
const DOCUMENT_FIELDS = ["cnicFront", "cnicBack", "taxCertificate"];

export default function NewDealerPage() {
  const [state, formAction, pending] = useActionState<CreateTenantState, FormData>(
    createTenantAction,
    INITIAL_STATE,
  );
  const [compressing, setCompressing] = useState(false);
  const [, startTransition] = useTransition();

  // Phone-camera CNIC/tax-certificate photos routinely run 3-8MB each; three of
  // them as base64 can exceed platform request-size ceilings regardless of any
  // server-side config. Downscale + re-encode images client-side before they
  // ever reach the network — PDFs pass through untouched.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const original = new FormData(e.currentTarget);
    setCompressing(true);
    try {
      const fd = new FormData();
      for (const [key, value] of original.entries()) {
        if (value instanceof File && value.size > 0 && DOCUMENT_FIELDS.includes(key)) {
          fd.set(key, await compressImageFile(value));
        } else {
          fd.set(key, value as string);
        }
      }
      startTransition(() => formAction(fd));
    } finally {
      setCompressing(false);
    }
  }

  if (state.credentials) {
    const c = state.credentials;
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Dealer Created</h1>
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950">
          <CardHeader>
            <CardTitle className="text-base text-emerald-800 dark:text-emerald-200">
              Credentials - share these once, they will not be shown again
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <CredRow label="Dealer Login ID" value={c.adminEmail} />
            <CredRow label="Temp Password" value={c.tempPassword} mono />
          </CardContent>
          <CardFooter className="flex gap-2">
            <a href={c.mailtoLink} className={cn(buttonVariants({ size: "sm" }))}>
              <Mail className="mr-1 size-4" />
              Open in Mail
            </a>
            <Link href="/admin/dealers" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Back to dealers
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold">New Dealer Account</h1>
        <p className="text-sm text-muted-foreground">
          Capture dealer identity, contact details, and onboarding documents before issuing access.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl">
        <Card>
          <CardContent className="space-y-6 pt-6">
            <SectionHeader
              icon={<Store className="size-4" />}
              title="Dealer details"
              description="Business identity and ownership information."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <TextField disabled={pending || compressing} id="businessName" label="Dealer/business name" placeholder="Al-Hassan Electronics" error={state.fieldErrors?.businessName} />
              <TextField disabled={pending || compressing} id="ownerName" label="Owner name" placeholder="Muhammad Ali" error={state.fieldErrors?.ownerName} />
              <TextField disabled={pending || compressing} id="ownerEmail" label="Email" type="email" placeholder="owner@example.com" error={state.fieldErrors?.ownerEmail} />
              <TextField disabled={pending || compressing} id="mobileNumber" label="Mobile number" placeholder="03xxxxxxxxx" error={state.fieldErrors?.mobileNumber} />
              <TextField disabled={pending || compressing} id="whatsappNumber" label="WhatsApp number" placeholder="03xxxxxxxxx" error={state.fieldErrors?.whatsappNumber} />
              <TextField disabled={pending || compressing} id="cityRegion" label="City/region" placeholder="Lahore" error={state.fieldErrors?.cityRegion} />
              <TextField disabled={pending || compressing} id="oppoDealerId" label="OPPO dealer ID" placeholder="DLR-00123" error={state.fieldErrors?.oppoDealerId} />
              <TextField disabled={pending || compressing} id="staffCount" label="Number of staff who will use the app" type="number" min={0} max={50} defaultValue={1} error={state.fieldErrors?.staffCount} />
              <div className="md:col-span-2">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Shop address</span>
                  <textarea
                    id="shopAddress"
                    name="shopAddress"
                    rows={3}
                    required
                    placeholder="Street, area, landmark"
                    disabled={pending || compressing}
                    className="min-h-24 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {state.fieldErrors?.shopAddress && (
                    <p className="text-xs text-destructive">{state.fieldErrors.shopAddress}</p>
                  )}
                </label>
              </div>
            </div>

            <SectionHeader
              icon={<Upload className="size-4" />}
              title="Required documents"
              description="Upload clear copies of the CNIC and tax certificate."
            />
            <div className="grid gap-4 md:grid-cols-3">
              <FileField
                disabled={pending || compressing}
                id="cnicFront"
                label="CNIC (Front)"
                accept="image/*,application/pdf"
                error={state.fieldErrors?.cnicFront}
              />
              <FileField
                disabled={pending || compressing}
                id="cnicBack"
                label="CNIC (Back)"
                accept="image/*,application/pdf"
                error={state.fieldErrors?.cnicBack}
              />
              <FileField
                disabled={pending || compressing}
                id="taxCertificate"
                label="Tax / NTN / Sales tax certificate"
                accept="image/*,application/pdf"
                error={state.fieldErrors?.taxCertificate}
              />
            </div>

            <SectionHeader
              icon={<ShieldCheck className="size-4" />}
              title="Dealer access"
              description="Account credentials and membership duration."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                disabled={pending || compressing}
                id="adminEmail"
                label="Dealer Login ID"
                placeholder="dealer001 or dealer@example.com"
                error={state.fieldErrors?.adminEmail}
              />
              <TextField
                disabled={pending || compressing}
                id="planMonths"
                label="Plan duration (months)"
                type="number"
                min={1}
                max={60}
                defaultValue={12}
                error={state.fieldErrors?.planMonths}
              />
            </div>

            {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button type="submit" disabled={pending || compressing}>
              {compressing ? "Preparing documents..." : pending ? "Creating..." : "Create Account"}
            </Button>
            <Link href="/admin/dealers" className={cn(buttonVariants({ variant: "outline" }))}>
              Cancel
            </Link>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  type = "text",
  placeholder,
  min,
  max,
  defaultValue,
  error,
  disabled = false,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  defaultValue?: string | number;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <Input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        min={min}
        max={max}
        defaultValue={defaultValue}
        disabled={disabled}
        required
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </label>
  );
}

function FileField({
  id,
  label,
  accept,
  error,
  disabled = false,
}: {
  id: string;
  label: string;
  accept: string;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <Input id={id} name={id} type="file" accept={accept} disabled={disabled} required />
      <p className="text-xs text-muted-foreground">Accepted: JPG, PNG, or PDF.</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </label>
  );
}

function CredRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  function copy() {
    navigator.clipboard.writeText(value).catch(() => {});
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span className={mono ? "font-mono" : ""}>{value}</span>
      <button type="button" onClick={copy} className="text-muted-foreground hover:text-foreground">
        <Copy className="size-3.5" />
      </button>
    </div>
  );
}
