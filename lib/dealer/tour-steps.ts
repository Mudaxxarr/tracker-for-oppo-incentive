export const TOUR_DATA_KEYS = [
  "net-payout",
  "earnings-chart",
  "quick-actions",
  "main-nav",
  "help-button",
] as const;

export type TourDataKey = (typeof TOUR_DATA_KEYS)[number];

export interface TourStep {
  element?: string; // CSS selector like [data-tour="net-payout"]; omit for centered modal
  title: string;
  description: string;
}

export const TOUR_STEPS: TourStep[] = [
  { title: "Welcome 👋", description: "Here is a quick 30-second tour of your dashboard." },
  { element: '[data-tour="net-payout"]', title: "Your net payout",
    description: "The money the company owes you — bonuses added, fines removed." },
  { element: '[data-tour="earnings-chart"]', title: "Earnings graph",
    description: "Your last 6 months of earnings at a glance." },
  { element: '[data-tour="quick-actions"]', title: "Add your work here",
    description: "Tap here to add a new activation or a new purchase." },
  { element: '[data-tour="main-nav"]', title: "Everything else",
    description: "Stock, reports and cross-region all live in this menu." },
  { element: '[data-tour="help-button"]', title: "Stuck? Tap Help",
    description: 'This "?" opens Help any time — you can replay this tour from there too.' },
  { title: "You're ready! 🎉", description: "That's it. Explore freely — Help is always one tap away." },
];
