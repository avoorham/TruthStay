import {
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { colors, fonts, fontSize, radius, spacing } from "../../lib/theme";

interface FloatingLabelInputProps extends Omit<TextInputProps, "style"> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: boolean;
  valid?: boolean;
  showToggle?: boolean;
  onToggleSecure?: () => void;
}

const LABEL_ACTIVE_Y = 8;
const LABEL_INACTIVE_Y = 18;
const LABEL_ACTIVE_SIZE = 11;
const LABEL_INACTIVE_SIZE = 15;

export function FloatingLabelInput({
  label,
  value,
  onChangeText,
  error = false,
  valid = false,
  showToggle = false,
  onToggleSecure,
  secureTextEntry,
  ...rest
}: FloatingLabelInputProps) {
  const [focused, setFocused] = useState(false);
  const labelY = useRef(new Animated.Value(value ? LABEL_ACTIVE_Y : LABEL_INACTIVE_Y)).current;
  const labelSize = useRef(new Animated.Value(value ? LABEL_ACTIVE_SIZE : LABEL_INACTIVE_SIZE)).current;

  const isActive = focused || value.length > 0;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(labelY, {
        toValue: isActive ? LABEL_ACTIVE_Y : LABEL_INACTIVE_Y,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(labelSize, {
        toValue: isActive ? LABEL_ACTIVE_SIZE : LABEL_INACTIVE_SIZE,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isActive]);

  const borderColor = error
    ? "#D0021B"
    : focused
    ? colors.ocean
    : colors.border;

  // Determine right-side icon
  const showValidIcon = valid && !error && !showToggle;
  const showErrorIcon = error && !showToggle;
  const hasRightIcon = showValidIcon || showErrorIcon || showToggle;

  return (
    <View style={[styles.wrapper, { borderColor }]}>
      <Animated.Text
        style={[
          styles.label,
          {
            top: labelY,
            fontSize: labelSize,
            color: error ? "#D0021B" : focused ? colors.ocean : colors.muted,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        secureTextEntry={secureTextEntry}
        style={[styles.input, hasRightIcon && styles.inputWithIcon]}
        placeholderTextColor="transparent"
        selectionColor={colors.ocean}
        {...rest}
      />

      {hasRightIcon && (
        <View style={styles.iconArea}>
          {showValidIcon && (
            <Feather name="check" size={16} color="#27AE60" />
          )}
          {showErrorIcon && (
            <Feather name="alert-circle" size={16} color="#D0021B" />
          )}
          {showToggle && (
            <View style={styles.toggleRow}>
              {valid && !error && (
                <Feather name="check" size={16} color="#27AE60" style={styles.toggleCheck} />
              )}
              {error && (
                <Feather name="alert-circle" size={16} color="#D0021B" style={styles.toggleCheck} />
              )}
              <TouchableOpacity onPress={onToggleSecure} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather
                  name={secureTextEntry ? "eye" : "eye-off"}
                  size={18}
                  color={colors.muted}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    height: 58,
    justifyContent: "center",
    position: "relative",
    marginBottom: spacing.sm,
  },
  label: {
    position: "absolute",
    left: spacing.md,
    fontFamily: fonts.sans,
    zIndex: 1,
  },
  input: {
    paddingHorizontal: spacing.md,
    paddingTop: 20,
    paddingBottom: 6,
    fontSize: fontSize.base,
    fontFamily: fonts.sans,
    color: colors.text,
    height: "100%",
  },
  inputWithIcon: {
    paddingRight: 52,
  },
  iconArea: {
    position: "absolute",
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  toggleCheck: {
    marginRight: 2,
  },
});