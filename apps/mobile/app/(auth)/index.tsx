import {
  ImageBackground, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { colors, fontSize, radius, spacing } from "../../lib/theme";

const BG_IMAGE = require("../../assets/landing-bg.jpg");

export default function LandingScreen() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ImageBackground source={BG_IMAGE} style={styles.bg} resizeMode="cover">
        <LinearGradient
          colors={["rgba(0,0,0,0.20)", "rgba(0,0,0,0.0)", "rgba(0,0,0,0.78)"]}
          locations={[0, 0.38, 1]}
          style={styles.gradient}
        >
          <View style={styles.top}>
            <Text style={styles.welcome}>Welcome to TruthStay</Text>
          </View>

          <View style={styles.bottom}>
            <Text style={styles.headline}>
              Sport-first{"\n"}adventures,{"\n"}honestly reviewed.
            </Text>

            <TouchableOpacity
              style={styles.cta}
              onPress={() => router.push("/(auth)/auth")}
              activeOpacity={0.88}
            >
              <Text style={styles.ctaText}>Let's Go!</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#111" },
  bg: { flex: 1 },
  gradient: { flex: 1, paddingHorizontal: spacing.lg },
  top: { paddingTop: 60 },
  welcome: {
    color: "rgba(255,255,255,0.92)",
    fontSize: fontSize.base,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  bottom: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 52,
    gap: spacing.xl,
  },
  headline: {
    color: "#FFFFFF",
    fontSize: 44,
    fontWeight: "800",
    lineHeight: 52,
    letterSpacing: -1.2,
  },
  cta: {
    backgroundColor: "#FFFFFF",
    borderRadius: radius.full,
    paddingVertical: 18,
    alignItems: "center",
  },
  ctaText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: fontSize.lg,
    letterSpacing: 0.2,
  },
});
