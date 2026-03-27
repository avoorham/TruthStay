import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, fontSize, radius, spacing, DIFFICULTY_COLOR } from "../lib/theme";
import type { RouteAlternative } from "../lib/adventure-types";

interface Props {
  label: "Main" | "Easier" | "Harder";
  title: string;
  distanceKm: number | null;
  elevationM: number | null;
  difficulty: RouteAlternative["difficulty"] | "moderate";
  description: string;
  endLocation: string;
  isSelected: boolean;
  onSelect: () => void;
}

export function RouteTile({
  label, title, distanceKm, elevationM, difficulty,
  description, endLocation, isSelected, onSelect,
}: Props) {
  const diffColor = DIFFICULTY_COLOR[difficulty] ?? colors.text;

  return (
    <TouchableOpacity
      style={[styles.tile, isSelected && styles.tileSelected]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      <View style={styles.topRow}>
        <View style={styles.metaLeft}>
          <Text style={[styles.label, { color: diffColor }]}>{label}</Text>
          {distanceKm && <Text style={styles.stat}>{distanceKm} km</Text>}
          {elevationM && <Text style={styles.stat}>{elevationM} m ↑</Text>}
        </View>
        {isSelected && (
          <View style={styles.checkCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
        )}
      </View>

      <Text style={styles.title} numberOfLines={2}>{title}</Text>
      <Text style={styles.description} numberOfLines={2}>{description}</Text>

      {endLocation && (
        <Text style={styles.endLocation}>📍 Ends: {endLocation}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  tileSelected: {
    borderColor: colors.text,
    backgroundColor: colors.sheet,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  stat: {
    fontSize: fontSize.sm,
    color: colors.muted,
    backgroundColor: colors.sheet,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    fontSize: 11,
    color: colors.inverse,
    fontWeight: "700",
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  description: {
    fontSize: fontSize.xs,
    color: colors.muted,
    lineHeight: 18,
  },
  endLocation: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 2,
  },
});
