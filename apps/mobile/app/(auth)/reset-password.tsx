import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { colors, fonts, fontSize, spacing } from "../../lib/theme";
import { BrandLogo } from "../../components/onboarding/BrandLogo";
import { FloatingLabelInput } from "../../components/onboarding/FloatingLabelInput";
import { OnboardingButton } from "../../components/onboarding/OnboardingButton";
import { ErrorModal } from "../../components/onboarding/ErrorModal";

interface ModalError {
  title: string;
  messages: string[];
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modalError, setModalError] = useState<ModalError | null>(null);

  async function handleReset() {
    const errors: string[] = [];
    if (!password) errors.push("Password is required.");
    if (!confirm) errors.push("Please confirm your password.");
    if (password && password.length < 8) errors.push("Password must be at least 8 characters.");
    if (password && confirm && password !== confirm) errors.push("Passwords don't match.");

    if (errors.length > 0) {
      setModalError({ title: "Please check your password", messages: errors });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setModalError({ title: "Reset failed", messages: [error.message] });
      return;
    }

    setModalError({
      title: "Password updated",
      messages: ["Your password has been changed. You're now signed in."],
    });
    // Navigate after modal is dismissed
  }

  const passwordsMatch = password.length > 0 && confirm.length > 0 && password === confirm;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.root}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BrandLogo size={36} style={styles.logo} />

        <Text style={styles.heading}>Set new password</Text>
        <Text style={styles.sub}>Choose a strong password for your account.</Text>

        <View style={styles.fields}>
          <FloatingLabelInput
            label="New Password*"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            showToggle
            onToggleSecure={() => setShowPassword(!showPassword)}
            valid={password.length >= 8}
            autoCapitalize="none"
            returnKeyType="next"
          />

          <FloatingLabelInput
            label="Confirm Password*"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!showConfirm}
            showToggle
            onToggleSecure={() => setShowConfirm(!showConfirm)}
            valid={passwordsMatch}
            error={confirm.length > 0 && password !== confirm}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleReset}
          />
        </View>

        <OnboardingButton
          label="Update Password"
          onPress={handleReset}
          variant="primary"
          loading={loading}
          style={styles.btn}
        />
      </ScrollView>

      <ErrorModal
        visible={modalError !== null}
        title={modalError?.title ?? ""}
        messages={modalError?.messages ?? []}
        onClose={() => {
          const wasSuccess = modalError?.title === "Password updated";
          setModalError(null);
          if (wasSuccess) router.replace("/(app)/feed");
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 72,
    paddingBottom: 40,
  },
  logo: {
    alignSelf: "center",
    marginBottom: spacing.xl,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.text,
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
  },
  sub: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  fields: {
    gap: 0,
  },
  btn: {
    marginTop: spacing.xl,
  },
});