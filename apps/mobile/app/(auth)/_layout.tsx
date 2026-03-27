import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../lib/auth-context";

export default function AuthLayout() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Redirect href="/(app)/feed" />;
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" options={{ animation: "slide_from_bottom" }} />
    </Stack>
  );
}
