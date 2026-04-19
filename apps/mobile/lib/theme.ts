// TruthStay design system — warm adventure aesthetic
// Coral primary · Ocean secondary · Sand neutrals · Dark feed mode

export const colors = {
  // Backgrounds
  bg: "#FFFDF9",        // Cream
  card: "#FFFFFF",
  sheet: "#F5E6D3",     // Sand

  // Text
  text: "#2D3142",      // Charcoal
  muted: "#8E8D8A",     // Warm grey
  subtle: "#B0AFA9",
  inverse: "#FFFFFF",

  // Primary — Coral
  accent: "#E8694A",
  accentLight: "#FDE8E2",
  accentMid: "#C4522A",

  // Secondary — Ocean
  ocean: "#1B6B7D",
  oceanLight: "#E0F2F5",
  oceanMid: "#0E4A57",

  // Named brand palette
  coral: "#E8694A",
  sage: "#8BAF7C",
  sky: "#6BB5D6",
  gold: "#D4A853",
  sand: "#F5E6D3",
  midnight: "#1A1F2E",

  // UI
  border: "#E8E6E1",
  inputBg: "#F5E6D3",
  overlay: "rgba(0,0,0,0.45)",

  // Feed (full-screen dark mode)
  feedBg: "#0D0D0D",
  feedCard: "#1C1C1C",
  feedMuted: "rgba(255,255,255,0.6)",

  // Difficulty
  easy: "#8BAF7C",      // Sage
  intermediate: "#D4A853", // Gold
  hard: "#E8694A",      // Coral

  // Chat bubbles
  aiBubble: "#F5E6D3",
  userBubble: "#2D3142",

  // Activity colours for pins/icons
  cycling: "#1B6B7D",   // Ocean
  hiking: "#8BAF7C",    // Sage
  climbing: "#E8694A",  // Coral
  trailRunning: "#D4A853", // Gold
  skiing: "#1B6B7D",    // Ocean
  mtb: "#8BAF7C",       // Sage
  kayaking: "#1B6B7D",  // Ocean
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

// Font families — loaded via expo-google-fonts in app/_layout.tsx
export const fonts = {
  display: "DMSerifDisplay_400Regular",
  displayItalic: "DMSerifDisplay_400Regular_Italic",
  sans: "PlusJakartaSans_400Regular",
  sansMedium: "PlusJakartaSans_500Medium",
  sansSemiBold: "PlusJakartaSans_600SemiBold",
  sansBold: "PlusJakartaSans_700Bold",
  sansExtraBold: "PlusJakartaSans_800ExtraBold",
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
