import {
  Linking, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fontSize, radius, spacing, DIFFICULTY_COLOR } from "../lib/theme";
import type { RouteAlternative } from "../lib/adventure-types";

// ─── Activity config ──────────────────────────────────────────────────────────

const ACTIVITY_GRADIENT: Record<string, [string, string]> = {
  cycling:      ["#60A5FA", "#1D4ED8"],
  mtb:          ["#86EFAC", "#15803D"],
  hiking:       ["#4ADE80", "#166534"],
  trail_running:["#FB923C", "#C2410C"],
  climbing:     ["#C084FC", "#7E22CE"],
  skiing:       ["#93C5FD", "#1E40AF"],
  kayaking:     ["#22D3EE", "#0E7490"],
  other:        ["#9CA3AF", "#374151"],
};

const ACTIVITY_LABEL: Record<string, string> = {
  cycling: "Road", mtb: "MTB", hiking: "Hiking", trail_running: "Trail",
  climbing: "Climbing", skiing: "Skiing", kayaking: "Kayaking", other: "Route",
};

const KOMOOT_SPORT: Record<string, string> = {
  cycling: "racebike", mtb: "mtb", hiking: "hike",
  trail_running: "trailrunning", climbing: "mountaineering",
  skiing: "skiing", kayaking: "kayaking", other: "hike",
};

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easier", moderate: "Main route", hard: "Harder",
};

// ─── Elevation profile ────────────────────────────────────────────────────────

/** Draws a simple silhouette based on difficulty shape — no real GPX needed */
function ElevationProfile({ difficulty }: { difficulty: string }) {
  const BARS = 22;
  const MAX_H = 32;

  const heights = Array.from({ length: BARS }, (_, i) => {
    const t = i / (BARS - 1);
    let h: number;
    if (difficulty === "easy") {
      h = 0.15 + 0.25 * Math.sin(t * Math.PI * 2.5 + 0.3);
    } else if (difficulty === "hard") {
      h = 0.15 + 0.7 * Math.pow(Math.sin(t * Math.PI * 2.8), 2);
    } else {
      // moderate / main — single clean arc
      h = 0.1 + 0.82 * Math.sin(t * Math.PI);
    }
    return Math.max(0.08, h) * MAX_H;
  });

  return (
    <View style={profileStyles.wrap}>
      {heights.map((h, i) => (
        <View key={i} style={[profileStyles.bar, { height: h }]} />
      ))}
    </View>
  );
}

const profileStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 32,
    gap: 1.5,
    paddingHorizontal: spacing.sm,
    paddingBottom: 2,
  },
  bar: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.45)",
    borderRadius: 1,
  },
});

// ─── RouteTile ────────────────────────────────────────────────────────────────

interface Props {
  label: "Main" | "Easier" | "Harder";
  title: string;
  distanceKm: number | null;
  elevationM: number | null;
  difficulty: RouteAlternative["difficulty"] | "moderate";
  description: string;
  endLocation: string;
  activityType?: string;
  region?: string;
  isSelected: boolean;
  onSelect: () => void;
}

function komootUrl(region: string, activityType: string): string {
  const sport = KOMOOT_SPORT[activityType] ?? "hike";
  return `https://www.komoot.com/discover/${encodeURIComponent(region)}?sport=${sport}`;
}

export function RouteTile({
  label, title, distanceKm, elevationM, difficulty,
  description, endLocation, activityType = "other", region = "",
  isSelected, onSelect,
}: Props) {
  const gradient = ACTIVITY_GRADIENT[activityType] ?? ACTIVITY_GRADIENT.other;
  const activityLabel = ACTIVITY_LABEL[activityType] ?? "Route";
  const diffColor = DIFFICULTY_COLOR[difficulty] ?? colors.muted;
  const diffLabel = DIFFICULTY_LABEL[difficulty] ?? label;

  const handleKomoot = () => {
    if (!region) return;
    Linking.openURL(komootUrl(region, activityType));
  };

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onSelect}
      activeOpacity={0.88}
    >
      {/* Left: activity gradient + elevation silhouette */}
      <View style={styles.imageWrap}>
        <LinearGradient
          colors={gradient}
          style={styles.imagePlaceholder}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.4, y: 1 }}
        >
          {/* Activity label */}
          <Text style={styles.activityLabel}>{activityLabel}</Text>

          {/* Elevation silhouette at the bottom */}
          <View style={styles.profileWrap}>
            <ElevationProfile difficulty={difficulty} />
          </View>
        </LinearGradient>

        {/* Difficulty badge top-left */}
        <View style={[styles.diffBadge, { borderColor: diffColor }]}>
          <Text style={[styles.diffText, { color: diffColor }]}>{diffLabel}</Text>
        </View>

        {/* Selected checkmark top-right */}
        {isSelected && (
          <View style={styles.checkCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
        )}
      </View>

      {/* Right: content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {distanceKm ? (
            <View style={styles.statChip}>
              <Text style={styles.statText}>{distanceKm} km</Text>
            </View>
          ) : null}
          {elevationM ? (
            <View style={styles.statChip}>
              <Text style={styles.statText}>{elevationM} m ↑</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.description} numberOfLines={3}>{description}</Text>

        {endLocation ? (
          <View style={styles.locationRow}>
            <Text style={styles.locationDot}>📍</Text>
            <Text style={styles.locationText} numberOfLines={1}>Ends: {endLocation}</Text>
          </View>
        ) : null}

        {/* Komoot link */}
        {region ? (
          <TouchableOpacity
            style={styles.komootBtn}
            onPress={(e) => { e.stopPropagation?.(); handleKomoot(); }}
            activeOpacity={0.75}
          >
            <Text style={styles.komootText}>View on Komoot →</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const IMG_WIDTH = 110;

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: "hidden",
  },
  cardSelected: {
    borderColor: colors.accent,
    borderWidth: 2,
  },

  // ── Image / gradient block ───────────────────────────────────────────────────
  imageWrap: {
    width: IMG_WIDTH,
    position: "relative",
    overflow: "hidden",
  },
  imagePlaceholder: {
    width: IMG_WIDTH,
    flex: 1,
    minHeight: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  activityLabel: {
    fontSize: fontSize.lg,
    fontWeight: "800",
    color: "rgba(255,255,255,0.95)",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  profileWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  diffBadge: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  diffText: {
    fontSize: fontSize.xs - 1,
    fontWeight: "700",
  },
  checkCircle: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    fontSize: 11,
    color: colors.inverse,
    fontWeight: "800",
  },

  // ── Content ──────────────────────────────────────────────────────────────────
  content: {
    flex: 1,
    padding: spacing.sm + 2,
    gap: spacing.xs,
    justifyContent: "flex-start",
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  statChip: {
    backgroundColor: colors.sheet,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statText: {
    fontSize: fontSize.xs,
    color: colors.muted,
    fontWeight: "600",
  },
  description: {
    fontSize: fontSize.xs,
    color: colors.muted,
    lineHeight: 16,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  locationDot: { fontSize: 10 },
  locationText: {
    fontSize: fontSize.xs,
    color: colors.muted,
    flex: 1,
  },
  komootBtn: {
    marginTop: spacing.xs,
    alignSelf: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
  },
  komootText: {
    fontSize: fontSize.xs,
    color: colors.accent,
    fontWeight: "600",
  },
});
