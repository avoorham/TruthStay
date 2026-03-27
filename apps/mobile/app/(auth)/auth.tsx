import {
  Alert,
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { FontAwesome } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { colors, fontSize, radius, spacing } from "../../lib/theme";

const BG_IMAGE = require("../../assets/landing-bg.jpg");
const GOOGLE_LOGO = require("../../assets/google-logo.png");

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const PEEK_Y = SCREEN_HEIGHT * 0.40; // image visible above sheet
const FULL_Y = 0;                    // sheet fills screen
const SNAP_THRESHOLD = 60;

// Apple logo rendered inline from SVG path — no asset conversion needed
function AppleLogo({ size = 20, color = "#fff" }: { size?: number; color?: string }) {
  // Original viewBox: 814 × 1000
  return (
    <Svg width={size * 0.814} height={size} viewBox="0 0 814 1000">
      <Path
        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"
        fill={color}
      />
    </Svg>
  );
}

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

  // ── Bottom sheet drag ─────────────────────────────────────────────────────
  const translateY = useRef(new Animated.Value(PEEK_Y)).current;
  const lastY = useRef(PEEK_Y);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 8,
      onPanResponderGrant: () => {
        translateY.setOffset(lastY.current);
        translateY.setValue(0);
      },
      onPanResponderMove: (_, { dy }) => {
        const next = lastY.current + dy;
        if (next >= FULL_Y && next <= PEEK_Y) {
          translateY.setValue(dy);
        }
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        translateY.flattenOffset();
        const snapTo =
          vy < -0.4 || dy < -SNAP_THRESHOLD
            ? FULL_Y
            : vy > 0.4 || dy > SNAP_THRESHOLD
            ? PEEK_Y
            : lastY.current < PEEK_Y / 2
            ? FULL_Y
            : PEEK_Y;
        lastY.current = snapTo;
        Animated.spring(translateY, {
          toValue: snapTo,
          useNativeDriver: true,
          tension: 70,
          friction: 12,
        }).start();
      },
    })
  ).current;

  // ── Auth handlers ─────────────────────────────────────────────────────────
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
    if (error) { Alert.alert("Sign up failed", error.message); return; }
    if (!data.session) {
      Alert.alert(
        "Almost there!",
        "We sent a confirmation link to " + email.trim() + ". Tap it to activate your account, then log in.\n\n(Check your spam folder too.)"
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
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert("Sign in failed", error.message);
  }

  // ── Options screen ────────────────────────────────────────────────────────
  if (screen === "options") {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />

        {/* Static full-screen background */}
        <ImageBackground
          source={BG_IMAGE}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />

        {/* Draggable sheet */}
        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }] }]}
        >
          {/* Pill drag handle */}
          <View style={styles.pillArea} {...panResponder.panHandlers}>
            <View style={styles.pill} />
          </View>

          {/* Scrollable content inside the sheet */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.sheetContent}
          >
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

            {/* Social buttons */}
            <View style={styles.socialStack}>
              {/* Apple */}
              <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
                <View style={[styles.socialIconCircle, { backgroundColor: "rgba(0,0,0,0.12)" }]}>
                  <AppleLogo size={20} color="#000" />
                </View>
                <Text style={styles.socialBtnText}>Continue with Apple</Text>
              </TouchableOpacity>

              {/* Facebook */}
              <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
                <View style={[styles.socialIconCircle, { backgroundColor: "rgba(24,119,242,0.12)" }]}>
                  <FontAwesome name="facebook" size={18} color="#1877F2" />
                </View>
                <Text style={styles.socialBtnText}>Continue with Facebook</Text>
              </TouchableOpacity>

              {/* Google */}
              <TouchableOpacity style={styles.socialBtn} activeOpacity={0.8}>
                <View style={[styles.socialIconCircle, { backgroundColor: "rgba(66,133,244,0.10)" }]}>
                  <Image source={GOOGLE_LOGO} style={styles.googleLogo} resizeMode="contain" />
                </View>
                <Text style={styles.socialBtnText}>Continue with Google</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.legal}>
              By continuing you agree to our Terms of Service and Privacy Policy.
            </Text>
          </ScrollView>
        </Animated.View>
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
          <TouchableOpacity onPress={() => setScreen("options")} style={styles.backBtn}>
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.formHeading}>Create Account</Text>
          <Text style={styles.formSub}>
            Join our community and experience sport-first adventure planning
          </Text>

          <Text style={styles.label}>Username</Text>
          <View style={styles.inputWrap}>
            <TextInput style={styles.input} placeholder="Enter your username"
              placeholderTextColor={colors.subtle} value={username}
              onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
          </View>

          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrap}>
            <TextInput style={styles.input} placeholder="Enter your email"
              placeholderTextColor={colors.subtle} value={email}
              onChangeText={setEmail} autoCapitalize="none"
              keyboardType="email-address" autoCorrect={false} />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <TextInput style={[styles.input, styles.inputWithIcon]}
              placeholder="Enter your password" placeholderTextColor={colors.subtle}
              value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Text style={styles.eyeIcon}>{showPassword ? "🙈" : "👁"}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.inputWrap}>
            <TextInput style={[styles.input, styles.inputWithIcon]}
              placeholder="Confirm your password" placeholderTextColor={colors.subtle}
              value={confirmPassword} onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm} />
            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
              <Text style={styles.eyeIcon}>{showConfirm ? "🙈" : "👁"}</Text>
            </TouchableOpacity>
          </View>

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

          <TouchableOpacity style={styles.continueBtn} onPress={handleSignUp}
            disabled={loading} activeOpacity={0.85}>
            <Text style={styles.continueBtnText}>
              {loading ? "Creating account…" : "Continue"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setScreen("login")} style={styles.switchRow}>
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
      <ScrollView contentContainerStyle={styles.formScroll}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => setScreen("options")} style={styles.backBtn}>
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.formHeading}>Welcome back</Text>
        <Text style={styles.formSub}>Sign in to your TruthStay account</Text>

        <Text style={styles.label}>Email</Text>
        <View style={styles.inputWrap}>
          <TextInput style={styles.input} placeholder="Enter your email"
            placeholderTextColor={colors.subtle} value={email} onChangeText={setEmail}
            autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
        </View>

        <Text style={styles.label}>Password</Text>
        <View style={styles.inputWrap}>
          <TextInput style={[styles.input, styles.inputWithIcon]}
            placeholder="Enter your password" placeholderTextColor={colors.subtle}
            value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <Text style={styles.eyeIcon}>{showPassword ? "🙈" : "👁"}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.continueBtn} onPress={handleLogin}
          disabled={loading} activeOpacity={0.85}>
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
  root: { flex: 1, backgroundColor: "#f0f0ec" },

  // Draggable sheet — absolutely positioned so it slides over the photo
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    // sheet starts at PEEK_Y so its content begins below the image peek area
    marginTop: PEEK_Y,
  },
  pillArea: {
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  pill: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: radius.full,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 48,
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
  socialIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  googleLogo: {
    width: 20,
    height: 20,
  },
  socialBtnText: {
    flex: 1,
    textAlign: "center",
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text,
    marginRight: 36,
  },
  legal: {
    fontSize: fontSize.xs,
    color: colors.subtle,
    textAlign: "center",
    marginTop: spacing.xl,
    lineHeight: 16,
  },

  // ── Forms ──
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
  backChevron: { fontSize: 24, color: colors.text, lineHeight: 28, marginLeft: -2 },
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
  eyeBtn: { position: "absolute", right: spacing.md, padding: 4 },
  eyeIcon: { fontSize: 16 },
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
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkmark: { color: "#fff", fontSize: 11, fontWeight: "700" },
  termsText: { flex: 1, fontSize: fontSize.xs, color: colors.muted, lineHeight: 17 },
  continueBtn: {
    backgroundColor: "#E5E5EA",
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: spacing.md,
  },
  continueBtnText: { fontSize: fontSize.base, fontWeight: "600", color: colors.text },
  switchRow: { paddingVertical: spacing.md, alignItems: "center" },
  switchText: { color: colors.muted, fontSize: fontSize.sm },
  switchLink: { color: "#007AFF", fontWeight: "700" },
});
