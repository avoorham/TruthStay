import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { colors, fontSize, radius, spacing } from "../../lib/theme";

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAuth() {
    setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) Alert.alert("Sign in failed", error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { username, display_name: displayName } },
      });
      if (error) Alert.alert("Sign up failed", error.message);
      else Alert.alert("Check your email", "We sent you a confirmation link.");
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        {/* Wordmark */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>TruthStay</Text>
          <Text style={styles.tagline}>Sport-first adventure planning</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === "signup" && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Display name"
                placeholderTextColor={colors.muted}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
              />
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={colors.muted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
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

          <TouchableOpacity style={styles.btn} onPress={handleAuth} disabled={loading} activeOpacity={0.85}>
            <Text style={styles.btnText}>
              {loading ? "…" : mode === "login" ? "Sign in" : "Create account"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode(mode === "login" ? "signup" : "login")} style={styles.toggle}>
            <Text style={styles.toggleText}>
              {mode === "login" ? "No account? Sign up" : "Already have an account? Sign in"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flexGrow: 1, justifyContent: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.xxl },
  header: { marginBottom: spacing.xl },
  wordmark: { fontSize: fontSize.xxxl, fontWeight: "800", color: colors.text, letterSpacing: -1 },
  tagline: { fontSize: fontSize.base, color: colors.muted, marginTop: spacing.xs },
  form: { gap: spacing.sm },
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
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  btnText: { color: colors.inverse, fontWeight: "700", fontSize: fontSize.base },
  toggle: { paddingVertical: spacing.md, alignItems: "center" },
  toggleText: { color: colors.muted, fontSize: fontSize.sm },
});
