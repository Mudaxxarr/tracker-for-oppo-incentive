import { describe, expect, it } from "vitest";
import { TOUR_STEPS, TOUR_DATA_KEYS } from "@/lib/dealer/tour-steps";

describe("dealer guided-tour steps", () => {
  it("first and last steps are element-less (welcome + done modals)", () => {
    expect(TOUR_STEPS[0].element).toBeUndefined();
    expect(TOUR_STEPS.at(-1)!.element).toBeUndefined();
  });
  it("every element selector references a known data-tour key", () => {
    for (const step of TOUR_STEPS) {
      if (!step.element) continue;
      const m = step.element.match(/^\[data-tour="(.+)"\]$/);
      expect(m, `bad selector: ${step.element}`).not.toBeNull();
      expect(TOUR_DATA_KEYS).toContain(m![1] as (typeof TOUR_DATA_KEYS)[number]);
    }
  });
  it("every step has a title and description", () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.description.length).toBeGreaterThan(0);
    }
  });
});
