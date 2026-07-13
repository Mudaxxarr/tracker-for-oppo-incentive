import type { DealerFeatures } from "../dealer-features";
import { ALL_REGISTRY_NODES } from "../feature-registry";

const LOCAL_ORIGIN = "https://incento.local";

function safeLocalPath(value: unknown, allowedRoots: readonly string[]): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null;

  try {
    const url = new URL(value, LOCAL_ORIGIN);
    if (url.origin !== LOCAL_ORIGIN) return null;
    if (
      !allowedRoots.some(
        (root) => url.pathname === root || url.pathname.startsWith(`${root}/`),
      )
    ) {
      return null;
    }
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export function resolveLoginRedirect(value: unknown): string {
  return safeLocalPath(value, ["/dashboard", "/admin", "/manager"]) ?? "/dashboard";
}

export function resolveManagerReturnPath(value: unknown, tenantId?: string): string {
  const fallback = tenantId ? `/manager/${encodeURIComponent(tenantId)}` : "/manager";
  return safeLocalPath(value, ["/manager"]) ?? fallback;
}

export function mergeManagerFeatureFlags(
  existing: DealerFeatures,
  enabledKeys: ReadonlySet<string>,
): DealerFeatures {
  const next = { ...existing } as Record<string, boolean>;

  for (const node of ALL_REGISTRY_NODES) {
    if (enabledKeys.has(node.key)) {
      next[node.key] = true;
    } else if (node.defaultOn) {
      next[node.key] = false;
    } else {
      delete next[node.key];
    }
  }

  return next as DealerFeatures;
}
