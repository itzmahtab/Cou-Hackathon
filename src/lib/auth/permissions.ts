import type { AdminRole } from "../db/schema";

export const PERMISSIONS = [
  "registrations.read",
  "registrations.contact",
  "registrations.write",
  "registrations.export",
  "reviews.read",
  "reviews.write",
  "shortlist.read",
  "shortlist.manage",
  "shortlist.override",
  "shortlist.finalise",
  "payments.verify",
  "event.manage",
  "results.manage",
  "results.publish",
  "emails.manage",
  "emails.broadcast",
  "settings.manage",
  "admins.manage",
  "logs.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  REGISTRATION_ADMIN: [
    "registrations.read",
    "registrations.contact",
    "registrations.write",
    "registrations.export",
    "shortlist.read",
    "event.manage",
    "emails.manage",
  ],
  REVIEWER: ["reviews.read", "reviews.write", "shortlist.read", "shortlist.manage"],
  PAYMENT_ADMIN: ["registrations.read", "payments.verify"],
  RESULTS_ADMIN: ["registrations.read", "results.manage", "results.publish"],
};

export function can(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super admin",
  REGISTRATION_ADMIN: "Registration admin",
  REVIEWER: "Reviewer",
  PAYMENT_ADMIN: "Payment admin",
  RESULTS_ADMIN: "Results admin",
};
