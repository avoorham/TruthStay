import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { colors, fontSize, radius, spacing, shadow, ACTIVITY_EMOJI } from "../lib/theme";
import { RouteTile } from "./RouteTile";
import { AccommodationTile } from "./AccommodationTile";
import { recordSelection, saveAdventure, shareAdventurePublic } from "../lib/api";
import type {
  GeneratedAdventure, DayAlternativesMap,
  AccommodationStop, RouteAlternative,
} from "../lib/adventure-types";

interface Props {
  adventure: GeneratedAdventure;
  dayAlternatives: DayAlternativesMap;
  accommodationStops: AccommodationStop[];
  adventureId: string | null;
}

interface DayRouteSelection {
  index: number;
  end_location: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdventurePlanCard({ adventure, dayAlternatives, accommodationStops, adventureId }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<"routes" | "accommodation">("routes");
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]));
  const [routeSelections, setRouteSelections] = useState<Record<number, DayRouteSelection>>({});
  const [accSelections, setAccSelections] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);

  const toggleDay = (n: number) =>
    setExpandedDays(prev => {
      const s = new Set(prev);
      s.has(n) ? s.delete(n) : s.add(n);
      return s;
    });

  const getRouteSelection = (dayNumber: number): DayRouteSelection =>
    routeSelections[dayNumber] ?? {
      index: 0,
      end_location: adventure.days.find(d => d.day_number === dayNumber)?.end_location ?? "",
    };

  const selectRoute = (dayNumber: number, index: number, end_location: string) => {
    setRouteSelections(prev => ({ ...prev, [dayNumber]: { index, end_location } }));
    if (adventureId) recordSelection(adventureId, dayNumber, "route", index);
  };

  const getLocationMismatch = (dayNumber: number): string | null => {
    const sel = getRouteSelection(dayNumber);
    if (sel.index === 0) return null;
    const stop = accommodationStops.find(s => s.night_numbers.includes(dayNumber));
    if (!stop) return null;
    if (sel.end_location && sel.end_location.toLowerCase() !== stop.location.toLowerCase()) {
      return `This route ends in ${sel.end_location}, not ${stop.location}`;
    }
    return null;
  };

  const handleSave = async () => {
    if (!adventureId) {
      Alert.alert("Couldn't save", "The adventure wasn't saved to your account. Please start a new chat and try again.");
      return;
    }
    setSaving(true);
    try {
      await saveAdventure(adventureId);
      router.push("/(app)/trips");
    } catch (err) {
      setSaving(false);
      Alert.alert("Save failed", err instanceof Error ? err.message : "Please check your connection and try again.");
    }
  };

  const handleShare = async () => {
    if (!adventureId) return;
    setSharing(true);
    try {
      await shareAdventurePublic(adventureId);
      Alert.alert("Live on Explore!", "Your adventure is now visible to everyone on the Explore screen.", [
        { text: "View my trips", onPress: () => router.push("/(app)/trips") },
      ]);
    } catch {
      Alert.alert("Error", "Could not share adventure. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  const emoji = ACTIVITY_EMOJI[adventure.activity_type] ?? "🏔️";

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{adventure.title}</Text>
        <Text style={styles.description} numberOfLines={2}>{adventure.description}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{emoji} {adventure.activity_type.replace("_", " ")}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.meta}>{adventure.duration_days} days</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.meta}>{adventure.region}</Text>
        </View>

        {/* Phase pills */}
        <View style={styles.phases}>
          <View style={[styles.phase, phase === "routes" && styles.phaseActive]}>
            <Text style={[styles.phaseText, phase === "routes" && styles.phaseTextActive]}>1 Routes</Text>
          </View>
          <View style={[styles.phase, phase === "accommodation" && styles.phaseActive]}>
            <Text style={[styles.phaseText, phase === "accommodation" && styles.phaseTextActive]}>2 Accommodation</Text>
          </View>
        </View>
      </View>

      {/* ── Phase 1: Routes ───────────────────────────────────────────────────── */}
      {phase === "routes" && (
        <>
          {adventure.days.map((day) => {
            const isExpanded = expandedDays.has(day.day_number);
            const alts = dayAlternatives[String(day.day_number)];
            const sel = getRouteSelection(day.day_number);
            const mismatch = getLocationMismatch(day.day_number);

            return (
              <View key={day.day_number} style={styles.daySection}>
                <TouchableOpacity
                  style={styles.dayHeader}
                  onPress={() => toggleDay(day.day_number)}
                  activeOpacity={0.8}
                >
                  <View style={styles.dayLeft}>
                    <Text style={styles.dayNum}>Day {day.day_number}</Text>
                    <Text style={styles.dayTitle} numberOfLines={1}>{day.title}</Text>
                    <View style={styles.dayStats}>
                      {day.distance_km && <Chip label={`${day.distance_km} km`} />}
                      {day.elevation_gain_m && <Chip label={`${day.elevation_gain_m} m ↑`} />}
                      {sel.index > 0 && <Chip label={sel.index === 1 ? "Easier" : "Harder"} dark />}
                    </View>
                  </View>
                  <Text style={styles.chevron}>{isExpanded ? "▲" : "▼"}</Text>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.dayBody}>
                    <Text style={styles.dayDesc}>{day.description}</Text>
                    {day.route_notes && (
                      <Text style={styles.routeNotes}>{day.route_notes}</Text>
                    )}

                    <Text style={styles.sectionLabel}>⛰ Route options</Text>
                    <View style={styles.tilesGap}>
                      <RouteTile
                        label="Main"
                        title={day.title}
                        distanceKm={day.distance_km}
                        elevationM={day.elevation_gain_m}
                        difficulty="moderate"
                        description={day.description}
                        endLocation={day.end_location}
                        activityType={adventure.activity_type}
                        region={adventure.region}
                        isSelected={sel.index === 0}
                        onSelect={() => selectRoute(day.day_number, 0, day.end_location)}
                      />
                      {alts?.routes?.map((alt: RouteAlternative, idx: number) => (
                        <RouteTile
                          key={idx}
                          label={idx === 0 ? "Easier" : "Harder"}
                          title={alt.title}
                          distanceKm={alt.distance_km}
                          elevationM={alt.elevation_gain_m}
                          difficulty={alt.difficulty}
                          description={alt.description}
                          endLocation={alt.end_location}
                          activityType={adventure.activity_type}
                          region={adventure.region}
                          isSelected={sel.index === idx + 1}
                          onSelect={() => selectRoute(day.day_number, idx + 1, alt.end_location)}
                        />
                      ))}
                    </View>

                    {mismatch && (
                      <View style={styles.warning}>
                        <Text style={styles.warningText}>⚠️ {mismatch}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => { setPhase("accommodation"); setExpandedDays(new Set()); }}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Confirm routes → Choose accommodation</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── Phase 2: Accommodation ────────────────────────────────────────────── */}
      {phase === "accommodation" && (
        <>
          <View style={styles.accHeader}>
            <Text style={styles.accTitle}>Where to stay</Text>
            <TouchableOpacity onPress={() => setPhase("routes")}>
              <Text style={styles.backLink}>← Edit routes</Text>
            </TouchableOpacity>
          </View>

          {accommodationStops.length === 0 ? (
            <Text style={styles.emptyText}>No accommodation stops generated.</Text>
          ) : (
            accommodationStops.map((stop, stopIdx) => {
              const selectedOptIdx = accSelections[stop.location] ?? 0;
              return (
                <View key={stopIdx} style={styles.stopSection}>
                  <View style={styles.stopHeader}>
                    <Text style={styles.stopLocation}>📍 {stop.location}</Text>
                    <Text style={styles.stopNights}>
                      {stop.night_numbers.length === 1
                        ? `Night ${stop.night_numbers[0]}`
                        : `Nights ${stop.night_numbers[0]}–${stop.night_numbers[stop.night_numbers.length - 1]}`}
                    </Text>
                  </View>
                  {stop.notes ? <Text style={styles.stopNotes}>{stop.notes}</Text> : null}

                  <View style={styles.tilesGap}>
                    {stop.options.map((opt, optIdx) => (
                      <AccommodationTile
                        key={optIdx}
                        opt={opt}
                        nightCount={stop.night_numbers.length}
                        nightNumbers={stop.night_numbers}
                        location={stop.location}
                        startDate={adventure.start_date}
                        adventureId={adventureId}
                        isSelected={selectedOptIdx === optIdx}
                        onSelect={() => {
                          setAccSelections(prev => ({ ...prev, [stop.location]: optIdx }));
                          if (adventureId) {
                            recordSelection(adventureId, stop.night_numbers[0] ?? 1, "accommodation", optIdx, opt.type);
                          }
                        }}
                      />
                    ))}
                  </View>
                </View>
              );
            })
          )}

          <TouchableOpacity
            style={[styles.ctaBtn, saving && styles.ctaBtnDisabled]}
            onPress={handleSave}
            disabled={saving || sharing}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={colors.inverse} />
              : <Text style={styles.ctaText}>Save this adventure</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ctaBtnOutline, sharing && styles.ctaBtnDisabled]}
            onPress={handleShare}
            disabled={saving || sharing}
            activeOpacity={0.85}
          >
            {sharing
              ? <ActivityIndicator color={colors.text} />
              : <Text style={styles.ctaTextOutline}>Share to Explore</Text>
            }
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function Chip({ label, dark }: { label: string; dark?: boolean }) {
  return (
    <View style={[styles.chip, dark && styles.chipDark]}>
      <Text style={[styles.chipText, dark && styles.chipTextDark]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadow.md,
  },
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  title: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
  description: { fontSize: fontSize.sm, color: colors.muted, lineHeight: 19 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  meta: { fontSize: fontSize.xs, color: colors.muted, textTransform: "capitalize" },
  metaDot: { color: colors.subtle, fontSize: fontSize.xs },
  phases: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  phase: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.sheet,
  },
  phaseActive: { backgroundColor: colors.text },
  phaseText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.muted },
  phaseTextActive: { color: colors.inverse },
  daySection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
  },
  dayLeft: { flex: 1, gap: 2 },
  dayNum: { fontSize: fontSize.xs, fontWeight: "700", color: colors.muted },
  dayTitle: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  dayStats: { flexDirection: "row", gap: spacing.xs, marginTop: 3, flexWrap: "wrap" },
  chevron: { fontSize: fontSize.xs, color: colors.muted, marginLeft: spacing.sm },
  dayBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  dayDesc: { fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
  routeNotes: {
    fontSize: fontSize.xs,
    color: colors.muted,
    fontStyle: "italic",
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    paddingLeft: spacing.sm,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tilesGap: { gap: spacing.sm },
  warning: {
    backgroundColor: "#FFF8ED",
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.intermediate,
  },
  warningText: { fontSize: fontSize.xs, color: "#92400E" },
  ctaBtn: {
    backgroundColor: colors.text,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaBtnOutline: {
    borderWidth: 1.5,
    borderColor: colors.text,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
  },
  ctaBtnDisabled: { opacity: 0.5 },
  ctaText: { color: colors.inverse, fontWeight: "700", fontSize: fontSize.sm },
  ctaTextOutline: { color: colors.text, fontWeight: "700", fontSize: fontSize.sm },
  accHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  accTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
  backLink: { fontSize: fontSize.sm, color: colors.muted },
  emptyText: { padding: spacing.md, color: colors.muted, fontSize: fontSize.sm },
  stopSection: { padding: spacing.md, gap: spacing.sm },
  stopHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  stopLocation: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
  stopNights: { fontSize: fontSize.sm, color: colors.muted },
  stopNotes: { fontSize: fontSize.sm, color: colors.muted },
  chip: {
    backgroundColor: colors.sheet,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipDark: { backgroundColor: colors.text },
  chipText: { fontSize: fontSize.xs, color: colors.muted },
  chipTextDark: { color: colors.inverse },
});
