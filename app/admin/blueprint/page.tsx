import { FEATURE_REGISTRY, ALL_REGISTRY_NODES, BADGE_LABEL, BADGE_COLOR } from "@/lib/feature-registry";
import { NAV_ITEMS } from "@/components/feature/nav-config";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

// Read-only "control tower" of how a feature travels Test → Admin → Dealers.
// The Admin + Dealers columns are derived LIVE from the nav config and the
// feature registry, so this page stays current on its own as those change.

const PIPELINE = [
  { icon: "🛠️", title: "Build", desc: "Naya feature apni branch pe — live app safe." },
  { icon: "🧪", title: "Test ID", desc: "Sandbox. Pehle yahan try — koi dealer affect nahi." },
  { icon: "🛡️", title: "Admin ID", desc: "Owner khud asli data pe confirm karta hai." },
  { icon: "🚀", title: "Push to Dealers", desc: "Teen tareeqon se dealers ko diya jaata." },
] as const;

const PUSH_MODES = [
  { swatch: "bg-violet-500", title: "Trial / Promo", en: "temp · 7 din", desc: "Thodi der free chalao — try kare, phir band ya kharido." },
  { swatch: "bg-primary", title: "Permanent", en: "always on", desc: "Hamesha ke liye on — included ya paid plan me." },
  { swatch: "bg-amber-500", title: "Direct to all", en: "broadcast", desc: "Ek saath sab dealers ko bhej do." },
] as const;

export default function BlueprintPage() {
  const includedTabs = FEATURE_REGISTRY.filter((g) => g.defaultOn);
  const paidNodes = ALL_REGISTRY_NODES.filter((n) => !n.defaultOn);
  const dealerCount = `${includedTabs.length} + ${paidNodes.length}`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Incento · Feature Rollout</p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-balance">How a new feature travels — Test → Admin → Dealers</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Har naya feature safe raaste se guzarta: pehle test, phir admin confirm, phir dealers. Ye page{" "}
          <span className="font-medium text-foreground">khud current rehta hai</span> — Admin aur Dealers columns live feature-registry se aate hain.
        </p>
        <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary ring-4 ring-primary/15" /> Live · auto-updates from the app
        </span>
      </header>

      {/* TL;DR flow */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-4 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">Ek line me — poori kahani</p>
        <div className="flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
          {[
            { e: "🛠️", t: "Bana", s: "naya feature" },
            { e: "🧪", t: "Test", s: "safe try" },
            { e: "🛡️", t: "Admin", s: "owner confirm" },
            { e: "🏪", t: "Dealers", s: "sab ko" },
          ].map((n, i, arr) => (
            <div key={n.t} className="flex items-center gap-2 sm:flex-col">
              <div className="flex flex-1 items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 sm:min-w-[92px] sm:flex-col sm:gap-1 sm:text-center">
                <span className="text-2xl leading-none">{n.e}</span>
                <span className="font-semibold leading-tight">{n.t}<span className="block text-[0.68rem] font-normal text-muted-foreground">{n.s}</span></span>
              </div>
              {i < arr.length - 1 ? <span className="rotate-90 font-mono text-lg font-bold text-primary sm:rotate-0">→</span> : null}
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline */}
      <section>
        <SectionHead num="01" title="The pipeline" sub="Feature ka safar — baayein se daayein." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PIPELINE.map((s, i) => (
            <div key={s.title} className="relative rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="font-mono text-[0.68rem] uppercase tracking-widest text-muted-foreground">Step 0{i + 1}</p>
              <p className="mt-1.5 text-xl leading-none">{s.icon}</p>
              <h3 className="mt-2 font-semibold">{s.title}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
              {i === PIPELINE.length - 1 ? (
                <div className="mt-3 space-y-1.5">
                  {PUSH_MODES.map((m) => (
                    <div key={m.title} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs">
                      <span className={cn("size-2 rounded-full", m.swatch)} />
                      <b className="font-semibold">{m.title}</b>
                      <span className="ml-auto font-mono text-[0.64rem] text-muted-foreground">{m.en}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* Right now board */}
      <section>
        <SectionHead num="02" title="Right now — kis ke paas kya hai" sub="Aaj ke din har stage pe mojood features (live)." />
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Test */}
          <StageCard accent="border-t-amber-500" icon="🧪" name="Test ID" count="0" pill={{ label: "Sandbox", cls: "bg-amber-500/10 text-amber-600" }} sub="Naye features ki pehli jagah.">
            <div className="rounded-lg border border-dashed border-amber-500 bg-amber-500/10 p-3 text-sm leading-relaxed text-muted-foreground">
              <b className="text-amber-600">Abhi bana nahi.</b> Test ID (alag dealer login) create hote hi naye features pehle yahan aayenge — phir Admin, phir Dealers.
            </div>
          </StageCard>

          {/* Admin (live from NAV_ITEMS) */}
          <StageCard accent="border-t-primary" icon="🛡️" name="Admin ID" count={`${NAV_ITEMS.length} tabs`} pill={{ label: "Live", cls: "bg-primary/10 text-primary" }} sub="Owner portal — live tabs.">
            <div className="space-y-1.5">
              {NAV_ITEMS.map((t) => (
                <FeatRow key={t.href} name={t.label} />
              ))}
            </div>
          </StageCard>

          {/* Dealers (live from FEATURE_REGISTRY) */}
          <StageCard accent="border-t-violet-500" icon="🏪" name="Dealers" count={dealerCount} pill={{ label: "Per-dealer", cls: "bg-violet-500/10 text-violet-600" }} sub="Har dealer ko diye features.">
            <p className="mb-1 mt-1 font-mono text-[0.66rem] uppercase tracking-wider text-muted-foreground">Included — sab dealers ko</p>
            <div className="space-y-1.5">
              {includedTabs.map((g) => (
                <FeatRow key={g.key} name={g.label} note={g.children.length > 0 ? `+ ${g.children.length} sub` : undefined} />
              ))}
            </div>
            <p className="mb-1 mt-3 font-mono text-[0.66rem] uppercase tracking-wider text-muted-foreground">Paid add-ons — jab do tab</p>
            <div className="space-y-1.5">
              {paidNodes.map((n) => (
                <FeatRow
                  key={n.key}
                  name={n.label}
                  badge={n.badge ? { label: BADGE_LABEL[n.badge], cls: BADGE_COLOR[n.badge] } : undefined}
                  price={n.monthlyPrice != null ? `${formatPKR(n.monthlyPrice)}/mo` : "free"}
                />
              ))}
            </div>
          </StageCard>
        </div>
      </section>

      {/* Push modes */}
      <section>
        <SectionHead num="03" title="Dealers ko push karne ke 3 tareeqe" sub="Admin se confirm hone ke baad — koi ek chuno." />
        <div className="grid gap-3 sm:grid-cols-3">
          {PUSH_MODES.map((m) => (
            <div key={m.title} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={cn("size-3 rounded", m.swatch)} />
                <h4 className="font-semibold">{m.title}</h4>
                <span className="ml-auto font-mono text-[0.64rem] text-muted-foreground">{m.en}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
        <span className="font-mono">Incento · Alhamd Sales Console</span>
        <span>Admin/Dealers columns live registry se — koi manual update nahi.</span>
      </footer>
    </div>
  );
}

function SectionHead({ num, title, sub }: { num: string; title: string; sub: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
      <span className="rounded-md border border-border bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">{num}</span>
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      <p className="basis-full text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

function StageCard({
  accent,
  icon,
  name,
  count,
  pill,
  sub,
  children,
}: {
  accent: string;
  icon: string;
  name: string;
  count: string;
  pill: { label: string; cls: string };
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border border-t-[3px] bg-card shadow-sm", accent)}>
      <div className="border-b border-border px-4 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <h3 className="font-semibold">{name}</h3>
          <span className="ml-auto rounded-full border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-muted-foreground">{count}</span>
          <span className={cn("rounded-full px-2 py-0.5 font-mono text-[0.62rem] font-semibold uppercase tracking-wide", pill.cls)}>{pill.label}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function FeatRow({ name, note, price, badge }: { name: string; note?: string; price?: string; badge?: { label: string; cls: string } }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium">{name}</span>
        {note ? <span className="shrink-0 rounded bg-border/60 px-1.5 py-0.5 font-mono text-[0.58rem] uppercase text-muted-foreground">{note}</span> : null}
        {badge ? <span className={cn("shrink-0 rounded px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase", badge.cls)}>{badge.label}</span> : null}
      </span>
      {price ? <span className="shrink-0 font-mono text-xs tabular-nums text-amber-600 dark:text-amber-500">{price}</span> : null}
    </div>
  );
}
