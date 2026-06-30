import { cn } from "@/lib/utils";

type StatusTier = "confirmed" | "pending" | "voided" | "neutral";

const TIER_MAP: Record<string, StatusTier> = {
  // confirmed
  active: "confirmed",
  approved: "confirmed",
  ACCEPTED: "confirmed",
  ok: "confirmed",
  // pending
  pending: "pending",
  pending_review: "pending",
  PENDING: "pending",
  PENDING_REPORT: "pending",
  PENDING_OWNER_APPROVAL: "pending",
  cr_pending_approval: "pending",
  purchase_pending_review: "pending",
  cr_caught_pending_approval: "pending",
  grace: "pending",
  // voided
  voided: "voided",
  rejected: "voided",
  REJECTED: "voided",
  suspended: "voided",
  expired: "voided",
};

const TIER_STYLES: Record<StatusTier, string> = {
  confirmed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  pending:   "bg-amber-50 text-amber-800 ring-amber-200",
  voided:    "bg-red-50 text-red-800 ring-red-200",
  neutral:   "bg-slate-100 text-slate-600 ring-slate-200",
};

const LABELS: Record<string, string> = {
  active:                      "Active",
  approved:                    "Approved",
  ACCEPTED:                    "Accepted",
  ok:                          "OK",
  pending:                     "Pending",
  pending_review:              "Under Review",
  PENDING:                     "Pending",
  PENDING_REPORT:              "Pending Report",
  PENDING_OWNER_APPROVAL:      "Pending Approval",
  cr_pending_approval:         "Pending CR Approval",
  purchase_pending_review:     "Pending Review",
  cr_caught_pending_approval:  "Pending Approval",
  grace:                       "Grace Period",
  voided:                      "Voided",
  rejected:                    "Rejected",
  REJECTED:                    "Rejected",
  suspended:                   "Suspended",
  expired:                     "Expired",
};

interface Props {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: Props) {
  const tier = TIER_MAP[status] ?? "neutral";
  const text = label ?? LABELS[status] ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TIER_STYLES[tier],
        className
      )}
    >
      {text}
    </span>
  );
}
