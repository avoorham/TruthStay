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
import { supabase } from "../../lib/supabase";
import { colors, fontSize, radius, spacing } from "../../lib/theme";

const BG_IMAGE = require("../../assets/landing-bg.jpg");

type Screen = "options" | "signup" | "login";

export default function AuthScreen() {
  const [screen, setScreen] = useState<Screen>("options");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!email || !password) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: displayName || email.split("@")[0] } },
    });
    setLoading(false);

    if (error) {
      Alert.alert("Sign up failed", error.message);
      return;
    }

    // If email confirmation is disabled in Supabase, data.session is set immediately.
    // Otherwise, prompt the user to check their email.
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

        {/* Photo background — top portion visible above the sheet */}
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

          {/* Social buttons — visual placeholders */}
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
              <Text style={styles.socialIcon}>🍎</Text>
              <Text style={styles.socialLabel}>Apple</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
              <Text style={styles.socialIcon}>𝒇</Text>
              <Text style={styles.socialLabel}>Facebook</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
              <Text style={styles.socialIcon}>G</Text>
              <Text style={styles.socialLabel}>Google</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.legal}>
            By continuing you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </View>
    );
  }

  // ── Sign Up / Login form ──────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.root}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.formScroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => setScreen("options")} style={styles.back}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.heading}>
            {screen === "signup" ? "Create account" : "Welcome back"}
          </Text>
          <Text style={styles.sub}>
            {screen === "signup"
              ? "Join the TruthStay community"
              : "Sign in to your account"}
          </Text>
        </View>

        <View style={styles.inputs}>
          {screen === "signup" && (
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={colors.muted}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={screen === "signup" ? handleSignUp : handleLogin}
          disabled={loading}
          activeOpacity={0.88}
        >
          <Text style={styles.btnPrimaryText}>
            {loading ? "…" : screen === "signup" ? "Create account" : "Sign in"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setScreen(screen === "signup" ? "login" : "signup")}
          style={styles.switchRow}
        >
          <Text style={styles.switchText}>
            {screen === "signup"
              ? "Already have an account? "
              : "No account? "}
            <Text style={styles.switchLink}>
              {screen === "signup" ? "Sign in" : "Sign up"}
            </Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#111" },

  // Photo background strip — shows cyclist above the sheet
  photoBg: { height: 260 },
  photoGradient: { flex: 1 },

  // Bottom sheet card
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
  btnPrimaryText: {
    color: colors.inverse,
    fontWeight: "700",
    fontSize: fontSize.base,
  },
  btnSecondary: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  btnSecondaryText: {
    color: colors.text,
    fontWeight: "600",
    fontSize: fontSize.base,
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.lg,
    gap: spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.muted, fontSize: fontSize.sm, fontWeight: "500" },

  socialRow: { flexDirection: "row", gap: spacing.sm },
  socialBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    gap: 4,
  },
  socialIcon: { fontSize: 18 },
  socialLabel: { fontSize: fontSize.xs, color: colors.muted, fontWeight: "500" },

  legal: {
    fontSize: fontSize.xs,
    color: colors.subtle,
    textAlign: "center",
    marginTop: spacing.xl,
    lineHeight: 16,
  },

  // Form scroll
  formScroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: 40,
  },
  formHeader: { marginBottom: spacing.xl },
  back: { marginBottom: spacing.md },
  backText: { color: colors.muted, fontSize: fontSize.base },
  inputs: { gap: spacing.sm, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: fontSize.base,
    color: colors.text,
  },
  switchRow: { paddingVertical: spacing.md, alignItems: "center" },
  switchText: { color: colors.muted, fontSize: fontSize.sm },
  switchLink: { color: colors.accent, fontWeight: "700" },
});
