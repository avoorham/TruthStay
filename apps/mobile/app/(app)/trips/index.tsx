import {
  ActivityIndicator, Alert, Animated, FlatList, Image, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { getMyAdventures, deleteAdventure, type AdventureRow } from "../../../lib/api";
import { colors, fontSize, radius, spacing, shadow } from "../../../lib/theme";

const ACTIVITY_ICON: Record<string, string> = {
  cycling:       "bike",
  road_cycling:  "bike-fast",
  mtb:           "bike-fast",
  hiking:        "hiking",
  trail_running: "run",
  climbing:      "carabiner",
  skiing:        "ski",
  kayaking:      "kayaking",
  gravel:        "bike",
  bikepacking:   "bike",
  other:         "map-marker-outline",
};

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

// ─── Trip photo card ──────────────────────────────────────────────────────────

function TripPhotoCard({
  adventure, onPress, isEditMode, isSelected, onToggleSelect, onLongPress,
}: {
  adventure: AdventureRow;
  onPress: () => void;
  isEditMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onLongPress: () => void;
}) {
  const status = tripStatus(adventure);
  const iconName = (ACTIVITY_ICON[adventure.activityType] ?? "map-marker-outline") as React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  const statusLabel = status === "current" ? "In Progress" : status === "upcoming" ? "Upcoming" : "Completed";
  const statusColor = status === "current" ? colors.easy : status === "upcoming" ? colors.accent : colors.muted;
  const photoUrl = `https://picsum.photos/seed/${adventure.id}/800/500`;

  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isEditMode ? 44 : 0,
      useNativeDriver: true,
      bounciness: 6,
    }).start();
  }, [isEditMode, slideAnim]);

  return (
    <View style={styles.cardRow}>
      {/* Checkbox — slides in from the left in edit mode */}
      {isEditMode && (
        <TouchableOpacity style={styles.checkbox} onPress={onToggleSelect}>
          <View style={[styles.checkboxInner, isSelected && styles.checkboxSelected]}>
            {isSelected && <Feather name="check" size={13} color="#fff" />}
          </View>
        </TouchableOpacity>
      )}

      <Animated.View style={{ transform: [{ translateX: slideAnim }], flex: 1 }}>
        <TouchableOpacity
          style={styles.card}
          onPress={isEditMode ? onToggleSelect : onPress}
          onLongPress={onLongPress}
          activeOpacity={0.9}
          delayLongPress={400}
        >
          <View style={styles.photoInner}>
            <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />

            {/* Gradient */}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.75)"]}
              style={styles.gradient}
            />

            {/* Text overlay */}
            <View style={styles.textOverlay}>
              <Text style={styles.cardTitle} numberOfLines={2}>{adventure.title}</Text>
              <View style={styles.subtitleRow}>
                <MaterialCommunityIcons name={iconName} size={14} color="rgba(255,255,255,0.85)" />
                <Text style={styles.subtitleText}>
                  {formatDateRange(adventure.startDate, adventure.durationDays)}
                </Text>
              </View>
              <View style={styles.bottomRow}>
                <View style={styles.regionRow}>
                  <Feather name="map-pin" size={11} color="rgba(255,255,255,0.65)" />
                  <Text style={styles.regionText} numberOfLines={1}>{adventure.region}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + "33", borderColor: statusColor + "55" }]}>
                  <Text style={[styles.statusText, { color: status === "past" ? "rgba(255,255,255,0.7)" : statusColor }]}>
                    {statusLabel}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Tab strip ────────────────────────────────────────────────────────────────

type TabKey = "current" | "upcoming" | "past";
const TAB_LABELS: Record<TabKey, string> = { current: "Current", upcoming: "Upcoming", past: "Past" };
const TAB_ICONS: Record<TabKey, React.ComponentProps<typeof Feather>["name"]> = {
  current:  "zap",
  upcoming: "send",
  past:     "clock",
};

function TabStrip({
  tabs, active, onChange,
}: {
  tabs: TabKey[];
  active: TabKey;
  onChange: (t: TabKey) => void;
}) {
  return (
    <View style={styles.tabStrip}>
      {tabs.map(t => (
        <TouchableOpacity
          key={t}
          style={[styles.tabPill, active === t && styles.tabPillActive]}
          onPress={() => onChange(t)}
        >
          <View style={styles.tabPillInner}>
            <Feather
              name={TAB_ICONS[t]}
              size={13}
              color={active === t ? colors.inverse : colors.muted}
            />
            <Text style={[styles.tabText, active === t && styles.tabTextActive]}>{TAB_LABELS[t]}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

const EMPTY_MESSAGES: Record<TabKey, string> = {
  current: "No active trips right now.",
  upcoming: "No upcoming adventures yet.\nPlan one in Discover!",
  past: "No completed trips yet.\nYour adventures will appear here.",
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [adventures, setAdventures] = useState<AdventureRow[]>([]);
  const [tab, setTab] = useState<TabKey>("upcoming");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const data = await getMyAdventures();
      setAdventures(data);
    } catch {
      setLoadError("Couldn't load your trips.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Dynamic tabs: only show "Current" if a trip is active
  const hasCurrent = useMemo(() => adventures.some(a => tripStatus(a) === "current"), [adventures]);
  const availableTabs = useMemo<TabKey[]>(
    () => [...(hasCurrent ? ["current" as TabKey] : []), "upcoming", "past"],
    [hasCurrent],
  );

  // Auto-select best starting tab
  useEffect(() => {
    setTab(hasCurrent ? "current" : "upcoming");
  }, [hasCurrent]);

  const tripsForTab = useMemo(
    () =>
      adventures
        .filter(a => tripStatus(a) === tab)
        .sort((a, b) =>
          tab === "past"
            ? (b.startDate ?? "").localeCompare(a.startDate ?? "")
            : (a.startDate ?? "").localeCompare(b.startDate ?? ""),
        ),
    [adventures, tab],
  );

  function exitEditMode() {
    setIsEditMode(false);
    setSelectedIds(new Set());
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleDeleteSelected() {
    Alert.alert(
      "Delete trips",
      `Delete ${selectedIds.size} trip${selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await Promise.all([...selectedIds].map(id => deleteAdventure(id)));
              await load();
              exitEditMode();
            } catch {
              Alert.alert("Error", "Some trips could not be deleted. Please try again.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>My Trips</Text>
          {isEditMode && (
            <TouchableOpacity onPress={exitEditMode}>
              <Text style={styles.editToggleText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.tabRow}>
          <TabStrip
            tabs={availableTabs}
            active={tab}
            onChange={setTab}
          />
          {!isEditMode && (
            <TouchableOpacity onPress={() => setIsEditMode(true)} style={styles.cogBtn}>
              <Feather name="settings" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Loading */}
      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}

      {/* Error */}
      {!loading && loadError && (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={40} color={colors.muted} />
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      {!loading && !loadError && (
        <FlatList
          data={tripsForTab}
          keyExtractor={a => a.id}
          renderItem={({ item }) => (
            <TripPhotoCard
              adventure={item}
              onPress={() => router.push(`/(app)/trips/${item.id}`)}
              isEditMode={isEditMode}
              isSelected={selectedIds.has(item.id)}
              onToggleSelect={() => toggleSelect(item.id)}
              onLongPress={() => { if (!isEditMode) setIsEditMode(true); }}
            />
          )}
          contentContainerStyle={[styles.list, isEditMode && { paddingBottom: 120 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="map" size={52} color={colors.border} />
              <Text style={styles.emptyText}>{EMPTY_MESSAGES[tab]}</Text>
            </View>
          }
        />
      )}

      {/* Edit mode bottom bar */}
      {isEditMode && (
        <View style={[styles.editBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity style={styles.cancelEditBtn} onPress={exitEditMode}>
            <Text style={styles.cancelEditText}>Cancel</Text>
          </TouchableOpacity>
          {selectedIds.size > 0 && (
            <TouchableOpacity
              style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
              onPress={handleDeleteSelected}
              disabled={deleting}
            >
              {deleting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.deleteBtnText}>Delete ({selectedIds.size})</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: fontSize.xxl, fontWeight: "800", color: colors.text },
  editToggleText: { fontSize: fontSize.base, fontWeight: "600", color: colors.accent },
  tabStrip: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  tabRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cogBtn: { padding: 4 },
  tabPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  tabPillActive: { backgroundColor: colors.text, borderColor: colors.text },
  tabPillInner: { flexDirection: "row", alignItems: "center", gap: 4 },
  tabText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.muted },
  tabTextActive: { color: colors.inverse },
  list: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  cardRow: { flexDirection: "row", alignItems: "center" },
  card: {
    flex: 1,
    height: 220,
    borderRadius: 16,
    backgroundColor: colors.card,
    ...shadow.md,
  },
  photoInner: {
    margin: 8,
    borderRadius: 10,
    overflow: "hidden",
    flex: 1,
  },
  checkbox: { width: 44, alignItems: "center", justifyContent: "center" },
  checkboxInner: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: colors.accent,
    alignItems: "center", justifyContent: "center",
  },
  checkboxSelected: { backgroundColor: colors.accent },
  gradient: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: "60%",
  },
  textOverlay: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    padding: 14,
    gap: 5,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: fontSize.lg,
    fontWeight: "700",
    lineHeight: 22,
  },
  subtitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  subtitleText: { color: "rgba(255,255,255,0.85)", fontSize: fontSize.sm },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  regionRow: { flexDirection: "row", alignItems: "center", gap: 3, flex: 1 },
  regionText: { color: "rgba(255,255,255,0.7)", fontSize: fontSize.xs, flex: 1 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  statusText: { fontSize: fontSize.xs, fontWeight: "700" },
  emptyBox: {
    alignItems: "center",
    paddingVertical: spacing.xxl * 2,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.base,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 24,
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  errorText: { fontSize: fontSize.base, color: colors.muted, textAlign: "center" },
  retryBtn: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
  },
  retryText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  editBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  cancelEditBtn: {
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: radius.full,
    backgroundColor: colors.sheet,
    borderWidth: 1, borderColor: colors.border,
  },
  cancelEditText: { color: colors.muted, fontWeight: "600", fontSize: fontSize.base },
  deleteBtn: {
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: radius.full,
    backgroundColor: "#E53E3E",
  },
  deleteBtnText: { color: "#fff", fontWeight: "700", fontSize: fontSize.base },
});
