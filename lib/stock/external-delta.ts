/**
 * Pure stock arithmetic for external transfers — kept out of the server-only query
 * module so it can be unit-tested directly.
 */
export const EXTERNAL_DIRECTION = { IN: "IN", OUT: "OUT" } as const;
export type ExternalDirection = (typeof EXTERNAL_DIRECTION)[keyof typeof EXTERNAL_DIRECTION];

/**
 * Net physical-stock effect of a set of external transfers: IN adds, OUT subtracts,
 * anything else is ignored rather than trusted.
 */
export function netExternalDelta(rows: { direction: string; quantity: number }[]): number {
  let net = 0;
  for (const r of rows) {
    if (r.direction === EXTERNAL_DIRECTION.IN) net += r.quantity;
    else if (r.direction === EXTERNAL_DIRECTION.OUT) net -= r.quantity;
  }
  return net;
}
