"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

// next-themes injects a <script> for theme detection; React 19 warns about it during render.
// Module-level patch runs before any render so it catches the warning in time.
if (typeof window !== "undefined") {
  const _orig = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("Encountered a script tag")) return;
    _orig(...args);
  };
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster richColors closeButton position="top-right" />
    </ThemeProvider>
  );
}
