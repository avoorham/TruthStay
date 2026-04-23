import { Stack } from "expo-router";
import { ActivityIndicator, Platform, StyleSheet, Text, UIManager, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { colors, fonts } from "../lib/theme";
import { useFonts } from "expo-font";
import {
  DMSerifDisplay_400Regular,
  DMSerifDisplay_400Regular_Italic,
} from "@expo-google-fonts/dm-serif-display";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";

// Enable LayoutAnimation on Android for smooth tile-reorder animations
if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

function SplashScreen() {
  return (
    <View style={splash.root}>
      <View style={splash.tile}>
        <Text style={splash.letter}>T</Text>
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
  tile: {
    width: 88,
    height: 88,
    borderRadius: Math.round(88 * 0.22),
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  letter: {
    fontFamily: fonts.display,
    fontSize: Math.round(88 * 0.58),
    lineHeight: 88,
    color: "#FFFFFF",
    textAlign: "center",
    includeFontPadding: false,
  },
});

function RootNavigator() {
  const { loading } = useAuth();
  if (loading) return <SplashScreen />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSerifDisplay_400Regular,
    DMSerifDisplay_400Regular_Italic,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
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
