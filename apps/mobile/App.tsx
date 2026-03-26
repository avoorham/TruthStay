import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!session) return <AuthScreen />;
  return <HomeScreen session={session} />;
}

// ─── Auth Screen ─────────────────────────────────────────────────────────────

function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAuth() {
    setLoading(true);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) Alert.alert("Error", error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username, display_name: displayName } },
      });
      if (error) Alert.alert("Error", error.message);
      else Alert.alert("Check your email", "We sent you a confirmation link.");
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.auth}
    >
      <Text style={styles.logo}>TruthStay</Text>
      <Text style={styles.tagline}>
        {mode === "login" ? "Sign in to your account" : "Create your account"}
      </Text>

      {mode === "signup" && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        </>
      )}

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleAuth}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "..." : mode === "login" ? "Sign in" : "Create account"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setMode(mode === "login" ? "signup" : "login")}
      >
        <Text style={styles.toggle}>
          {mode === "login"
            ? "No account? Sign up"
            : "Already have an account? Sign in"}
        </Text>
      </TouchableOpacity>
      <StatusBar style="auto" />
    </KeyboardAvoidingView>
  );
}

// ─── Home Screen (post-auth placeholder) ─────────────────────────────────────

function HomeScreen({ session }: { session: Session }) {
  return (
    <View style={styles.center}>
      <Text style={styles.logo}>TruthStay</Text>
      <Text style={styles.tagline}>Welcome, {session.user.email}</Text>
      <TouchableOpacity
        style={[styles.button, { marginTop: 24 }]}
        onPress={() => supabase.auth.signOut()}
      >
        <Text style={styles.buttonText}>Sign out</Text>
      </TouchableOpacity>
      <StatusBar style="auto" />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  auth: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  logo: { fontSize: 32, fontWeight: "700", marginBottom: 4 },
  tagline: { color: "#666", marginBottom: 24, fontSize: 15 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#111",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  toggle: {
    marginTop: 20,
    textAlign: "center",
    color: "#666",
    fontSize: 14,
  },
});
