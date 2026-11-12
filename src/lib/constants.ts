/** Shared enumerations. Kept free of server imports so client components can use them. */
export const ADMIN_ROLES = ["SUPER_ADMIN", "REGISTRATION_ADMIN", "REVIEWER", "PAYMENT_ADMIN", "RESULTS_ADMIN"] as const;
export const TEAM_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "NOT_SELECTED", "CONFIRMED", "DISQUALIFIED"] as const;
export const TSHIRT_SIZES = ["S", "M", "L", "XL", "XXL", "XXXL"] as const;
export const FILE_CATEGORIES = ["STUDENT_ID", "IDEA_DOC", "PAYMENT_SCREENSHOT"] as const;
export const PAYMENT_PROVIDERS = ["BKASH", "NAGAD"] as const;
export const PAYMENT_STATUSES = ["PENDING_VERIFICATION", "VERIFIED", "REJECTED"] as const;
export const EMAIL_STATUSES = ["QUEUED", "SENT", "FAILED", "DEAD"] as const;
export const POSITIONS = ["CHAMPION", "FIRST_RUNNER_UP", "SECOND_RUNNER_UP"] as const;
