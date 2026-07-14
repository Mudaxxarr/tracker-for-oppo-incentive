"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { logoutAction } from "@/app/dealer/actions";

// The dealer app's "home" screens — hardware back here has nowhere else to go,
// so instead of letting Android close the app we ask Exit vs Logout.
const HOME_PATHS = ["/dealer/dashboard"];

/** Mounted once in the dealer portal layout — applies to every dealer role. */
export function DealerBackHandler() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: { remove: () => void } | undefined;
    let cancelled = false;

    import("@capacitor/app").then(({ App }) => {
      if (cancelled) return;
      App.addListener("backButton", ({ canGoBack }) => {
        if (HOME_PATHS.includes(window.location.pathname) || !canGoBack) {
          setOpen(true);
        } else {
          router.back();
        }
      }).then((handle) => {
        if (cancelled) handle.remove();
        else listenerHandle = handle;
      });
    });

    return () => {
      cancelled = true;
      listenerHandle?.remove();
    };
  }, [router]);

  const handleExit = async () => {
    const { App } = await import("@capacitor/app");
    App.exitApp();
  };

  const handleLogout = async () => {
    setOpen(false);
    await logoutAction();
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Exit or logout?</AlertDialogTitle>
          <AlertDialogDescription>
            Choose whether to close the app or sign out of your account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="outline" onClick={handleLogout}>Logout</AlertDialogAction>
          <AlertDialogAction onClick={handleExit}>Exit app</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
