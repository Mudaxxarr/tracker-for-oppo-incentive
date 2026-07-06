"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { TOUR_STEPS } from "@/lib/dealer/tour-steps";

const SEEN_KEY = "dealer_tour_v1_done";

export function DealerTour() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Tour targets live on the dashboard, so only auto-run there.
    if (pathname !== "/dealer/dashboard") return;

    const forced = searchParams.get("tour") === "1";
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* storage blocked */
    }
    if (!forced && seen) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Drop steps whose target element is not on the page (feature-gated / not rendered).
    const steps = TOUR_STEPS.filter((s) => !s.element || document.querySelector(s.element));
    if (steps.length === 0) return;

    const d = driver({
      showProgress: true,
      animate: !prefersReduced,
      allowClose: true,
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Done",
      steps: steps.map((s) => ({
        element: s.element,
        popover: { title: s.title, description: s.description },
      })),
      onDestroyed: () => {
        try {
          localStorage.setItem(SEEN_KEY, "1");
        } catch {
          /* ignore */
        }
        // strip ?tour=1 — only if still on the dashboard (guards against a
        // navigation-triggered destroy yanking the user back).
        if (forced && window.location.pathname === "/dealer/dashboard") {
          router.replace("/dealer/dashboard");
        }
      },
    });

    const t = setTimeout(() => d.drive(), 400); // let the dashboard paint first
    return () => {
      clearTimeout(t);
      d.destroy();
    };
  }, [pathname, searchParams, router]);

  return null;
}
