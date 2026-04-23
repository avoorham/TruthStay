import { Redirect, Stack, usePathname } from "expo-router";
import { useAuth } from "../../lib/auth-context";

export default function AuthLayout() {
  const { session, loading, termsAccepted } = useAuth();
  const pathname = usePathname();

  if (!loading && session) {
    if (session.user.user_metadata?.needs_onboarding) {
      if (pathname !== "/onboarding") return <Redirect href="/(auth)/onboarding" />;
    } else if (!termsAccepted) {
      // stay on consent without redirecting again — prevents the redirect loop
      if (pathname !== "/consent") return <Redirect href="/(auth)/consent" />;
    } else {
      return <Redirect href="/(app)/feed" />;
    }
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="consent" options={{ animation: "slide_from_bottom", gestureEnabled: false }} />
      <Stack.Screen name="onboarding" options={{ animation: "slide_from_right", gestureEnabled: false }} />
      <Stack.Screen name="reset-password" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
