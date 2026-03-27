// TruthStay design system — outdoor/adventure aesthetic
// Warm neutrals + deep forest green accent + dark feed mode

export const colors = {
  // Backgrounds
  bg: "#F5F4EF",        // Warm parchment
  card: "#FFFFFF",
  sheet: "#EDECEA",     // Grouped section bg

  // Text
  text: "#1A1A1A",
  muted: "#717182",
  subtle: "#A0A0AA",
  inverse: "#FFFFFF",

  // Accent — deep forest green
  accent: "#2A5C3E",
  accentLight: "#E8F2EC",
  accentMid: "#4A8C64",

  // UI
  border: "#E2E0D6",
  inputBg: "#ECEAE3",
  overlay: "rgba(0,0,0,0.45)",

  // Feed (full-screen dark mode)
  feedBg: "#0D0D0D",
  feedCard: "#1C1C1C",
  feedMuted: "rgba(255,255,255,0.6)",

  // Difficulty
  easy: "#22C55E",
  intermediate: "#F59E0B",
  hard: "#EF4444",

  // Chat bubbles
  aiBubble: "#ECEAE3",
  userBubble: "#1A1A1A",

  // Activity colours for pins/icons
  cycling: "#3B82F6",
  hiking: "#22C55E",
  climbing: "#A78BFA",
  trailRunning: "#F97316",
  skiing: "#60A5FA",
  mtb: "#84CC16",
  kayaking: "#06B6D4",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
  xxxl: 34,
};

export const shadow = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
};

// Activity icon map — emoji fallback until we add a vector icon library
export const ACTIVITY_EMOJI: Record<string, string> = {
  cycling: "🚴",
  mtb: "🚵",
  hiking: "🥾",
  trail_running: "🏃",
  climbing: "🧗",
  skiing: "⛷️",
  kayaking: "🛶",
  other: "🏔️",
};

export const ACTIVITY_COLOR: Record<string, string> = {
  cycling: colors.cycling,
  mtb: colors.mtb,
  hiking: colors.hiking,
  trail_running: colors.trailRunning,
  climbing: colors.climbing,
  skiing: colors.skiing,
  kayaking: colors.kayaking,
  other: colors.accent,
};

export const DIFFICULTY_COLOR: Record<string, string> = {
  easy: colors.easy,
  moderate: colors.intermediate,
  intermediate: colors.intermediate,
  hard: colors.hard,
  advanced: colors.hard,
};
