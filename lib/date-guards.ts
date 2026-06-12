import "server-only";
import { todayPKT } from "./format";

/**
 * Shared date validation for all portals.
 * Both owner and dealer portals import from here — one fix covers both.
 */

/** Returns an error string, or null if the date is valid. */
export function guardActivationDate(date: string): string | null {
  if (date > todayPKT()) return "Activation date cannot be in the future.";
  return null;
}

/** Returns an error string, or null if the date is valid.
 *  Pass backdateDays to enforce a minimum look-back window (dealer portal).
 *  Omit or pass undefined to only block future dates (owner portal). */
export function guardPurchaseDate(date: string, backdateDays?: number): string | null {
  const today = new Date().toISOString().slice(0, 10);
  if (date > today) return "Purchase date cannot be in the future.";
  if (backdateDays !== undefined) {
    const minDate = new Date(Date.now() - backdateDays * 86400000).toISOString().slice(0, 10);
    if (date < minDate) return `Purchase date cannot be more than ${backdateDays} day(s) in the past.`;
  }
  return null;
}
