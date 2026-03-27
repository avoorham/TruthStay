import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { AntDesign, FontAwesome } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { colors, fontSize, radius, spacing } from "../../lib/theme";

const BG_IMAGE = require("../../assets/landing-bg.jpg");

type Screen = "options" | "signup" | "login";

export default function AuthScreen() {
  const [screen, setScreen] = useState<Screen>("options");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!username || !email || !password) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Passwords don't match", "Please check your password.");
      return;
    }
    if (!agreedToTerms) {
      Alert.alert("Terms required", "Please agree to the terms and conditions.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: username.trim(), display_name: username.trim() } },
    });
    setLoading(false);

    if (error) {
      Alert.alert("Sign up failed", error.message);
      return;
    }

    if (!data.session) {
      Alert.alert(
        "Almost there!",
        "We sent a confirmation link to " + email.trim() + ". Tap it to activate your account, then come back to log in.\n\n(Tip: check your spam folder.)"
      );
      setScreen("login");
    }
  }

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) Alert.alert("Sign in failed", error.message);
  }

  // ── Options screen ────────────────────────────────────────────────────────
  if (screen === "options") {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />

        <ImageBackground source={BG_IMAGE} style={styles.photoBg} resizeMode="cover">
          <LinearGradient
            colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.0)"]}
            style={styles.photoGradient}
          />
        </ImageBackground>

        <View style={styles.sheet}>
          <View style={styles.pill} />

          <Text style={styles.heading}>Welcome to TruthStay</Text>
          <Text style={styles.sub}>Sport-first adventure planning</Text>

          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => setScreen("signup")}
            activeOpacity={0.88}
          >
            <Text style={styles.btnPrimaryText}>Sign Up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => setScreen("login")}
            activeOpacity={0.88}
          >
            <Text style={styles.btnSecondaryText}>Login to TruthStay</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialStack}>
            <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
              <View style={[styles.socialIconWrap, { backgroundColor: "#000" }]}>
                <FontAwesome name="apple" size={16} color="#fff" />
              </View>
              <Text style={styles.socialBtnText}>Continue with Apple</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
              <View style={[styles.socialIconWrap, { backgroundColor: "#1877F2" }]}>
                <FontAwesome name="facebook" size={16} color="#fff" />
              </View>
              <Text style={styles.socialBtnText}>Continue with Facebook</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
              <View style={[styles.socialIconWrap, { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border }]}>
                <AntDesign name="google" size={15} color="#4285F4" />
              </View>
              <Text style={styles.socialBtnText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.legal}>
            By continuing you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </View>
    );
  }

  // ── Sign Up form ──────────────────────────────────────────────────────────
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
          {/* Back button */}
          <TouchableOpacity onPress={() => setScreen("options")} style={styles.backBtn}>
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.formHeading}>Create Account</Text>
          <Text style={styles.formSub}>
            Join our community and experience sport-first adventure planning
          </Text>

          {/* Username */}
          <Text style={styles.label}>Username</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Enter your username"
              placeholderTextColor={colors.subtle}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={colors.subtle}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, styles.inputWithIcon]}
              placeholder="Enter your password"
              placeholderTextColor={colors.subtle}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeBtn}
            >
              <Text style={styles.eyeIcon}>{showPassword ? "🙈" : "👁"}</Text>
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={[styles.input, styles.inputWithIcon]}
              placeholder="Confirm your password"
              placeholderTextColor={colors.subtle}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
            />
            <TouchableOpacity
              onPress={() => setShowConfirm(!showConfirm)}
              style={styles.eyeBtn}
            >
              <Text style={styles.eyeIcon}>{showConfirm ? "🙈" : "👁"}</Text>
            </TouchableOpacity>
          </View>

          {/* Terms */}
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setAgreedToTerms(!agreedToTerms)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
              {agreedToTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termsText}>
              By agreeing to the terms and conditions, you are entering into a legally
              binding contract with the service provider.
            </Text>
          </TouchableOpacity>

          {/* Continue */}
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={handleSignUp}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>
              {loading ? "Creating account…" : "Continue"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setScreen("login")}
            style={styles.switchRow}
          >
            <Text style={styles.switchText}>
              Already have an account?{" "}
              <Text style={styles.switchLink}>Login</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Login form ────────────────────────────────────────────────────────────
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
        <TouchableOpacity onPress={() => setScreen("options")} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.formHeading}>Welcome back</Text>
        <Text style={styles.formSub}>Sign in to your TruthStay account</Text>

        <Text style={styles.label}>Email</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor={colors.subtle}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />
        </View>

        <Text style={styles.label}>Password</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={[styles.input, styles.inputWithIcon]}
            placeholder="Enter your password"
            placeholderTextColor={colors.subtle}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeBtn}
          >
            <Text style={styles.eyeIcon}>{showPassword ? "🙈" : "👁"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.continueBtn}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.continueBtnText}>
            {loading ? "Signing in…" : "Sign in"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setScreen("signup")} style={styles.switchRow}>
          <Text style={styles.switchText}>
            No account?{" "}
            <Text style={styles.switchLink}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // ── Options ──
  root: { flex: 1, backgroundColor: "#111" },
  photoBg: { height: 260 },
  photoGradient: { flex: 1 },
  sheet: {
    flex: 1,
    backgroundColor: colors.card,
    marginTop: -44,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 40,
  },
  pill: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: radius.full,
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  heading: {
    fontSize: fontSize.xxl,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: 4,
    marginBottom: spacing.xl,
  },
  btnPrimary: {
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  btnPrimaryText: { color: colors.inverse, fontWeight: "700", fontSize: fontSize.base },
  btnSecondary: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  btnSecondaryText: { color: colors.text, fontWeight: "600", fontSize: fontSize.base },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.lg,
    gap: spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.muted, fontSize: fontSize.sm, fontWeight: "500" },
  socialStack: { gap: spacing.sm },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
  },
  socialIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  socialBtnText: {
    flex: 1,
    textAlign: "center",
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text,
    marginRight: 28,
  },
  legal: {
    fontSize: fontSize.xs,
    color: colors.subtle,
    textAlign: "center",
    marginTop: spacing.xl,
    lineHeight: 16,
  },

  // ── Sign Up / Login form ──
  formRoot: { flex: 1, backgroundColor: "#F2F2F7" },
  formScroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 56,
    paddingBottom: 40,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  backChevron: {
    fontSize: 24,
    color: colors.text,
    lineHeight: 28,
    marginLeft: -2,
  },
  formHeading: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  formSub: {
    fontSize: fontSize.sm,
    color: colors.muted,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 15,
    fontSize: fontSize.base,
    color: colors.text,
  },
  inputWithIcon: { paddingRight: 44 },
  eyeBtn: {
    position: "absolute",
    right: spacing.md,
    padding: 4,
  },
  eyeIcon: { fontSize: 16 },

  // Terms
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 18,
    height: 18,
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
  checkmark: { color: "#fff", fontSize: 11, fontWeight: "700" },
  termsText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.muted,
    lineHeight: 17,
  },

  // Continue button
  continueBtn: {
    backgroundColor: "#E5E5EA",
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: spacing.md,
  },
  continueBtnText: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text,
  },

  switchRow: { paddingVertical: spacing.md, alignItems: "center" },
  switchText: { color: colors.muted, fontSize: fontSize.sm },
  switchLink: { color: "#007AFF", fontWeight: "700" },
});
