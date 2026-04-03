import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../lib/auth-context";

export default function AuthLayout() {
  const { session, loading } = useAuth();
  if (!loading && session) {
    if (session.user.user_metadata?.needs_onboarding) {
      return <Redirect href="/(auth)/onboarding" />;
    }
    return <Redirect href="/(app)/feed" />;
  }
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="onboarding" options={{ animation: "slide_from_right", gestureEnabled: false }} />
      <Stack.Screen name="reset-password" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
