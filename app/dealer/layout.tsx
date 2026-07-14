import type { Metadata } from "next";

// Overrides the root layout's title for the entire /dealer/* tree — the dealer
// app must never surface the developer's business name (see lib/is-dealer-app.ts).
export const metadata: Metadata = {
  title: "Incento",
};

export default function DealerRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
