import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth-context";
import { pickImage, uploadAvatar } from "../../lib/storage";
import { colors, fonts, fontSize, radius, spacing } from "../../lib/theme";

const ACTIVITIES = ["MTB", "Road Cycling", "Hiking", "Trail Running", "Gravel", "Skiing", "Kayaking", "Climbing"];

type Step = "name" | "photo" | "interests" | "done";

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const user = session?.user;

  const [step, setStep] = useState<Step>("name");
  const [displayName, setDisplayName] = useState(user?.user_metadata?.display_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.user_metadata?.avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleActivity(a: string) {
    setSelectedActivities(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a],
    );
  }

  async function handleNameContinue() {
    if (!displayName.trim()) return;
    await supabase.auth.updateUser({ data: { display_name: displayName.trim() } }).catch(() => {});
    setStep("photo");
  }

  async function handlePickPhoto() {
    if (!user?.id) return;
    const uri = await pickImage([1, 1]);
    if (!uri) return;
    setUploading(true);
    const url = await uploadAvatar(user.id, uri);
    setUploading(false);
    if (url) {
      await supabase.auth.updateUser({ data: { avatar_url: url } }).catch(() => {});
      setAvatarUrl(url);
    }
  }

  async function handleFinish() {
    setSaving(true);
    await supabase.auth.updateUser({
      data: {
        activityTypes: selectedActivities,
        needs_onboarding: false,
      },
    }).catch(() => {});
    setSaving(false);
    // Auth layout auto-redirects to /(app)/feed once needs_onboarding is cleared
  }

  // ── Step: Name ─────────────────────────────────────────────────────────────
  if (step === "name") {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
        <StepDots current={0} />
        <Text style={styles.stepHeading}>What&apos;s your name?</Text>
        <Text style={styles.stepSub}>This is how other adventurers will find you.</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Display name"
          placeholderTextColor={colors.subtle}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleNameContinue}
        />
        <TouchableOpacity
          style={[styles.btn, !displayName.trim() && styles.btnDisabled]}
          onPress={handleNameContinue}
          activeOpacity={0.85}
          disabled={!displayName.trim()}
        >
          <Text style={styles.btnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Step: Photo ────────────────────────────────────────────────────────────
  if (step === "photo") {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
        <StepDots current={1} />
        <Text style={styles.stepHeading}>Add a profile photo</Text>
        <Text style={styles.stepSub}>Put a face to your adventures.</Text>

        <TouchableOpacity style={styles.avatarWrap} onPress={handlePickPhoto} activeOpacity={0.8} disabled={uploading}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Feather name="camera" size={32} color={colors.muted} />
            </View>
          )}
          <View style={styles.cameraOverlay}>
            <Feather name={uploading ? "loader" : "camera"} size={14} color="#fff" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn} onPress={() => setStep("interests")} activeOpacity={0.85}>
          <Text style={styles.btnText}>{avatarUrl ? "Continue" : "Skip"}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Step: Interests ────────────────────────────────────────────────────────
  if (step === "interests") {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
        <StepDots current={2} />
        <Text style={styles.stepHeading}>Your activities</Text>
        <Text style={styles.stepSub}>Select the sports you love so we can personalise your adventures.</Text>

        <View style={styles.chips}>
          {ACTIVITIES.map(a => {
            const active = selectedActivities.includes(a);
            return (
              <TouchableOpacity
                key={a}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleActivity(a)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{a}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleFinish} disabled={saving} activeOpacity={0.85}>
          <Text style={styles.btnText}>{saving ? "Saving…" : selectedActivities.length > 0 ? "Let's go!" : "Skip"}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
}

function StepDots({ current }: { current: number }) {
  const anims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = anims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: i === current ? 1 : 0,
        duration: 220,
        useNativeDriver: false,
      }),
    );
    Animated.parallel(animations).start();
  }, [current]);

  return (
    <View style={styles.dots}>
      {anims.map((anim, i) => {
        const width = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [8, 24],
        });
        const bgColor = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [colors.border, colors.accent],
        });
        return (
          <Animated.View
            key={i}
            style={[styles.dot, { width, backgroundColor: bgColor }]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    paddingBottom: 52,
  },
  dots: { flexDirection: "row", gap: 6, marginBottom: spacing.xl },
  dot: { height: 8, borderRadius: 4 },

  stepHeading: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  stepSub: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },

  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontFamily: fonts.sans,
    fontSize: fontSize.lg,
    color: colors.text,
    backgroundColor: colors.card,
    marginBottom: spacing.xl,
  },

  avatarWrap: { alignSelf: "center", marginBottom: spacing.xl },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  avatarPlaceholder: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraOverlay: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.bg,
  },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.xl },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.muted },
  chipTextActive: { color: colors.inverse },

  btn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: "auto",
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnText: { fontFamily: fonts.sansBold, color: colors.inverse, fontSize: fontSize.base },
});