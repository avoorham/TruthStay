import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { router } from "expo-router";
import { colors } from "../../lib/theme";
import { BrandLogo } from "../../components/onboarding/BrandLogo";

export default function SplashScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/(auth)/auth");
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <BrandLogo size={88} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});