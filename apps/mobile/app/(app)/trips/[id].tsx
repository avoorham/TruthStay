import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { getMyAdventures, type AdventureRow, type AdventureDayRow } from "../../../lib/api";
import {
  colors, fontSize, radius, spacing, shadow,
  ACTIVITY_EMOJI, ACTIVITY_COLOR,
} from "../../../lib/theme";

// ─── Day icon by type ─────────────────────────────────────────────────────────

const DAY_ICONS: Record<string, string> = {
  summit: "🏔️",
  climb: "⛰️",
  rest: "😴",
  transfer: "🚌",
  bike: "🚴",
  hike: "🥾",
  run: "🏃",
  ski: "⛷️",
  kayak: "🛶",
  camp: "⛺",
};

function getDayIcon(title: string, activityType: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("summit") || lower.includes("peak") || lower.includes("top")) return DAY_ICONS.summit;
  if (lower.includes("rest") || lower.includes("recovery") || lower.includes("relax")) return DAY_ICONS.rest;
  if (lower.includes("transfer") || lower.includes("travel")) return DAY_ICONS.transfer;
  if (lower.includes("camp")) return DAY_ICONS.camp;
  return ACTIVITY_EMOJI[activityType] ?? "🏔️";
}

function isHighlightDay(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes("summit") || lower.includes("push") || lower.includes("peak") ||
    lower.includes("highlight") || lower.includes("top");
}

// ─── Day card ─────────────────────────────────────────────────────────────────

function DayCard({ day, activityType, isLast }: { day: AdventureDayRow; activityType: string; isLast: boolean }) {
  const icon = getDayIcon(day.title, activityType);
  const highlight = isHighlightDay(day.title);

  return (
    <View style={styles.dayRow}>
      {/* Timeline */}
      <View style={styles.timeline}>
        <View style={[styles.timelineIcon, highlight && styles.timelineIconHighlight]}>
          <Text style={styles.timelineEmoji}>{icon}</Text>
        </View>
        {!isLast && <View style={styles.timelineLine} />}
      </View>

      {/* Card */}
      <View style={[styles.dayCard, highlight && styles.dayCardHighlight]}>
        <Text style={styles.dayLabel}>DAY {day.dayNumber}</Text>
        <Text style={styles.dayTitle}>{day.title}</Text>
        <Text style={styles.dayDesc} numberOfLines={3}>{day.description}</Text>

        {/* Stat chips */}
        {(day.distanceKm || day.elevationGainM) && (
          <View style={styles.statRow}>
            {day.distanceKm && (
              <View style={styles.statChip}>
                <Text style={styles.statText}>📏 {day.distanceKm} km</Text>
              </View>
            )}
            {day.elevationGainM && (
              <View style={styles.statChip}>
                <Text style={styles.statText}>⛰️ {day.elevationGainM} m ↑</Text>
              </View>
            )}
          </View>
        )}

        {day.routeNotes && (
          <Text style={styles.routeNotes} numberOfLines={2}>{day.routeNotes}</Text>
        )}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [adventure, setAdventure] = useState<AdventureRow | null>(null);

  useEffect(() => {
    getMyAdventures().then(list => {
      setAdventure(list.find(a => a.id === id) ?? null);
    });
  }, [id]);

  if (!adventure) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.loading}>Loading…</Text>
      </View>
    );
  }

  const actColor = ACTIVITY_COLOR[adventure.activityType] ?? colors.accent;
  const emoji = ACTIVITY_EMOJI[adventure.activityType] ?? "🏔️";
  const sortedDays = [...(adventure.adventure_days ?? [])].sort((a, b) => a.dayNumber - b.dayNumber);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerMeta}>
          <View style={[styles.durationBadge, { backgroundColor: actColor }]}>
            <Text style={styles.durationText}>{adventure.durationDays} Days</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Trip title block */}
        <View style={styles.titleBlock}>
          <Text style={styles.tripTitle}>{adventure.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaItem}>{emoji} {adventure.activityType.replace("_", " ")}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaItem}>📍 {adventure.region}</Text>
          </View>
          <Text style={styles.tripDesc}>{adventure.description}</Text>
        </View>

        {/* Day timeline */}
        <View style={styles.timeline_container}>
          {sortedDays.map((day, idx) => (
            <DayCard
              key={day.id}
              day={day}
              activityType={adventure.activityType}
              isLast={idx === sortedDays.length - 1}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { textAlign: "center", marginTop: spacing.xl, color: colors.muted },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { padding: spacing.xs },
  backIcon: { fontSize: fontSize.xl, color: colors.text },
  headerMeta: { flexDirection: "row", gap: spacing.sm },
  durationBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  durationText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.inverse },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  titleBlock: { marginBottom: spacing.xl, gap: spacing.sm },
  tripTitle: { fontSize: fontSize.xxl, fontWeight: "800", color: colors.text, lineHeight: 32 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  metaItem: { fontSize: fontSize.sm, color: colors.muted, textTransform: "capitalize" },
  metaDot: { color: colors.subtle },
  tripDesc: { fontSize: fontSize.base, color: colors.muted, lineHeight: 22 },
  timeline_container: { gap: 0 },
  dayRow: { flexDirection: "row", gap: spacing.md },
  timeline: { alignItems: "center", width: 40 },
  timelineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.sm,
    zIndex: 1,
  },
  timelineIconHighlight: { backgroundColor: colors.intermediate },
  timelineEmoji: { fontSize: 16 },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginTop: 2,
    marginBottom: 2,
    minHeight: 24,
  },
  dayCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
    ...shadow.sm,
  },
  dayCardHighlight: {
    backgroundColor: "#FFF8ED",
    borderWidth: 1,
    borderColor: colors.intermediate + "50",
  },
  dayLabel: { fontSize: fontSize.xs, fontWeight: "700", color: colors.muted, letterSpacing: 0.5 },
  dayTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
  dayDesc: { fontSize: fontSize.sm, color: colors.muted, lineHeight: 20 },
  statRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginTop: spacing.xs },
  statChip: {
    backgroundColor: colors.sheet,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  statText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "500" },
  routeNotes: {
    fontSize: fontSize.xs,
    color: colors.muted,
    fontStyle: "italic",
    marginTop: spacing.xs,
  },
});
