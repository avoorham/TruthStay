import {
  ActivityIndicator, Alert, Linking, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { colors, fontSize, radius, spacing } from "../../lib/theme";

const TOS_URL     = "https://truthstay.com/terms";
const PRIVACY_URL = "https://truthstay.com/privacy";

export default function ConsentScreen() {
  const [agreeing, setAgreeing] = useState(false);

  const handleAgree = async () => {
    setAgreeing(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { terms_accepted_at: new Date().toISOString() },
      });
      if (error) throw error;
      // onAuthStateChange fires automatically and updates the auth context.
      // The auth layout will then redirect to onboarding or the app.
    } catch {
      Alert.alert("Error", "Could not record your acceptance. Please try again.");
      setAgreeing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.heading}>Review and agree</Text>

        <Text style={styles.body}>
          By choosing the button below, you agree to TruthStay's{" "}
          <Text style={styles.link} onPress={() => Linking.openURL(TOS_URL)}>
            Terms of Service
          </Text>
          , acknowledge you've read the{" "}
          <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL)}>
            Privacy Policy
          </Text>
          , and confirm you're at least{" "}
          <Text style={styles.highlight}>18 years old</Text>.
        </Text>

        <Text style={styles.body}>
          TruthStay helps you discover and plan outdoor adventures. We'll
          personalise your experience based on your activity preferences and
          trip history.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.agreeBtn, agreeing && styles.agreeBtnDisabled]}
          onPress={handleAgree}
          disabled={agreeing}
          activeOpacity={0.85}
        >
          {agreeing
            ? <ActivityIndicator color={colors.inverse} />
            : <Text style={styles.agreeBtnText}>I agree to all</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.sheet,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.lg,
  },
  heading: {
    fontSize: fontSize.xxl,
    fontWeight: "800",
    color: colors.text,
    lineHeight: 34,
  },
  body: {
    fontSize: fontSize.base,
    color: colors.muted,
    lineHeight: 24,
  },
  link: {
    color: colors.accent,
    fontWeight: "600",
  },
  highlight: {
    color: colors.coral,
    fontWeight: "700",
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  agreeBtn: {
    backgroundColor: colors.text,
    borderRadius: radius.xl,
    paddingVertical: 16,
    alignItems: "center",
  },
  agreeBtnDisabled: { opacity: 0.5 },
  agreeBtnText: {
    color: colors.inverse,
    fontWeight: "700",
    fontSize: fontSize.base,
  },
});