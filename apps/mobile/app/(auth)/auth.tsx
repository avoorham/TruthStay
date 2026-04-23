import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Feather } from "@expo/vector-icons";
import { FontAwesome } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { signInWithProvider, type SocialProvider } from "../../lib/social-auth";
import { colors, fonts, fontSize, spacing } from "../../lib/theme";
import { BrandLogo } from "../../components/onboarding/BrandLogo";
import { OnboardingButton } from "../../components/onboarding/OnboardingButton";
import { FloatingLabelInput } from "../../components/onboarding/FloatingLabelInput";
import { PasswordHintPanel } from "../../components/onboarding/PasswordHintPanel";
import { SocialAuthButton } from "../../components/onboarding/SocialAuthButton";
import { ErrorModal } from "../../components/onboarding/ErrorModal";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type Screen = "options" | "signup" | "login" | "forgot";

interface ModalError {
  title: string;
  messages: string[];
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(pw: string) {
  if (pw.length < 8) return false;
  let met = 0;
  if (/[a-z]/.test(pw)) met++;
  if (/[A-Z]/.test(pw)) met++;
  if (/[0-9]/.test(pw)) met++;
  if (/[^a-zA-Z0-9]/.test(pw)) met++;
  return met >= 3;
}

export default function AuthScreen() {
  const [screen, setScreen] = useState<Screen>("options");

  // Shared fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sign-up specific
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Social auth
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);

  // Modal
  const [modalError, setModalError] = useState<ModalError | null>(null);

  // Field validity helpers (only show valid state after user has typed)
  const firstNameValid = firstName.trim().length > 0;
  const lastNameValid = lastName.trim().length > 0;
  const emailValid = isValidEmail(email);
  const passwordValid = isValidPassword(password);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSignUp() {
    const errors: string[] = [];
    if (!firstName.trim()) errors.push("First name is required.");
    if (!lastName.trim()) errors.push("Last name is required.");
    if (!email.trim() || !isValidEmail(email)) errors.push("A valid email address is required.");
    if (!password || !isValidPassword(password)) {
      errors.push("Your password doesn't meet our requirements.");
    }
    if (errors.length > 0) {
      setModalError({
        title: "It looks like some information is missing or incorrect.",
        messages: errors,
      });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          display_name: `${firstName.trim()} ${lastName.trim()}`,
          needs_onboarding: true,
        },
      },
    });
    setLoading(false);

    if (error) {
      setModalError({ title: "Sign up failed", messages: [error.message] });
      return;
    }
    if (!data.session) {
      setModalError({
        title: "Almost there!",
        messages: [
          `We sent a confirmation link to ${email.trim()}.`,
          "Tap it to activate your account, then log in.",
          "(Check your spam folder too.)",
        ],
      });
      setScreen("login");
    }
  }

  async function handleLogin() {
    const errors: string[] = [];
    if (!email.trim()) errors.push("Email address is required.");
    if (!password) errors.push("Password is required.");
    if (errors.length > 0) {
      setModalError({
        title: "Missing information",
        messages: errors,
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      setModalError({ title: "Sign in failed", messages: [error.message] });
    }
  }

  async function handleSocialSignIn(provider: SocialProvider) {
    setSocialLoading(provider);
    const { error } = await signInWithProvider(provider);
    setSocialLoading(null);
    if (error) {
      setModalError({ title: "Sign-in failed", messages: [error] });
    }
    // On success onAuthStateChange fires → auth-context routes to feed/onboarding automatically
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setModalError({
        title: "Email required",
        messages: ["Please enter the email address for your account."],
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: "truthstay://reset-password",
    });
    setLoading(false);

    if (error) {
      setModalError({ title: "Failed", messages: [error.message] });
      return;
    }

    setModalError({
      title: "Check your email",
      messages: [
        `We've sent a password reset link to ${email.trim()}.`,
        "Tap the link in the email to set a new password.",
        "(Check your spam folder too.)",
      ],
    });
  }

  // ── Options screen ─────────────────────────────────────────────────────────
  if (screen === "options") {
    return (
      <View style={styles.optionsRoot}>
        <StatusBar style="light" />

        {/* Coral hero panel */}
        <View style={styles.hero}>
          <BrandLogo size={72} style={styles.heroLogo} />
          <Text style={styles.heroWordmark}>TruthStay</Text>
        </View>

        {/* White content area */}
        <ScrollView
          style={styles.optionsContent}
          contentContainerStyle={styles.optionsContentInner}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.optionsHeading}>Welcome to TruthStay</Text>
          <Text style={styles.optionsSub}>Discover honest adventure, together.</Text>

          {/* Spacer that pushes CTAs toward bottom */}
          <View style={styles.optionsSpacer} />

          {/* Terms checkbox */}
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setAgreedToTerms(!agreedToTerms)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
              {agreedToTerms && <Feather name="check" size={12} color="#fff" />}
            </View>
            <Text style={styles.termsText}>
              I agree to TruthStay&apos;s{" "}
              <Text style={styles.termsLink}>Terms of Service</Text>
              {" "}and{" "}
              <Text style={styles.termsLink}>Privacy Policy</Text>.
            </Text>
          </TouchableOpacity>

          <OnboardingButton
            label="Create an account"
            onPress={() => setScreen("signup")}
            variant="primary"
            disabled={!agreedToTerms}
            style={styles.optionsBtn}
          />

          <OnboardingButton
            label="Log in"
            onPress={() => setScreen("login")}
            variant="secondary"
            style={styles.optionsBtn}
          />
        </ScrollView>

        <ErrorModal
          visible={modalError !== null}
          title={modalError?.title ?? ""}
          messages={modalError?.messages ?? []}
          onClose={() => setModalError(null)}
        />
      </View>
    );
  }

  // ── Sign-up form ───────────────────────────────────────────────────────────
  if (screen === "signup") {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.formRoot}
      >
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BrandLogo size={36} style={styles.formLogo} />

          <Text style={styles.formHeading}>Sign Up</Text>
          <Text style={styles.formSub}>
            Join the adventure community and start planning honest trips.
          </Text>

          <TouchableOpacity onPress={() => setScreen("login")} style={styles.switchRow}>
            <Text style={styles.switchText}>
              Already have an account?{" "}
              <Text style={styles.switchLink}>Log in</Text>
            </Text>
          </TouchableOpacity>

          <FloatingLabelInput
            label="First name*"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            autoCorrect={false}
            valid={firstNameValid}
            returnKeyType="next"
          />

          <FloatingLabelInput
            label="Last name*"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            autoCorrect={false}
            valid={lastNameValid}
            returnKeyType="next"
          />

          <FloatingLabelInput
            label="Email address*"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            valid={emailValid && email.length > 0}
            returnKeyType="next"
          />

          <FloatingLabelInput
            label="Password (8+ characters)*"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            showToggle
            onToggleSecure={() => setShowPassword(!showPassword)}
            valid={passwordValid && password.length > 0}
            autoCapitalize="none"
            returnKeyType="done"
          />

          <PasswordHintPanel />

          <OnboardingButton
            label="Create an account"
            onPress={handleSignUp}
            variant="primary"
            loading={loading}
            style={styles.submitBtn}
          />

          {/* Compact social links at bottom */}
          <Text style={styles.socialLabel}>Or sign up faster with</Text>
          <View style={styles.socialCircles}>
            <TouchableOpacity
              style={[styles.socialCircle, !!socialLoading && styles.socialCircleDisabled]}
              activeOpacity={0.8}
              onPress={() => handleSocialSignIn("google")}
              disabled={!!socialLoading}
            >
              {socialLoading === "google"
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.socialCircleText}>G</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.socialCircle, styles.socialCircleApple, !!socialLoading && styles.socialCircleDisabled]}
              activeOpacity={0.8}
              onPress={() => handleSocialSignIn("apple")}
              disabled={!!socialLoading}
            >
              {socialLoading === "apple"
                ? <ActivityIndicator size="small" color="#fff" />
                : <FontAwesome name="apple" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </ScrollView>

        <ErrorModal
          visible={modalError !== null}
          title={modalError?.title ?? ""}
          messages={modalError?.messages ?? []}
          onClose={() => setModalError(null)}
        />
      </KeyboardAvoidingView>
    );
  }

  // ── Login form ─────────────────────────────────────────────────────────────
  if (screen === "login") {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.formRoot}
      >
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BrandLogo size={36} style={styles.formLogo} />

          <Text style={styles.formHeading}>Welcome back</Text>
          <Text style={styles.formSub}>Sign in to your TruthStay account.</Text>

          <TouchableOpacity onPress={() => setScreen("signup")} style={styles.switchRow}>
            <Text style={styles.switchText}>
              No account?{" "}
              <Text style={styles.switchLink}>Sign up</Text>
            </Text>
          </TouchableOpacity>

          <FloatingLabelInput
            label="Email address*"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            valid={emailValid && email.length > 0}
            returnKeyType="next"
          />

          <FloatingLabelInput
            label="Password*"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            showToggle
            onToggleSecure={() => setShowPassword(!showPassword)}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <OnboardingButton
            label="Sign in"
            onPress={handleLogin}
            variant="primary"
            loading={loading}
            style={styles.submitBtn}
          />

          <OnboardingButton
            label="Forgot password?"
            onPress={() => setScreen("forgot")}
            variant="ghost"
            style={styles.ghostBtn}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <SocialAuthButton provider="apple"    onPress={() => handleSocialSignIn("apple")}    loading={socialLoading === "apple"}    disabled={!!socialLoading} />
          <SocialAuthButton provider="google"   onPress={() => handleSocialSignIn("google")}   loading={socialLoading === "google"}   disabled={!!socialLoading} />
        </ScrollView>

        <ErrorModal
          visible={modalError !== null}
          title={modalError?.title ?? ""}
          messages={modalError?.messages ?? []}
          onClose={() => setModalError(null)}
        />
      </KeyboardAvoidingView>
    );
  }

  // ── Forgot password ────────────────────────────────────────────────────────
  if (screen === "forgot") {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.formRoot}
      >
        <StatusBar style="dark" />
        <ScrollView
          contentContainerStyle={styles.formScroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity onPress={() => setScreen("login")} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.formHeading}>Reset password</Text>
          <Text style={styles.formSub}>
            Enter your email and we&apos;ll send you a link to set a new password.
          </Text>

          <FloatingLabelInput
            label="Email address*"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            valid={emailValid && email.length > 0}
            returnKeyType="done"
            onSubmitEditing={handleForgotPassword}
          />

          <OnboardingButton
            label="Send reset link"
            onPress={handleForgotPassword}
            variant="primary"
            loading={loading}
            style={styles.submitBtn}
          />

          <OnboardingButton
            label="Back to login"
            onPress={() => setScreen("login")}
            variant="ghost"
            style={styles.ghostBtn}
          />
        </ScrollView>

        <ErrorModal
          visible={modalError !== null}
          title={modalError?.title ?? ""}
          messages={modalError?.messages ?? []}
          onClose={() => setModalError(null)}
        />
      </KeyboardAvoidingView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  // ── Options ──
  optionsRoot: {
    flex: 1,
    backgroundColor: colors.accent,
  },
  hero: {
    height: SCREEN_HEIGHT * 0.42,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  heroLogo: {
    // shadow is in BrandLogo; override to white glow on coral bg
    shadowColor: "rgba(0,0,0,0.25)",
  },
  heroWordmark: {
    fontFamily: fonts.display,
    color: "#FFFFFF",
    fontSize: fontSize.xl,
    letterSpacing: 0.2,
  },
  optionsContent: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
  optionsContentInner: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 48,
  },
  optionsHeading: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.text,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  optionsSub: {
    fontFamily: fonts.sans,
    fontSize: fontSize.base,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  optionsSpacer: {
    flex: 1,
    minHeight: spacing.xxl,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
    backgroundColor: colors.card,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  termsText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
    lineHeight: 20,
  },
  termsLink: {
    color: colors.ocean,
    fontFamily: fonts.sansSemiBold,
  },
  optionsBtn: {
    marginBottom: spacing.sm,
  },

  // ── Forms shared ──
  formRoot: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  formScroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 56,
    paddingBottom: 40,
  },
  formLogo: {
    alignSelf: "center",
    marginBottom: spacing.xl,
  },
  formHeading: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.text,
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
  },
  formSub: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  switchRow: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  switchText: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  switchLink: {
    color: colors.ocean,
    fontFamily: fonts.sansSemiBold,
  },
  submitBtn: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  ghostBtn: {
    alignSelf: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.lg,
    gap: spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    fontFamily: fonts.sansMedium,
    fontSize: fontSize.sm,
    color: colors.muted,
  },

  // ── Social circles (sign-up bottom) ──
  socialLabel: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  socialCircles: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  socialCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  socialCircleText: {
    fontFamily: fonts.sansBold,
    fontSize: 18,
    color: "#4285F4",
  },
  socialCircleFb: {
    backgroundColor: "#1877F2",
  },
  socialCircleApple: {
    backgroundColor: "#000000",
  },
  socialCircleDisabled: {
    opacity: 0.5,
  },
});