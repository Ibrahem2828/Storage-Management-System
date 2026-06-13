export const ASSIGNMENT_STATUS = {
  ACTIVE: "ACTIVE",
  RETURNED: "RETURNED",
} as const;

export const ASSIGNMENT_STATUSES = Object.values(ASSIGNMENT_STATUS);

export type AssignmentStatus =
  (typeof ASSIGNMENT_STATUS)[keyof typeof ASSIGNMENT_STATUS];
