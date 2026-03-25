export const ACTIVITY_TYPES = [
  "cycling",
  "hiking",
  "trail_running",
  "skiing",
  "snowboarding",
  "kayaking",
  "climbing",
  "other",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];
