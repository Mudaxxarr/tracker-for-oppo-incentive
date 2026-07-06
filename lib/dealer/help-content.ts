export type HelpTopic = "Money" | "Stock" | "Activations" | "Cross-region" | "Reports";

export interface HelpTerm {
  id: string;
  label: string;   // simple on-screen label
  short: string;   // one-line tooltip
  long?: string;   // fuller Help-page text
  topic: HelpTopic;
}

export const HELP: Record<string, HelpTerm> = {
  "net-receivable": { id: "net-receivable", label: "Your net payout", topic: "Money",
    short: "Money the company owes you after bonuses are added and fines removed.",
    long: "This is your final take-home for the period: every bonus you earned, plus price-drop refunds, minus any cross-region fines or deductions." },
  "gross-receivable": { id: "gross-receivable", label: "Total before fines", topic: "Money",
    short: "Everything you earned before any fines are subtracted." },
  "incentive-earned": { id: "incentive-earned", label: "Bonus earned", topic: "Money",
    short: "Your total bonus before price-drop refunds and fines." },
  "base-incentive": { id: "base-incentive", label: "Base bonus %", topic: "Money",
    short: "Your standard bonus percentage on each activation." },
  "stock-in-incentive": { id: "stock-in-incentive", label: "Stock bonus", topic: "Money",
    short: "Bonus for buying qualifying stock." },
  "activation-incentive": { id: "activation-incentive", label: "Activation bonus", topic: "Money",
    short: "Bonus earned per qualifying activation." },
  "dealer-incentive": { id: "dealer-incentive", label: "Dealer bonus", topic: "Money",
    short: "Your dealer-level bonus based on total activations." },
  "price-drop-rebate": { id: "price-drop-rebate", label: "Price-drop refund", topic: "Money",
    short: "Refund you get when a phone's dealer price dropped after you stocked it." },
  "cr-fines": { id: "cr-fines", label: "Fines & deductions", topic: "Cross-region",
    short: "Amounts subtracted for cross-region catches or penalties." },
  "cr-exposure": { id: "cr-exposure", label: "At-risk amount", topic: "Cross-region",
    short: "Money at risk from cross-region phones that may be flagged.",
    long: "Cross-region phones (sold outside your region) can be caught and fined. This is the bonus money that could be reversed if that happens." },
  "target-gap": { id: "target-gap", label: "Units left to target", topic: "Activations",
    short: "How many more activations you need to hit your target bonus." },
  "today-activations": { id: "today-activations", label: "Activations today", topic: "Activations",
    short: "Phones you activated today." },
  "sell-through": { id: "sell-through", label: "Sold vs stock", topic: "Stock",
    short: "The share of your available phones that you have already sold." },
  "stock-value": { id: "stock-value", label: "Stock value", topic: "Stock",
    short: "Total worth of the phones you have on hand right now." },
  "aged-stock": { id: "aged-stock", label: "Old stock (30+ days)", topic: "Stock",
    short: "Stock that has stayed unsold for more than 30 days." },
};

export function getHelp(id: string): HelpTerm | undefined {
  return HELP[id];
}

export function topicId(topic: HelpTopic): string {
  return topic.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
