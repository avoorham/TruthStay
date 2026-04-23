import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, fontSize, radius, spacing } from "../../lib/theme";

const REQUIREMENTS = [
  "1 lower-case character",
  "1 upper-case character",
  "1 number",
  "1 special character",
];

export function PasswordHintPanel() {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>
        Password must be at least 8 characters, with at least 3 of:
      </Text>
      {REQUIREMENTS.map((req) => (
        <Text key={req} style={styles.item}>
          · {req}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#F4F4F6",
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  heading: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    color: colors.muted,
    lineHeight: 16,
    marginBottom: spacing.xs,
  },
  item: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    color: colors.muted,
    lineHeight: 18,
  },
});