import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { colors, fontSize, radius, spacing } from "../lib/theme";

interface Props {
  options: string[];
  onSelect: (option: string) => void;
}

export function QuickReplies({ options, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.container}
    >
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={styles.chip}
          onPress={() => onSelect(opt)}
          activeOpacity={0.7}
        >
          <Text style={styles.chipText}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// Detect which quick-reply buttons to show based on the AI message content
export function detectQuickReplies(text: string): string[] | null {
  const lower = text.toLowerCase();

  if (
    lower.includes("what sport") ||
    lower.includes("what activity") ||
    lower.includes("which activity") ||
    lower.includes("outdoor activity") ||
    lower.includes("planning for") ||
    lower.includes("type of activity")
  ) {
    return ["Cycling", "MTB", "Hiking", "Trail Running", "Climbing", "Skiing", "Kayaking"];
  }

  if (
    lower.includes("how many days") ||
    lower.includes("how long") ||
    lower.includes("duration") ||
    lower.includes("number of days")
  ) {
    return ["3–4 days", "5–7 days", "8–10 days", "2 weeks+"];
  }

  if (
    lower.includes("fitness level") ||
    lower.includes("experience level") ||
    lower.includes("typical daily") ||
    lower.includes("how fit") ||
    lower.includes("fitness and")
  ) {
    return ["Beginner (light days)", "Intermediate (moderate)", "Advanced (big days)"];
  }

  if (
    lower.includes("accommodation") ||
    lower.includes("where to stay") ||
    lower.includes("type of place") ||
    lower.includes("sleep")
  ) {
    return ["Camping", "Hostel / Budget", "Mid-range Hotel", "Luxury"];
  }

  return null;
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.sm },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.accent,
    fontWeight: "600",
  },
});
