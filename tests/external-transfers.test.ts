import { describe, expect, it } from "vitest";
import { netExternalDelta } from "@/lib/stock/external-delta";

describe("netExternalDelta", () => {
  it("adds IN and subtracts OUT", () => {
    expect(netExternalDelta([
      { direction: "IN", quantity: 12 },
      { direction: "OUT", quantity: 5 },
      { direction: "IN", quantity: 3 },
    ])).toBe(10); // 12 + 3 - 5
  });

  it("is zero for no rows", () => {
    expect(netExternalDelta([])).toBe(0);
  });

  it("can go negative when more went out than came in", () => {
    expect(netExternalDelta([
      { direction: "IN", quantity: 2 },
      { direction: "OUT", quantity: 9 },
    ])).toBe(-7);
  });

  it("ignores any unknown direction rather than trusting it", () => {
    expect(netExternalDelta([
      { direction: "IN", quantity: 4 },
      { direction: "SIDEWAYS", quantity: 100 },
    ])).toBe(4);
  });
});
