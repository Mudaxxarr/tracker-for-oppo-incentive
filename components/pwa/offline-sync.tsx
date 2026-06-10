"use client";

import { useEffect, useState, useCallback } from "react";
import { getQueue, removeFromQueue } from "@/lib/offline-queue";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

export function OfflineSync() {
  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    if (typeof indexedDB === "undefined") return;
    try {
      const q = await getQueue();
      setQueueCount(q.length);
    } catch {}
  }, []);

  const sync = useCallback(async () => {
    if (typeof indexedDB === "undefined") return;
    let queue;
    try {
      queue = await getQueue();
    } catch { return; }
    if (queue.length === 0) return;

    setSyncing(true);
    let synced = 0;
    let failed = 0;
    for (const item of queue) {
      try {
        const res = await fetch("/api/offline-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
        if (res.ok) {
          await removeFromQueue(item.id);
          synced++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
    setSyncing(false);
    await refreshCount();
    if (synced > 0) toast.success(`${synced} offline record${synced > 1 ? "s" : ""} synced`);
    if (failed > 0) toast.error(`${failed} item${failed > 1 ? "s" : ""} failed to sync — will retry on next reconnect`);
  }, [refreshCount]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    refreshCount();

    const handleOnline = () => {
      setIsOnline(true);
      sync();
    };
    const handleOffline = () => setIsOnline(false);
    const handleQueueUpdate = () => refreshCount();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("offlineQueueUpdated", handleQueueUpdate);

    const handleSWMessage = (e: MessageEvent) => {
      if (e.data?.type === "SYNC_ACTIVATIONS") sync();
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleSWMessage);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("offlineQueueUpdated", handleQueueUpdate);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleSWMessage);
      }
    };
  }, [sync, refreshCount]);

  if (isOnline && queueCount === 0 && !syncing) return null;

  return (
    <div className="fixed bottom-[4.5rem] left-1/2 z-50 -translate-x-1/2 md:bottom-4">
      <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs shadow-md">
        {syncing ? (
          <span className="text-muted-foreground">Syncing {queueCount} item{queueCount !== 1 ? "s" : ""}…</span>
        ) : !isOnline ? (
          <>
            <WifiOff className="size-3 text-destructive" />
            <span className="text-destructive font-medium">
              Offline{queueCount > 0 ? ` · ${queueCount} queued` : ""}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
