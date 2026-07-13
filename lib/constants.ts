export const APP_NAME = "Alhamd Telecom — OPPO ID Tracker";
export const BASE_INCENTIVE_PERCENT = 4;
export const DEFAULT_TARGET_BONUS_PERCENT = 1;

export const PURCHASE_SOURCE = {
  REGULAR: "REGULAR",
  CROSS_REGION_TRANSFER_IN: "CROSS_REGION_TRANSFER_IN",
} as const;
export type PurchaseSource = (typeof PURCHASE_SOURCE)[keyof typeof PURCHASE_SOURCE];

export const CROSS_REGION_STATUS = {
  PENDING_REPORT: "PENDING_REPORT",
  PENDING_OWNER_APPROVAL: "PENDING_OWNER_APPROVAL",
  SHIFTED_TO_MY_ID: "SHIFTED_TO_MY_ID",
  REJECTED: "REJECTED",
} as const;
export type CrossRegionStatus = (typeof CROSS_REGION_STATUS)[keyof typeof CROSS_REGION_STATUS];

export const PURCHASE_REVIEW_STATUS = {
  ACTIVE: "active",
  PENDING_REVIEW: "pending_review",
  APPROVED: "approved",
} as const;
export type PurchaseReviewStatus = (typeof PURCHASE_REVIEW_STATUS)[keyof typeof PURCHASE_REVIEW_STATUS];

export const OWNER_ALERT_TYPE = {
  CR_PENDING_APPROVAL: "cr_pending_approval",
  PURCHASE_PENDING_REVIEW: "purchase_pending_review",
  CR_CAUGHT_PENDING_APPROVAL: "cr_caught_pending_approval",
  ACTIVATION_DELETION_REQUEST: "activation_deletion_request",
} as const;

export const INTER_ID_STATUS = {
  PENDING:  "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
} as const;
export type InterIdStatus = (typeof INTER_ID_STATUS)[keyof typeof INTER_ID_STATUS];

export const WARRANTY_CLAIM_STATUS = {
  PENDING: "pending",
  IN_REPAIR: "in_repair",
  RESOLVED: "resolved",
  REJECTED: "rejected",
} as const;
export type WarrantyClaimStatus = (typeof WARRANTY_CLAIM_STATUS)[keyof typeof WARRANTY_CLAIM_STATUS];

export const SESSION_COOKIE = "oppo_session";
export const TEAM_SESSION_COOKIE = "oppo_team_session";
export const DEALER_SESSION_COOKIE = "dealer_session";
export const DEALER_ACTIVE_ID_COOKIE = "dealer_active_id";
export const OWNER_STAFF_SESSION_COOKIE = "oppo_staff_session";
export const ADMIN_PREVIEW_RETURN_COOKIE = "oppo_admin_preview_return";

export type StaffRole = "so" | "accountant";

export const DEALER_TEAM_LIMIT = 2;

/** Sandbox dealer tenant used by the owner's "Dealer View" preview switcher.
 *  New dealer-facing features are tried here before real dealers get them. */
export const TEST_SANDBOX_TENANT_ID = "b861c17d-adea-4843-803f-903fbe87aa22";
