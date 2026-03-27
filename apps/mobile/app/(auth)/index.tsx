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
      <StatusBar style="dark" />
      <ImageBackground source={BG_IMAGE} style={styles.bg} resizeMode="cover">
        {/* Light fade at bottom only — keeps the pale sky clean at the top */}
        <LinearGradient
          colors={["transparent", "transparent", "rgba(255,255,255,0.55)"]}
          locations={[0, 0.55, 1]}
          style={styles.gradient}
        >
          {/* Top — big black title over the pale sky */}
          <View style={styles.top}>
            <Text style={styles.welcome}>Welcome to TruthStay</Text>
          </View>

          {/* Bottom content */}
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
  root: { flex: 1, backgroundColor: "#f0f0ec" },
  bg: { flex: 1 },
  gradient: { flex: 1, paddingHorizontal: spacing.lg },
  top: { paddingTop: 64 },
  welcome: {
    color: "#1A1A1A",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  bottom: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 52,
    gap: spacing.xl,
  },
  headline: {
    color: "#1A1A1A",
    fontSize: 44,
    fontWeight: "800",
    lineHeight: 52,
    letterSpacing: -1.2,
  },
  cta: {
    backgroundColor: "#1A1A1A",
    borderRadius: radius.full,
    paddingVertical: 18,
    alignItems: "center",
  },
  ctaText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: fontSize.lg,
    letterSpacing: 0.2,
  },
});
