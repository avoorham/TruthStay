import { Stack } from "expo-router";
import { ActivityIndicator, Platform, StyleSheet, UIManager, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { colors } from "../lib/theme";
import { useFonts } from "expo-font";
import {
  Outfit_400Regular,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit";
import {
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
} from "@expo-google-fonts/sora";

// Enable LayoutAnimation on Android for smooth tile-reorder animations
if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

function SplashScreen() {
  const size = 88;
  const width = Math.round(size * (56 / 72));
  const crossbarTop = Math.round(size * 0.25);
  const crossbarHeight = Math.round(size * 0.19);
  const stemWidth = Math.round(width * 0.29);
  const stemLeft = Math.round(width * 0.36);

  return (
    <View style={splash.root}>
      <View style={{ width, height: size }}>
        <View style={{
          position: "absolute", top: crossbarTop,
          left: 0, right: 0, height: crossbarHeight,
          backgroundColor: "#2ECDA7", borderRadius: crossbarHeight / 2,
        }} />
        <View style={{
          position: "absolute", top: 0, bottom: 0,
          left: stemLeft, width: stemWidth,
          backgroundColor: "#0A7AFF", borderRadius: stemWidth / 2,
        }} />
        <View style={{
          position: "absolute", top: crossbarTop,
          left: stemLeft, width: stemWidth, height: crossbarHeight,
          backgroundColor: "#5BC8D6", opacity: 0.65,
        }} />
      </View>
      <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 24 }} />
    </View>
  );
}

const splash = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
});

function RootNavigator() {
  const { loading } = useAuth();
  if (loading) return <SplashScreen />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_700Bold,
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
  });

  if (!fontsLoaded) return <SplashScreen />;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
