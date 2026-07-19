"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  markAlertReadAction,
  markAllReadAction,
  approveCrCaughtAction,
  rejectCrCaughtAction,
  approveActivationDeletionAction,
  approvePurchaseReviewAction,
  rejectPurchaseReviewAction,
  approveCrInwardAction,
  rejectCrInwardAction,
  approveOfflineActivationAction,
  approveOfflinePurchaseAction,
  rejectOfflineItemAction,
} from "./actions";
import { formatDate } from "@/lib/format";
import { BellOff, CheckCheck, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { OwnerAlert } from "@/lib/db/schema";

const TYPE_LABELS: Record<string, string> = {
  cr_pending_approval: "CR Transfer",
  purchase_pending_review: "High Purchase",
  cr_caught_pending_approval: "CR Caught",
  activation_deletion_request: "Delete Request",
  offline_activation_pending: "Offline Activation",
  offline_purchase_pending: "Offline Purchase",
  offline_conflict: "Sync Conflict",
  reprice_failed: "Reprice Failed",
};

const TYPE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  cr_pending_approval: "secondary",
  purchase_pending_review: "destructive",
  cr_caught_pending_approval: "destructive",
  activation_deletion_request: "outline",
  offline_activation_pending: "secondary",
  offline_purchase_pending: "secondary",
  offline_conflict: "destructive",
  reprice_failed: "destructive",
};

interface Props {
  alerts: OwnerAlert[];
  unreadCount: number;
}

export function AlertsClient({ alerts, unreadCount }: Props) {
  const [filter, setFilter] = useState<"all" | "unread">("unread");
  const [, startTransition] = useTransition();
  const [localRead, setLocalRead] = useState<Set<string>>(new Set());

  const visible = alerts.filter((a) =>
    filter === "unread" ? !a.isRead && !localRead.has(a.id) : true,
  );

  const markOne = (id: string) => {
    setLocalRead((prev) => new Set([...prev, id]));
    startTransition(() => markAlertReadAction(id));
  };

  const handleApproveCrCaught = (alert: OwnerAlert) => {
    if (!alert.entityId) return;
    startTransition(async () => {
      const result = await approveCrCaughtAction(alert.id, alert.entityId!);
      if (result.ok) {
        setLocalRead((prev) => new Set([...prev, alert.id]));
        toast.success("CR-caught approved — stock deducted");
      } else {
        toast.error(result.error ?? "Approval failed");
      }
    });
  };

  const handleRejectCrCaught = (alert: OwnerAlert) => {
    if (!alert.entityId) return;
    startTransition(async () => {
      const result = await rejectCrCaughtAction(alert.id, alert.entityId!);
      if (result.ok) {
        setLocalRead((prev) => new Set([...prev, alert.id]));
        toast.success("CR-caught rejected — record removed");
      } else {
        toast.error(result.error ?? "Rejection failed");
      }
    });
  };

  const handleApproveCrInward = (alert: OwnerAlert) => {
    if (!alert.entityId) return;
    startTransition(async () => {
      const result = await approveCrInwardAction(alert.id, alert.entityId!);
      if (result.ok) {
        setLocalRead((prev) => new Set([...prev, alert.id]));
        toast.success("Cross-region stock approved — shifted into your ID");
      } else {
        toast.error(result.error ?? "Approval failed");
      }
    });
  };

  const handleRejectCrInward = (alert: OwnerAlert) => {
    if (!alert.entityId) return;
    if (!confirm("Reject this cross-region inward transfer?")) return;
    startTransition(async () => {
      const result = await rejectCrInwardAction(alert.id, alert.entityId!);
      if (result.ok) {
        setLocalRead((prev) => new Set([...prev, alert.id]));
        toast.success("Cross-region inward rejected");
      } else {
        toast.error(result.error ?? "Rejection failed");
      }
    });
  };

  const handleApprovePurchase = (alert: OwnerAlert) => {
    if (!alert.entityId) return;
    startTransition(async () => {
      const result = await approvePurchaseReviewAction(alert.id, alert.entityId!);
      if (result.ok) {
        setLocalRead((prev) => new Set([...prev, alert.id]));
        toast.success("Purchase approved — now counts toward stock & incentives");
      } else {
        toast.error(result.error ?? "Approval failed");
      }
    });
  };

  const handleRejectPurchase = (alert: OwnerAlert) => {
    if (!alert.entityId) return;
    if (!confirm("Reject and remove this purchase? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await rejectPurchaseReviewAction(alert.id, alert.entityId!);
      if (result.ok) {
        setLocalRead((prev) => new Set([...prev, alert.id]));
        toast.success("Purchase rejected — removed");
      } else {
        toast.error(result.error ?? "Rejection failed");
      }
    });
  };

  const handleApproveActivationDeletion = (alert: OwnerAlert) => {
    if (!alert.entityId) return;
    if (!confirm("Delete this activation? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await approveActivationDeletionAction(alert.id, alert.entityId!);
      if (result.ok) {
        setLocalRead((prev) => new Set([...prev, alert.id]));
        toast.success("Activation deleted");
      } else {
        toast.error(result.error ?? "Delete failed");
      }
    });
  };

  const handleApproveOfflineActivation = (alert: OwnerAlert) => {
    startTransition(async () => {
      const result = await approveOfflineActivationAction(alert.id);
      if (result.ok) {
        setLocalRead((prev) => new Set([...prev, alert.id]));
        toast.success("Offline activation posted");
      } else {
        toast.error(result.error ?? "Approval failed");
      }
    });
  };

  const handleApproveOfflinePurchase = (alert: OwnerAlert) => {
    startTransition(async () => {
      const result = await approveOfflinePurchaseAction(alert.id);
      if (result.ok) {
        setLocalRead((prev) => new Set([...prev, alert.id]));
        toast.success("Offline purchase posted");
      } else {
        toast.error(result.error ?? "Approval failed");
      }
    });
  };

  const handleRejectOfflineItem = (alert: OwnerAlert) => {
    if (!confirm("Reject this offline item? It will be discarded.")) return;
    startTransition(async () => {
      await rejectOfflineItemAction(alert.id);
      setLocalRead((prev) => new Set([...prev, alert.id]));
      toast.success("Offline item rejected");
    });
  };

  const markAll = () => {
    startTransition(() => markAllReadAction());
    setLocalRead(new Set(alerts.filter((a) => !a.isRead).map((a) => a.id)));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Alerts</h1>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden text-sm">
            {(["unread", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 capitalize transition-colors ${
                  filter === f ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAll} className="gap-1.5">
              <CheckCheck className="size-4" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-card py-16 text-muted-foreground">
          <BellOff className="size-8 opacity-40" />
          <p className="text-sm">{filter === "unread" ? "No unread alerts." : "No alerts yet."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((alert) => {
            const isRead = alert.isRead || localRead.has(alert.id);
            return (
              <div
                key={alert.id}
                className={`flex items-start justify-between gap-4 rounded-lg border px-4 py-3 transition-colors ${
                  isRead
                    ? "bg-card opacity-60"
                    : alert.type === "cr_caught_pending_approval"
                    ? "border-red-400/70 bg-red-50/40 dark:bg-red-950/20"
                    : alert.type === "cr_pending_approval"
                    ? "border-emerald-400/70 bg-emerald-50/40 dark:bg-emerald-950/20"
                    : alert.type === "offline_activation_pending" || alert.type === "offline_purchase_pending"
                    ? "border-blue-300/60 bg-blue-50/30 dark:bg-blue-950/20"
                    : alert.type === "offline_conflict"
                    ? "border-red-300/60 bg-red-50/20 dark:bg-red-950/10"
                    : "border-amber-300/60 bg-amber-50/30"
                }`}
              >
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={TYPE_VARIANT[alert.type] ?? "outline"} className="text-xs">
                      {TYPE_LABELS[alert.type] ?? alert.type}
                    </Badge>
                    {!isRead && (
                      <span className="size-2 rounded-full bg-amber-500 inline-block" />
                    )}
                  </div>
                  <p className="text-sm">{alert.message}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    <span>{formatDate(alert.createdAt)}</span>
                    {alert.dealerId && (
                      <span className="ml-1 text-muted-foreground/70">· {alert.dealerId}</span>
                    )}
                  </div>
                </div>
                {!isRead && (
                  <div className="flex shrink-0 flex-col gap-1">
                    {alert.type === "cr_caught_pending_approval" ? (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleApproveCrCaught(alert)}
                        >
                          <CheckCircle2 className="size-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs text-destructive"
                          onClick={() => handleRejectCrCaught(alert)}
                        >
                          <XCircle className="size-3.5" /> Reject
                        </Button>
                      </>
                    ) : alert.type === "cr_pending_approval" ? (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => handleApproveCrInward(alert)}
                        >
                          <CheckCircle2 className="size-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs text-destructive"
                          onClick={() => handleRejectCrInward(alert)}
                        >
                          <XCircle className="size-3.5" /> Reject
                        </Button>
                      </>
                    ) : alert.type === "purchase_pending_review" ? (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleApprovePurchase(alert)}
                        >
                          <CheckCircle2 className="size-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs text-destructive"
                          onClick={() => handleRejectPurchase(alert)}
                        >
                          <XCircle className="size-3.5" /> Reject
                        </Button>
                      </>
                    ) : alert.type === "activation_deletion_request" ? (
                      <>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleApproveActivationDeletion(alert)}
                        >
                          <CheckCircle2 className="size-3.5" /> Delete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => markOne(alert.id)}
                        >
                          Dismiss
                        </Button>
                      </>
                    ) : alert.type === "offline_activation_pending" ? (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleApproveOfflineActivation(alert)}
                        >
                          <CheckCircle2 className="size-3.5" /> Post
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs text-destructive"
                          onClick={() => handleRejectOfflineItem(alert)}
                        >
                          <XCircle className="size-3.5" /> Reject
                        </Button>
                      </>
                    ) : alert.type === "offline_purchase_pending" ? (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleApproveOfflinePurchase(alert)}
                        >
                          <CheckCircle2 className="size-3.5" /> Post
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs text-destructive"
                          onClick={() => handleRejectOfflineItem(alert)}
                        >
                          <XCircle className="size-3.5" /> Reject
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => markOne(alert.id)}
                      >
                        Dismiss
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
