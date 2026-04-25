import {
  StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { colors, fonts, fontSize, radius, spacing, shadow, ACTIVITY_EMOJI } from "../lib/theme";
import { saveAdventure, shareAdventurePublic } from "../lib/api";
import type {
  GeneratedAdventure, DayAlternativesMap,
  AccommodationStop,
} from "../lib/adventure-types";

interface Props {
  adventure: GeneratedAdventure;
  dayAlternatives: DayAlternativesMap;
  accommodationStops: AccommodationStop[];
  adventureId: string | null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdventurePlanCard({ adventure, accommodationStops, adventureId }: Props) {
  const router = useRouter();
  const [saving, setSaving]   = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleSave = async () => {
    if (!adventureId) {
      Alert.alert("Couldn't save", "The adventure wasn't saved to your account. Please start a new chat and try again.");
      return;
    }
    setSaving(true);
    try {
      await saveAdventure(adventureId);
      router.push(`/(app)/trips/${adventureId}` as never);
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
        <Text style={styles.description}>{adventure.description}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{emoji} {adventure.activity_type.replace(/_/g, " ")}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.meta}>{adventure.duration_days} days</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.meta}>{adventure.region}</Text>
        </View>
      </View>

      {/* Day list */}
      {adventure.days.map(day => (
        <View key={day.day_number} style={styles.dayRow}>
          <View style={styles.dayLeft}>
            <Text style={styles.dayNum}>Day {day.day_number}</Text>
            <Text style={styles.dayTitle} numberOfLines={1}>{day.title}</Text>
          </View>
          <View style={styles.dayStats}>
            {day.distance_km ? <Chip label={`${day.distance_km} km`} /> : null}
            {day.elevation_gain_m ? <Chip label={`${day.elevation_gain_m} m ↑`} /> : null}
          </View>
        </View>
      ))}

      {/* Accommodation summary */}
      {accommodationStops.length > 0 && (
        <View style={styles.accomSection}>
          <Text style={styles.sectionLabel}>Where you'll stay</Text>
          {accommodationStops.map((stop, i) => (
            <View key={i} style={styles.accomRow}>
              <Text style={styles.accomName} numberOfLines={1}>
                {stop.options[0]?.name ?? stop.location}
              </Text>
              <Text style={styles.accomNights}>
                {stop.night_numbers.length === 1
                  ? `Night ${stop.night_numbers[0]}`
                  : `Nights ${stop.night_numbers[0]}–${stop.night_numbers[stop.night_numbers.length - 1]}`}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <TouchableOpacity
        style={[styles.ctaBtn, (saving || sharing) && styles.ctaBtnDisabled]}
        onPress={handleSave}
        disabled={saving || sharing}
        activeOpacity={0.85}
      >
        {saving
          ? <ActivityIndicator color={colors.inverse} />
          : <Text style={styles.ctaText}>Save & view itinerary</Text>
        }
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.ctaBtnOutline, (saving || sharing) && styles.ctaBtnDisabled]}
        onPress={handleShare}
        disabled={saving || sharing}
        activeOpacity={0.85}
      >
        {sharing
          ? <ActivityIndicator color={colors.text} />
          : <Text style={styles.ctaTextOutline}>Share to Explore</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
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
  title: { fontFamily: fonts.display, fontSize: fontSize.base, color: colors.text, letterSpacing: -0.3 },
  description: { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.muted, lineHeight: 19 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  meta: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted, textTransform: "capitalize" },
  metaDot: { fontFamily: fonts.sans, color: colors.subtle, fontSize: fontSize.xs },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  dayLeft: { flex: 1, gap: 1 },
  dayNum: { fontFamily: fonts.sansBold, fontSize: fontSize.xs, color: colors.muted },
  dayTitle: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.text },
  dayStats: { flexDirection: "row", gap: spacing.xs, flexShrink: 0 },
  chip: {
    backgroundColor: colors.sheet,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipText: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted },
  accomSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  sectionLabel: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize.xs,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  accomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  accomName: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.text, flex: 1 },
  accomNights: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted, marginLeft: spacing.sm },
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
  ctaText: { fontFamily: fonts.sansBold, color: colors.inverse, fontSize: fontSize.sm },
  ctaTextOutline: { fontFamily: fonts.sansBold, color: colors.text, fontSize: fontSize.sm },
});