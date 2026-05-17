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
  SHIFTED_TO_MY_ID: "SHIFTED_TO_MY_ID",
  REJECTED: "REJECTED",
} as const;
export type CrossRegionStatus = (typeof CROSS_REGION_STATUS)[keyof typeof CROSS_REGION_STATUS];

export const INTER_ID_STATUS = {
  PENDING:  "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
} as const;
export type InterIdStatus = (typeof INTER_ID_STATUS)[keyof typeof INTER_ID_STATUS];

export const SESSION_COOKIE = "oppo_session";
export const TEAM_SESSION_COOKIE = "oppo_team_session";
export const DEALER_SESSION_COOKIE = "dealer_session";
export const DEALER_ACTIVE_ID_COOKIE = "dealer_active_id";
