// TruthStay design system — v2 brand guidelines
// Blue primary · Green secondary · Navy · Grey 50 neutrals · Dark feed mode

export const colors = {
  // Backgrounds
  bg: "#F8F9FA",        // Grey 50
  card: "#FFFFFF",
  sheet: "#F1F3F4",     // Grey 100

  // Text
  text: "#1A1D23",      // Dark
  muted: "#5F6368",     // Grey 700
  subtle: "#9AA0A6",    // Grey 500
  inverse: "#FFFFFF",

  // Primary — TruthStay Blue
  accent: "#0A7AFF",
  accentLight: "#E8F1FF",
  accentMid: "#0059BF",

  // Secondary — Green
  ocean: "#2ECDA7",     // Green (name kept for compat)
  oceanLight: "#E0FBF2",
  oceanMid: "#00B87D",

  // Named brand palette
  coral: "#0A7AFF",     // alias → blue (kept for compat)
  sage: "#2ECDA7",      // teal green
  sky: "#5BC8D6",       // blend cyan
  gold: "#D4A853",      // warm accent — used for difficulty/activity
  sand: "#F5F0E8",      // brand sand
  midnight: "#0F2A4A",  // navy

  // v2 brand tokens
  blend: "#5BC8D6",
  navy: "#0F2A4A",
  navyLight: "#1C3D5F",

  // UI
  border: "#DADCE0",    // Grey 300
  inputBg: "#F1F3F4",   // Grey 100
  overlay: "rgba(0,0,0,0.45)",

  // Feed (full-screen dark mode)
  feedBg: "#0D0D0D",
  feedCard: "#1C1C1C",
  feedMuted: "rgba(255,255,255,0.6)",

  // Difficulty
  easy: "#2ECDA7",      // Green
  intermediate: "#D4A853", // Gold
  hard: "#0059BF",      // Blue Dark

  // Chat bubbles
  aiBubble: "#F1F3F4",
  userBubble: "#1A1D23",

  // Activity colours for pins/icons
  cycling: "#0A7AFF",      // Blue
  hiking: "#2ECDA7",       // Green
  climbing: "#0059BF",     // Blue Dark
  trailRunning: "#5BC8D6", // Blend
  skiing: "#1C3D5F",       // Navy Light
  mtb: "#00B87D",          // Green Dark
  kayaking: "#2ECDA7",     // Green
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
  display: "Outfit_700Bold",
  displayItalic: "Outfit_400Regular",
  sans: "Sora_400Regular",
  sansMedium: "Sora_500Medium",
  sansSemiBold: "Sora_600SemiBold",
  sansBold: "Sora_700Bold",
  sansExtraBold: "Sora_800ExtraBold",
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
