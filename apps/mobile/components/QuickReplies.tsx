import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, fontSize, radius, spacing } from "../lib/theme";

interface Props {
  options: string[];
  disabled?: boolean;
  onSelect: (option: string) => void;
}

export function QuickReplies({ options, disabled, onSelect }: Props) {
  return (
    <View style={styles.stack}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, disabled && styles.chipDisabled]}
          onPress={() => !disabled && onSelect(opt)}
          activeOpacity={0.7}
          disabled={disabled}
        >
          <Text style={styles.chipText}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
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
    lower.includes("type of activity")
  ) {
    return [
      "Cycling — Road & gravel",
      "MTB — Mountain bike trails",
      "Hiking — Hut-to-hut & trekking",
      "Trail Running — Singletrack & ultras",
      "Climbing — Sport, trad & alpine",
      "Skiing — Alpine & backcountry",
      "Kayaking — Sea & white water",
    ];
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
    lower.includes("how many stops") ||
    lower.includes("how many accommodation") ||
    lower.includes("number of stops") ||
    lower.includes("number of bases") ||
    lower.includes("how many bases")
  ) {
    return ["1 base (stay put)", "2 stops", "3 stops", "4+ stops"];
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
    return [
      "Camping — Tents & bivouacs",
      "Hostel — Budget dorms & rooms",
      "Mid-range Hotel — En-suite & sport-friendly",
      "Luxury — Premium hotels & lodges",
    ];
  }

  return null;
}

const styles = StyleSheet.create({
  stack: {
    marginTop: spacing.sm,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    backgroundColor: colors.aiBubble,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: "500",
  },
});
