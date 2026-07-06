import { describe, expect, it } from "vitest";
import { HELP, getHelp, topicId } from "@/lib/dealer/help-content";

describe("dealer help-content registry", () => {
  it("every entry's map key matches its id", () => {
    for (const [key, entry] of Object.entries(HELP)) expect(entry.id).toBe(key);
  });
  it("every entry has non-empty label, short and topic", () => {
    for (const entry of Object.values(HELP)) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.short.length).toBeGreaterThan(0);
      expect(entry.topic.length).toBeGreaterThan(0);
    }
  });
  it("getHelp returns undefined for unknown ids", () => {
    expect(getHelp("does-not-exist")).toBeUndefined();
  });
  it("topicId slugifies a topic", () => {
    expect(topicId("Cross-region")).toBe("cross-region");
  });
});
