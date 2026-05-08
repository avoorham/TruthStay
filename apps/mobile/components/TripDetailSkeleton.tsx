import {
  ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import { colors, fonts, fontSize, radius, spacing, shadow } from "../lib/theme";
import type { AdventureRow, AdventureDayRow } from "../lib/api";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

async function apiHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentType = "accommodation" | "restaurant" | "activity" | "things_to_do";

interface ContentEntry {
  id: string;
  name: string;
  type: string;
  region: string;
  country: string | null;
  description: string | null;
  trust_score: number;
  save_count: number;
  image_url: string | null;
}

interface DayContent {
  accommodation: ContentEntry | null;
  meals: ContentEntry[];
  activities: ContentEntry[];
  things_to_do: ContentEntry[];
}

const CONTENT_TYPES: { key: ContentType; label: string; role: string; icon: React.ComponentProps<typeof Feather>["name"] }[] = [
  { key: "accommodation", label: "Add accommodation", role: "accommodation", icon: "home" },
  { key: "restaurant",    label: "Add restaurant",    role: "meal",          icon: "coffee" },
  { key: "activity",      label: "Add activity",      role: "activity",      icon: "zap" },
  { key: "things_to_do", label: "Add things to do",  role: "activity",      icon: "map-pin" },
];

// ─── Content picker bottom sheet ──────────────────────────────────────────────

function ContentPickerSheet({
  visible,
  adventureId,
  dayNumber,
  adventureDayId,
  type,
  destination,
  onClose,
  onAdded,
}: {
  visible: boolean;
  adventureId: string;
  dayNumber: number;
  adventureDayId: string;
  type: ContentType | null;
  destination: string;
  onClose: () => void;
  onAdded: (entry: ContentEntry, role: string) => void;
}) {
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  const fetchEntries = useCallback(async (t: ContentType, dayId: string) => {
    setLoading(true);
    setEntries([]);
    try {
      const res = await fetch(
        `${BASE}/api/discovery/content-for-day?adventure_day_id=${encodeURIComponent(dayId)}&type=${t}`,
      );
      const json = await res.json() as { entries?: ContentEntry[] };
      setEntries(json.entries ?? []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when sheet opens
  useState(() => {
    if (visible && type && adventureDayId) {
      fetchEntries(type, adventureDayId);
    }
  });

  if (!visible || !type) return null;

  const typeInfo = CONTENT_TYPES.find(c => c.key === type);

  async function handleAdd(entry: ContentEntry) {
    if (!typeInfo) return;
    setAdding(entry.id);
    try {
      const res = await fetch(
        `${BASE}/api/adventures/${adventureId}/days/${dayNumber}/content`,
        {
          method: "POST",
          headers: await apiHeaders(),
          body: JSON.stringify({ content_entry_id: entry.id, role: typeInfo.role }),
        },
      );
      if (!res.ok) throw new Error("Failed");
      onAdded(entry, typeInfo.role);
      onClose();
    } catch {
      Alert.alert("Error", "Could not add this item. Please try again.");
    } finally {
      setAdding(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={sheetStyles.container}>
        <View style={sheetStyles.header}>
          <Text style={sheetStyles.title}>{typeInfo?.label ?? "Pick content"}</Text>
          <TouchableOpacity onPress={onClose} style={sheetStyles.closeBtn}>
            <Feather name="x" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>
        {destination ? (
          <Text style={sheetStyles.subtitle}>Near {destination}</Text>
        ) : null}

        {loading && (
          <View style={sheetStyles.centered}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        {!loading && entries.length === 0 && (
          <View style={sheetStyles.centered}>
            <Feather name="inbox" size={36} color={colors.border} />
            <Text style={sheetStyles.emptyText}>No content here yet</Text>
            <Text style={sheetStyles.emptyHint}>More will appear as the community adds recommendations</Text>
          </View>
        )}

        {!loading && entries.length > 0 && (
          <ScrollView style={sheetStyles.list} contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
            {entries.map(entry => (
              <View key={entry.id} style={sheetStyles.entryCard}>
                {entry.image_url && (
                  <Image source={{ uri: entry.image_url }} style={sheetStyles.entryImage} resizeMode="cover" />
                )}
                <View style={sheetStyles.entryBody}>
                  <Text style={sheetStyles.entryName} numberOfLines={1}>{entry.name}</Text>
                  {entry.description ? (
                    <Text style={sheetStyles.entryDesc} numberOfLines={2}>{entry.description}</Text>
                  ) : null}
                  <View style={sheetStyles.entryMeta}>
                    <Feather name="star" size={11} color={colors.accent} />
                    <Text style={sheetStyles.entryScore}>{entry.trust_score.toFixed(1)}</Text>
                    {entry.save_count > 0 && (
                      <Text style={sheetStyles.entrySaves}>{entry.save_count} saves</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={[sheetStyles.addBtn, adding === entry.id && { opacity: 0.6 }]}
                  onPress={() => handleAdd(entry)}
                  disabled={adding === entry.id}
                >
                  {adding === entry.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Feather name="plus" size={18} color="#fff" />
                  }
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Day card ─────────────────────────────────────────────────────────────────

function DayCard({
  day,
  adventure,
  isOnlyDay,
  onRemove,
}: {
  day: AdventureDayRow;
  adventure: AdventureRow;
  isOnlyDay: boolean;
  onRemove: (dayNumber: number) => void;
}) {
  const [pickerType, setPickerType] = useState<ContentType | null>(null);
  const [dayContent, setDayContent] = useState<DayContent>({
    accommodation: null,
    meals: [],
    activities: [],
    things_to_do: [],
  });

  const destination: string = (day.alternatives as { destination?: string } | null)?.destination ?? "";
  const accommodationStop = (day.alternatives as { accommodationStop?: { destination: string; night_numbers: number[] } | null } | null)?.accommodationStop;

  function handleAdded(entry: ContentEntry, role: string) {
    setDayContent(prev => {
      if (role === "accommodation") return { ...prev, accommodation: entry };
      if (role === "meal") return { ...prev, meals: [...prev.meals, entry] };
      if (role === "activity") {
        if (pickerType === "things_to_do") return { ...prev, things_to_do: [...prev.things_to_do, entry] };
        return { ...prev, activities: [...prev.activities, entry] };
      }
      return prev;
    });
    setPickerType(null);
  }

  function handleRemoveDay() {
    if (isOnlyDay) return;
    Alert.alert(
      "Remove day",
      `Remove Day ${day.dayNumber} from this trip?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => onRemove(day.dayNumber) },
      ],
    );
  }

  const currentPickerType = pickerType;

  return (
    <View style={dayStyles.card}>
      {/* Day header */}
      <View style={dayStyles.header}>
        <View>
          <Text style={dayStyles.dayLabel}>Day {day.dayNumber}</Text>
          {destination ? <Text style={dayStyles.destination}>{destination}</Text> : null}
        </View>
        {!isOnlyDay && (
          <TouchableOpacity onLongPress={handleRemoveDay} style={dayStyles.removeHint}>
            <Feather name="more-horizontal" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Where you're staying */}
      {accommodationStop && (
        <Text style={dayStyles.sectionLabel}>Where you're staying</Text>
      )}
      {dayContent.accommodation ? (
        <View style={dayStyles.filledItem}>
          <Feather name="home" size={14} color={colors.accent} />
          <Text style={dayStyles.filledName} numberOfLines={1}>{dayContent.accommodation.name}</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={dayStyles.addButton}
          onPress={() => setPickerType("accommodation")}
        >
          <Feather name="plus" size={14} color={colors.accent} />
          <Text style={dayStyles.addButtonText}>Add accommodation</Text>
        </TouchableOpacity>
      )}

      {/* Things planned */}
      <Text style={dayStyles.sectionLabel}>Things planned</Text>

      {/* Meals */}
      {dayContent.meals.map((m, i) => (
        <View key={i} style={dayStyles.filledItem}>
          <Feather name="coffee" size={14} color={colors.accent} />
          <Text style={dayStyles.filledName} numberOfLines={1}>{m.name}</Text>
        </View>
      ))}
      <TouchableOpacity style={dayStyles.addButton} onPress={() => setPickerType("restaurant")}>
        <Feather name="plus" size={14} color={colors.accent} />
        <Text style={dayStyles.addButtonText}>Add restaurant</Text>
      </TouchableOpacity>

      {/* Activities */}
      {dayContent.activities.map((a, i) => (
        <View key={i} style={dayStyles.filledItem}>
          <Feather name="zap" size={14} color={colors.accent} />
          <Text style={dayStyles.filledName} numberOfLines={1}>{a.name}</Text>
        </View>
      ))}
      <TouchableOpacity style={dayStyles.addButton} onPress={() => setPickerType("activity")}>
        <Feather name="plus" size={14} color={colors.accent} />
        <Text style={dayStyles.addButtonText}>Add activity</Text>
      </TouchableOpacity>

      {/* Things to do */}
      {dayContent.things_to_do.map((t, i) => (
        <View key={i} style={dayStyles.filledItem}>
          <Feather name="map-pin" size={14} color={colors.accent} />
          <Text style={dayStyles.filledName} numberOfLines={1}>{t.name}</Text>
        </View>
      ))}
      <TouchableOpacity style={dayStyles.addButton} onPress={() => setPickerType("things_to_do")}>
        <Feather name="plus" size={14} color={colors.accent} />
        <Text style={dayStyles.addButtonText}>Add things to do</Text>
      </TouchableOpacity>

      {/* Content picker sheet */}
      <ContentPickerSheet
        visible={currentPickerType !== null}
        adventureId={adventure.id}
        dayNumber={day.dayNumber}
        adventureDayId={day.id}
        type={currentPickerType}
        destination={destination}
        onClose={() => setPickerType(null)}
        onAdded={handleAdded}
      />
    </View>
  );
}

// ─── Main skeleton view ───────────────────────────────────────────────────────

export function TripDetailSkeletonView({
  adventure: initialAdventure,
}: {
  adventure: AdventureRow;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [adventure, setAdventure] = useState<AdventureRow>(initialAdventure);
  const [removing, setRemoving] = useState(false);

  const sortedDays = [...(adventure.adventure_days ?? [])].sort((a, b) => a.dayNumber - b.dayNumber);

  async function handleRemoveDay(dayNumber: number) {
    if (removing) return;
    setRemoving(true);
    try {
      const res = await fetch(
        `${BASE}/api/adventures/${adventure.id}/days/${dayNumber}`,
        { method: "DELETE", headers: await apiHeaders() },
      );
      const json = await res.json() as { ok?: boolean; newDurationDays?: number; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed");

      // Remove day locally and renumber
      setAdventure(prev => {
        const filtered = (prev.adventure_days ?? [])
          .filter(d => d.dayNumber !== dayNumber)
          .map(d => d.dayNumber > dayNumber ? { ...d, dayNumber: d.dayNumber - 1 } : d);
        return { ...prev, durationDays: json.newDurationDays ?? prev.durationDays - 1, adventure_days: filtered };
      });
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not remove day");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <View style={skelStyles.container}>
      {/* Header */}
      <View style={[skelStyles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} style={skelStyles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={skelStyles.headerCenter}>
          <Text style={skelStyles.title} numberOfLines={1}>{adventure.title}</Text>
          <Text style={skelStyles.subtitle}>{adventure.durationDays} days · {adventure.region}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Day cards */}
      <ScrollView
        style={skelStyles.scroll}
        contentContainerStyle={[skelStyles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {sortedDays.map(day => (
          <DayCard
            key={day.id}
            day={day}
            adventure={adventure}
            isOnlyDay={sortedDays.length <= 1}
            onRemove={handleRemoveDay}
          />
        ))}

        {sortedDays.length === 0 && (
          <View style={skelStyles.emptyBox}>
            <Feather name="calendar" size={40} color={colors.border} />
            <Text style={skelStyles.emptyText}>No days found for this trip</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const skelStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  title: { fontFamily: fonts.display, fontSize: fontSize.lg, color: colors.text, letterSpacing: -0.3, textAlign: "center" },
  subtitle: { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, gap: spacing.md },
  emptyBox: { alignItems: "center", paddingTop: 80, gap: spacing.md },
  emptyText: { fontFamily: fonts.sans, fontSize: fontSize.base, color: colors.muted },
});

const dayStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadow.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.xs,
  },
  dayLabel: { fontFamily: fonts.sansBold, fontSize: fontSize.base, color: colors.text },
  destination: { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.muted, marginTop: 1 },
  removeHint: { padding: 4 },
  sectionLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSize.xs,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.accent + "66",
  },
  addButtonText: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.accent },
  filledItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.accent + "14",
  },
  filledName: { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.text, flex: 1 },
});

const sheetStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontFamily: fonts.display, fontSize: fontSize.lg, color: colors.text },
  closeBtn: { padding: 4 },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  emptyText: { fontFamily: fonts.sansBold, fontSize: fontSize.base, color: colors.muted },
  emptyHint: { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.muted, textAlign: "center" },
  list: { flex: 1 },
  entryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadow.sm,
  },
  entryImage: { width: 72, height: 72 },
  entryBody: { flex: 1, padding: spacing.sm, gap: 3 },
  entryName: { fontFamily: fonts.sansBold, fontSize: fontSize.sm, color: colors.text },
  entryDesc: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted, lineHeight: 16 },
  entryMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  entryScore: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.xs, color: colors.text },
  entrySaves: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted },
  addBtn: {
    width: 44,
    height: "100%" as unknown as number,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
