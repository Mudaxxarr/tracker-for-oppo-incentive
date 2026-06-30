import type { PreviewKey } from "./dealer-previews";

export interface TrialEntry {
  trialStartedAt: string; // ISO date
  trialUntil: string;     // ISO date
  purchased: boolean;
}

export type FeatureTrials = Partial<Record<PreviewKey, TrialEntry>>;

export function parseFeatureTrials(raw: string): FeatureTrials {
  try { return JSON.parse(raw) as FeatureTrials; }
  catch { return {}; }
}

export function serializeFeatureTrials(trials: FeatureTrials): string {
  return JSON.stringify(trials);
}

export function getTrialStatus(
  trials: FeatureTrials,
  key: PreviewKey,
  today = new Date().toISOString().slice(0, 10)
): "none" | "active" | "expired" | "purchased" {
  const entry = trials[key];
  if (!entry) return "none";
  if (entry.purchased) return "purchased";
  if (today <= entry.trialUntil) return "active";
  return "expired";
}

export function isTrialActive(trials: FeatureTrials, key: PreviewKey): boolean {
  const s = getTrialStatus(trials, key);
  return s === "active" || s === "purchased";
}

export function daysLeft(trialUntil: string, today = new Date().toISOString().slice(0, 10)): number {
  const ms = new Date(trialUntil).getTime() - new Date(today).getTime();
  return Math.max(0, Math.ceil(ms / 86400000));
}

export function buildTrialEntry(trialDays: number, today = new Date().toISOString().slice(0, 10)): TrialEntry {
  const until = new Date(new Date(today).getTime() + trialDays * 86400000)
    .toISOString()
    .slice(0, 10);
  return { trialStartedAt: today, trialUntil: until, purchased: false };
}
