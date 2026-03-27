"use client";
import {
  FlatList, KeyboardAvoidingView, Platform, StyleSheet,
  Text, TextInput, TouchableOpacity, View, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useRef, useCallback } from "react";
import { colors, fontSize, radius, spacing } from "../../../lib/theme";
import { sendChatMessage, type ChatMessage } from "../../../lib/api";
import { QuickReplies, detectQuickReplies } from "../../../components/QuickReplies";
import { AdventurePlanCard } from "../../../components/AdventurePlanCard";
import type {
  GeneratedAdventure, DayAlternativesMap, AccommodationStop,
} from "../../../lib/adventure-types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TextMsg {
  id: string;
  kind: "text";
  role: "ai" | "user";
  text: string;
  quickReplies?: string[] | null;
}

interface AdventureMsg {
  id: string;
  kind: "adventure";
  adventure: GeneratedAdventure;
  dayAlternatives: DayAlternativesMap;
  accommodationStops: AccommodationStop[];
  adventureId: string | null;
}

type Msg = TextMsg | AdventureMsg;

function uid() { return Math.random().toString(36).slice(2); }
function formatTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const INITIAL: TextMsg = {
  id: uid(),
  kind: "text",
  role: "ai",
  text: "Hi! I'm your TruthStay adventure planner. I specialise in sport-first holidays — cycling, hiking, trail running, climbing, and more. What activity are you planning for?",
  quickReplies: ["Cycling", "MTB", "Hiking", "Trail Running", "Climbing", "Skiing", "Kayaking"],
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Msg[]>([INITIAL]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");

    const userMsg: TextMsg = { id: uid(), kind: "text", role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom();

    const updatedHistory: ChatMessage[] = [...history, { role: "user", content: trimmed }];
    setLoading(true);

    try {
      const data = await sendChatMessage(updatedHistory);

      if (data.type === "adventure") {
        const adventureMsg: AdventureMsg = {
          id: uid(),
          kind: "adventure",
          adventure: data.adventure,
          dayAlternatives: data.day_alternatives ?? {},
          accommodationStops: data.accommodation_stops ?? [],
          adventureId: data.adventure_id ?? null,
        };
        setMessages((prev) => [...prev, adventureMsg]);
        setHistory(updatedHistory);
      } else {
        const aiText: string = data.text ?? "Could you tell me a bit more?";
        const replies = detectQuickReplies(aiText);
        const aiMsg: TextMsg = {
          id: uid(), kind: "text", role: "ai",
          text: aiText,
          quickReplies: replies,
        };
        setMessages((prev) => [...prev, aiMsg]);
        setHistory([...updatedHistory, { role: "assistant", content: aiText }]);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        { id: uid(), kind: "text", role: "ai", text: `Sorry, something went wrong.\n\n${detail}` },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [history, loading, scrollToBottom]);

  const renderItem = useCallback(({ item }: { item: Msg }) => {
    if (item.kind === "adventure") {
      return (
        <View style={styles.adventureWrapper}>
          <AdventurePlanCard
            adventure={item.adventure}
            dayAlternatives={item.dayAlternatives}
            accommodationStops={item.accommodationStops}
            adventureId={item.adventureId}
          />
        </View>
      );
    }

    const isUser = item.role === "user";
    return (
      <View>
        <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
          <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
            <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
              {item.text}
            </Text>
          </View>
        </View>
        {/* Quick reply chips below AI message */}
        {!isUser && item.quickReplies && item.quickReplies.length > 0 && (
          <QuickReplies
            options={item.quickReplies}
            onSelect={(opt) => send(opt)}
          />
        )}
      </View>
    );
  }, [send]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={80}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>✦ Discover</Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onContentSizeChange={scrollToBottom}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          loading ? (
            <View style={styles.thinkingRow}>
              <View style={styles.thinkingBubble}>
                <ActivityIndicator size="small" color={colors.muted} />
                <Text style={styles.thinkingText}>Thinking…</Text>
              </View>
            </View>
          ) : null
        }
      />

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send(input)}
          placeholder="Type a message…"
          placeholderTextColor={colors.muted}
          returnKeyType="send"
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => send(input)}
          disabled={!input.trim() || loading}
          activeOpacity={0.8}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  adventureWrapper: {
    marginVertical: spacing.sm,
  },
  bubbleRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  bubbleRowUser: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "82%",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  bubbleAi: { backgroundColor: colors.aiBubble },
  bubbleUser: { backgroundColor: colors.userBubble },
  bubbleText: {
    fontSize: fontSize.base,
    color: colors.text,
    lineHeight: 22,
  },
  bubbleTextUser: { color: colors.inverse },
  thinkingRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  thinkingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.aiBubble,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  thinkingText: { fontSize: fontSize.sm, color: colors.muted },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.base,
    color: colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: colors.border },
  sendIcon: { fontSize: fontSize.lg, color: colors.inverse, fontWeight: "700" },
});
