import Link from "next/link";
import { redirect } from "next/navigation";
import { getDealerSession } from "@/lib/dealer-auth";
import { getTenantFeaturesById } from "@/lib/admin/dealers";
import { isFeatureEnabled } from "@/lib/dealer-features";
import { HELP, topicId, type HelpTopic } from "@/lib/dealer/help-content";

// Hide a whole topic when the dealer doesn't have the matching feature.
const TOPIC_FEATURE: Partial<Record<HelpTopic, "cross_region" | "reports">> = {
  "Cross-region": "cross_region",
  Reports: "reports",
};

const TOPIC_ORDER: HelpTopic[] = ["Money", "Activations", "Stock", "Cross-region", "Reports"];

const FAQ: { q: string; a: string }[] = [
  { q: "How is my net payout worked out?", a: "Start with every bonus you earned, add price-drop refunds, then subtract any cross-region fines. What is left is your net payout." },
  { q: "What is the at-risk amount?", a: "It is bonus money that could be reversed if any cross-region phones you sold get flagged." },
  { q: "Why did my stock go down without a sale?", a: "Stock also drops when a phone is activated, transferred out, or caught as cross-region — not only on direct sales." },
  { q: "How do I see the tour again?", a: "Tap “Replay guided tour” at the top of this page any time." },
];

export default async function DealerHelpPage() {
  const session = await getDealerSession();
  if (!session) redirect("/dealer/login");
  const features = await getTenantFeaturesById(session.tenantId);

  const topics = TOPIC_ORDER.filter((topic) => {
    const gate = TOPIC_FEATURE[topic];
    return !gate || isFeatureEnabled(features, gate);
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-lg font-semibold">Help</h1>
        <p className="text-sm text-muted-foreground">
          Short, plain-English explanations of everything in your portal.
        </p>
        <Link
          href="/dealer/dashboard?tour=1"
          className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          ▶ Replay guided tour
        </Link>
      </header>

      {topics.map((topic) => {
        const terms = Object.values(HELP).filter((t) => t.topic === topic);
        if (terms.length === 0) return null;
        return (
          <section key={topic} id={topicId(topic)} className="space-y-3 scroll-mt-20">
            <h2 className="text-sm font-semibold text-muted-foreground">{topic}</h2>
            <dl className="divide-y rounded-xl border border-border bg-card">
              {terms.map((t) => (
                <div key={t.id} className="px-4 py-3">
                  <dt className="text-sm font-medium">{t.label}</dt>
                  <dd className="mt-0.5 text-sm text-muted-foreground">{t.long ?? t.short}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Common questions</h2>
        <dl className="divide-y rounded-xl border border-border bg-card">
          {FAQ.map((f) => (
            <div key={f.q} className="px-4 py-3">
              <dt className="text-sm font-medium">{f.q}</dt>
              <dd className="mt-0.5 text-sm text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
