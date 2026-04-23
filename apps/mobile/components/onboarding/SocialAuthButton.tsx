import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { colors, fonts, fontSize, radius, spacing } from "../../lib/theme";

const GOOGLE_LOGO = require("../../assets/google-logo.png");

interface SocialAuthButtonProps {
  provider: "apple" | "google";
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

const PROVIDER_CONFIG = {
  apple: {
    label: "Continue with Apple",
  },
  google: {
    label: "Continue with Google",
  },
};

export function SocialAuthButton({ provider, onPress, loading = false, disabled = false }: SocialAuthButtonProps) {
  const config = PROVIDER_CONFIG[provider];

  function renderIcon() {
    if (loading) return <ActivityIndicator size="small" color={colors.muted} />;
    if (provider === "apple") return <FontAwesome name="apple" size={20} color="#000000" />;
    return <Image source={GOOGLE_LOGO} style={styles.googleLogo} resizeMode="contain" />;
  }

  return (
    <TouchableOpacity
      style={[styles.btn, disabled && styles.btnDisabled]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled || loading}
    >
      <View style={styles.iconWrap}>
        {renderIcon()}
      </View>
      <Text style={styles.label}>{config.label}</Text>
      {/* Spacer keeps label visually centered */}
      <View style={styles.spacer} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  iconWrap: {
    width: 24,
    alignItems: "center",
  },
  googleLogo: {
    width: 20,
    height: 20,
  },
  label: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSize.base,
    color: colors.text,
    marginRight: 24,
  },
  spacer: {
    width: 0,
  },
});