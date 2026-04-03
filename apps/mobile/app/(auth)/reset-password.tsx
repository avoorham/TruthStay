import {
  Alert, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { colors, fontSize, radius, spacing } from "../../lib/theme";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!password || !confirm) {
      Alert.alert("Missing fields", "Please fill in both password fields.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Passwords don't match", "Please check your password.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Password too short", "Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { Alert.alert("Reset failed", error.message); return; }
    Alert.alert(
      "Password updated",
      "Your password has been changed. You're now signed in.",
      [{ text: "Continue", onPress: () => router.replace("/(app)/feed") }],
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.root}
    >
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <Text style={styles.heading}>Set new password</Text>
        <Text style={styles.sub}>Choose a strong password for your account.</Text>

        <Text style={styles.label}>New Password</Text>
        <View style={styles.inputWrap}>
          <TextInput style={[styles.input, styles.inputWithIcon]}
            placeholder="At least 8 characters" placeholderTextColor={colors.subtle}
            value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Confirm Password</Text>
        <View style={styles.inputWrap}>
          <TextInput style={[styles.input, styles.inputWithIcon]}
            placeholder="Repeat your password" placeholderTextColor={colors.subtle}
            value={confirm} onChangeText={setConfirm} secureTextEntry={!showConfirm} />
          <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
            <Feather name={showConfirm ? "eye-off" : "eye"} size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleReset}
          disabled={loading} activeOpacity={0.85}>
          <Text style={styles.btnText}>{loading ? "Updating…" : "Update Password"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F2F2F7" },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 72,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 30, fontWeight: "800", color: colors.text,
    letterSpacing: -0.5, marginBottom: spacing.xs,
  },
  sub: {
    fontSize: fontSize.sm, color: colors.muted,
    lineHeight: 20, marginBottom: spacing.xl,
  },
  label: {
    fontSize: fontSize.sm, fontWeight: "600", color: colors.text,
    marginBottom: spacing.xs, marginTop: spacing.sm,
  },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.card, borderRadius: radius.lg,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  input: {
    flex: 1, paddingHorizontal: spacing.md, paddingVertical: 15,
    fontSize: fontSize.base, color: colors.text,
  },
  inputWithIcon: { paddingRight: 44 },
  eyeBtn: { position: "absolute", right: spacing.md, padding: 4 },
  btn: {
    backgroundColor: colors.text, borderRadius: radius.lg,
    paddingVertical: 16, alignItems: "center", marginTop: spacing.xl,
  },
  btnText: { color: colors.inverse, fontWeight: "700", fontSize: fontSize.base },
});
