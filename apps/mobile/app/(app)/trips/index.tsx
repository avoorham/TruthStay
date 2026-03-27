import {
  ActivityIndicator, FlatList, RefreshControl,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { getMyAdventures, type AdventureRow } from "../../../lib/api";
import {
  colors, fontSize, radius, spacing, shadow,
  ACTIVITY_EMOJI, ACTIVITY_COLOR,
} from "../../../lib/theme";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tripStatus(adventure: AdventureRow): "current" | "upcoming" | "past" {
  if (!adventure.startDate) return "upcoming";
  const start = new Date(adventure.startDate);
  const end = new Date(adventure.startDate);
  end.setDate(end.getDate() + (adventure.durationDays ?? 1));
  const now = new Date();
  if (now >= start && now <= end) return "current";
  if (now < start) return "upcoming";
  return "past";
}

function formatDateRange(startDate: string | null, durationDays: number): string {
  if (!startDate) return `${durationDays} days`;
  const start = new Date(startDate);
  const end = new Date(startDate);
  end.setDate(end.getDate() + durationDays - 1);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${start.toLocaleDateString("en-GB", opts)} – ${end.toLocaleDateString("en-GB", { ...opts, year: "numeric" })}`;
}

// ─── Trip card ────────────────────────────────────────────────────────────────

function TripCard({ adventure, onPress }: { adventure: AdventureRow; onPress: () => void }) {
  const status = tripStatus(adventure);
  const emoji = ACTIVITY_EMOJI[adventure.activityType] ?? "🏔️";
  const actColor = ACTIVITY_COLOR[adventure.activityType] ?? colors.accent;

  const statusLabel = status === "current" ? "🟢 In Progress" : status === "upcoming" ? "Upcoming" : "Completed";
  const statusColor = status === "current" ? colors.easy : status === "upcoming" ? colors.accent : colors.muted;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Colour bar */}
      <View style={[styles.cardBar, { backgroundColor: actColor }]} />

      <View style={styles.cardContent}>
        {/* Top row */}
        <View style={styles.cardTop}>
          <View style={[styles.activityBadge, { backgroundColor: actColor + "22" }]}>
            <Text style={styles.activityEmoji}>{emoji}</Text>
            <Text style={[styles.activityLabel, { color: actColor }]}>
              {adventure.activityType.replace("_", " ")}
            </Text>
          </View>
          <Text style={[styles.statusBadge, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        {/* Title + region */}
        <Text style={styles.cardTitle} numberOfLines={2}>{adventure.title}</Text>
        <Text style={styles.cardRegion}>📍 {adventure.region}</Text>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatChip label={`${adventure.durationDays} days`} />
          <StatChip label={formatDateRange(adventure.startDate, adventure.durationDays)} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function StatChip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCount}>
        <Text style={styles.sectionCountText}>{count}</Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

type ListItem =
  | { type: "header"; title: string; count: number }
  | { type: "card"; adventure: AdventureRow }
  | { type: "empty"; label: string };

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [adventures, setAdventures] = useState<AdventureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getMyAdventures();
      setAdventures(data);
    } catch { /* show empty */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Sort: current first, then upcoming by date, then past (newest first)
  const current = adventures.filter(a => tripStatus(a) === "current");
  const upcoming = adventures
    .filter(a => tripStatus(a) === "upcoming")
    .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
  const past = adventures
    .filter(a => tripStatus(a) === "past")
    .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));

  const listData: ListItem[] = [];

  if (current.length > 0) {
    listData.push({ type: "header", title: "Current", count: current.length });
    current.forEach(a => listData.push({ type: "card", adventure: a }));
  }
  if (upcoming.length > 0) {
    listData.push({ type: "header", title: "Upcoming", count: upcoming.length });
    upcoming.forEach(a => listData.push({ type: "card", adventure: a }));
  }
  if (past.length > 0) {
    listData.push({ type: "header", title: "Past", count: past.length });
    past.forEach(a => listData.push({ type: "card", adventure: a }));
  }
  if (adventures.length === 0) {
    listData.push({ type: "empty", label: "No saved adventures yet. Plan one in Discover!" });
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Trips</Text>
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item, i) => `${item.type}-${i}`}
        renderItem={({ item }) => {
          if (item.type === "header") {
            return <SectionHeader title={item.title} count={item.count} />;
          }
          if (item.type === "empty") {
            return (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>🗺️</Text>
                <Text style={styles.emptyText}>{item.label}</Text>
              </View>
            );
          }
          return (
            <TripCard
              adventure={item.adventure}
              onPress={() => router.push(`/(app)/trips/${item.adventure.id}`)}
            />
          );
        }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: fontSize.xl, fontWeight: "800", color: colors.text },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
  sectionCount: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCountText: { fontSize: fontSize.xs, color: colors.inverse, fontWeight: "700" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    flexDirection: "row",
    overflow: "hidden",
    ...shadow.md,
    marginBottom: spacing.xs,
  },
  cardBar: { width: 4 },
  cardContent: { flex: 1, padding: spacing.md, gap: spacing.sm },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  activityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  activityEmoji: { fontSize: fontSize.sm },
  activityLabel: { fontSize: fontSize.xs, fontWeight: "600", textTransform: "capitalize" },
  statusBadge: { fontSize: fontSize.xs, fontWeight: "600" },
  cardTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.text, lineHeight: 21 },
  cardRegion: { fontSize: fontSize.sm, color: colors.muted },
  statsRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: {
    backgroundColor: colors.sheet,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  chipText: { fontSize: fontSize.xs, color: colors.muted, fontWeight: "500" },
  emptyBox: { alignItems: "center", paddingVertical: spacing.xxl, gap: spacing.md },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: fontSize.base, color: colors.muted, textAlign: "center" },
});
