import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { colors, fonts, fontSize, radius } from "../../lib/theme";

interface OnboardingButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function OnboardingButton({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
}: OnboardingButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.82}
      style={[
        styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "ghost" && styles.ghost,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? "#FFFFFF" : colors.accent}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.label,
            variant === "primary" && styles.labelPrimary,
            variant === "secondary" && styles.labelSecondary,
            variant === "ghost" && styles.labelGhost,
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    paddingVertical: 17,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: "transparent",
    paddingVertical: 12,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize.base,
    letterSpacing: 0.1,
  },
  labelPrimary: {
    color: "#FFFFFF",
  },
  labelSecondary: {
    color: colors.text,
  },
  labelGhost: {
    color: colors.ocean,
    fontFamily: fonts.sansSemiBold,
  },
});
