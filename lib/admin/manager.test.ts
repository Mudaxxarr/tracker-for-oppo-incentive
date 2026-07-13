import { describe, expect, it } from "vitest";

import {
  mergeManagerFeatureFlags,
  resolveLoginRedirect,
  resolveManagerReturnPath,
} from "./manager";

describe("resolveLoginRedirect", () => {
  it("keeps supported same-origin destinations", () => {
    expect(resolveLoginRedirect("/manager")).toBe("/manager");
    expect(resolveLoginRedirect("/manager/tenant-1?saved=features")).toBe(
      "/manager/tenant-1?saved=features",
    );
    expect(resolveLoginRedirect("/admin/dealers")).toBe("/admin/dealers");
  });

  it("rejects external and unsupported destinations", () => {
    expect(resolveLoginRedirect("https://example.com/steal")).toBe("/dashboard");
    expect(resolveLoginRedirect("//example.com/steal")).toBe("/dashboard");
    expect(resolveLoginRedirect("/dealer/dashboard")).toBe("/dashboard");
    expect(resolveLoginRedirect(null)).toBe("/dashboard");
  });
});

describe("resolveManagerReturnPath", () => {
  it("only accepts manager routes", () => {
    expect(resolveManagerReturnPath("/manager/tenant-1", "tenant-1")).toBe(
      "/manager/tenant-1",
    );
    expect(resolveManagerReturnPath("/admin", "tenant-1")).toBe(
      "/manager/tenant-1",
    );
  });
});

describe("mergeManagerFeatureFlags", () => {
  it("applies all registry toggles while preserving unrelated stored flags", () => {
    const existing = {
      activations: true,
      act_overview: true,
      legacy_private_flag: true,
    };

    const result = mergeManagerFeatureFlags(
      existing,
      new Set(["reports", "addon_excel"]),
    ) as Record<string, boolean>;

    expect(result.activations).toBe(false);
    expect(result.reports).toBe(true);
    expect(result.addon_excel).toBe(true);
    expect(result.act_overview).toBeUndefined();
    expect(result.legacy_private_flag).toBe(true);
  });

  it("does not mutate the stored feature object", () => {
    const existing = { reports: true };
    mergeManagerFeatureFlags(existing, new Set());
    expect(existing).toEqual({ reports: true });
  });
});
