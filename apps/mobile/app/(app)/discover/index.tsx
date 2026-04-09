"use client";
import {
  Alert, AppState, FlatList, KeyboardAvoidingView, Modal,
  Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fontSize, radius, spacing, shadow } from "../../../lib/theme";
import { sendChatMessage, getMyAdventures, type ChatMessage, type AdventureRow, type TripSummary } from "../../../lib/api";
import { MOCK_TRIPS } from "../../../lib/mock-trips";
import { QuickReplies, detectQuickReplies } from "../../../components/QuickReplies";
import { AdventurePlanCard } from "../../../components/AdventurePlanCard";
import { RichOptionTiles } from "../../../components/RichOptionTiles";
import { loadSessions, upsertSession, removeSession, type StoredSession } from "../../../lib/chat-history";
import type {
  GeneratedAdventure, DayAlternativesMap, AccommodationStop,
  RichOption, RichOptionCategory, RichOptionsMsg,
} from "../../../lib/adventure-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tripStatus(a: AdventureRow): "current" | "upcoming" | "past" {
  if (!a.startDate) return "upcoming";
  const start = new Date(a.startDate);
  const end   = new Date(a.startDate);
  end.setDate(end.getDate() + (a.durationDays ?? 1));
  const now = new Date();
  if (now >= start && now <= end) return "current";
  if (now < start) return "upcoming";
  return "past";
}

function stripMd(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/  +/g, " ")
    .trim();
}

function parseAiMessage(text: string): { display: string; options: string[] | null } {
  const keywordReplies = detectQuickReplies(text);
  if (keywordReplies) {
    // Strip bullet lines — they're redundant when buttons already show them
    const nonBullet = text.split("\n").filter(l => !/^[-•*]\s+/.test(l.trim())).join("\n").trim();
    return { display: stripMd(nonBullet), options: keywordReplies };
  }

  const lines = text.split("\n");
  const bulletOptions: string[] = [];
  const nonBulletLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[-•*]\s+/.test(trimmed)) {
      bulletOptions.push(stripMd(trimmed.replace(/^[-•*]\s+/, "").trim()));
    } else {
      nonBulletLines.push(line);
    }
  }

  if (bulletOptions.length >= 2) {
    return { display: stripMd(nonBulletLines.join("\n").trim()), options: bulletOptions };
  }

  return { display: stripMd(text), options: null };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TextMsg {
  id: string; kind: "text"; role: "ai" | "user";
  text: string; display: string; options: string[] | null;
}
interface AdventureMsg {
  id: string; kind: "adventure";
  adventure: GeneratedAdventure; dayAlternatives: DayAlternativesMap;
  accommodationStops: AccommodationStop[]; adventureId: string | null;
}
interface AdditionMsg {
  id: string; kind: "addition";
  description: string; adventureId: string;
}
type Msg = TextMsg | AdventureMsg | AdditionMsg | RichOptionsMsg;
type Mode = "new" | "update" | null;

function uid() { return Math.random().toString(36).slice(2); }

const LINE_HEIGHT = 22;
const MIN_INPUT_HEIGHT = LINE_HEIGHT + 16;
const MAX_INPUT_HEIGHT = LINE_HEIGHT * 8 + 16;

function makeAiMsg(text: string): TextMsg {
  const { display, options } = parseAiMessage(text);
  return { id: uid(), kind: "text", role: "ai", text, display, options };
}
function makeUserMsg(text: string): TextMsg {
  return { id: uid(), kind: "text", role: "user", text, display: text, options: null };
}

const INITIAL: TextMsg = {
  id: uid(), kind: "text", role: "ai",
  text: "Are you looking to plan a new adventure, or update a current or upcoming trip?",
  display: "Are you looking to plan a new adventure, or update a current or upcoming trip?",
  options: ["Plan a new adventure", "Update a current trip"],
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const {
    template_title,
    template_region,
    template_activity,
    template_days,
  } = useLocalSearchParams<{
    template_title?:    string;
    template_region?:   string;
    template_activity?: string;
    template_days?:     string;
  }>();

  // ── Chat state ──────────────────────────────────────────────────────────────
  const [messages, setMessages]         = useState<Msg[]>([INITIAL]);
  const [history, setHistory]           = useState<ChatMessage[]>([]);
  const [input, setInput]               = useState("");
  const [inputHeight, setInputHeight]   = useState(MIN_INPUT_HEIGHT);
  const [loading, setLoading]           = useState(false);
  const [mode, setMode]                 = useState<Mode>(null);
  const [selectedTrip, setSelectedTrip] = useState<AdventureRow | null>(null);
  const [myTrips, setMyTrips]           = useState<AdventureRow[]>([]);
  const [sessionActivityType, setSessionActivityType] = useState<string | undefined>(undefined);
  const listRef = useRef<FlatList>(null);

  // ── Session refs (always hold latest state for effects/callbacks with no deps) ─
  const sessionIdRef      = useRef(uid());
  const shouldResetRef    = useRef(false);
  const messagesRef       = useRef<Msg[]>([INITIAL]);
  const historyRef        = useRef<ChatMessage[]>([]);
  const modeRef           = useRef<Mode>(null);
  const selectedTripRef   = useRef<AdventureRow | null>(null);

  useEffect(() => { messagesRef.current    = messages;    }, [messages]);
  useEffect(() => { historyRef.current     = history;     }, [history]);
  useEffect(() => { modeRef.current        = mode;        }, [mode]);
  useEffect(() => { selectedTripRef.current = selectedTrip; }, [selectedTrip]);

  // ── Template pre-fill (from "Plan similar" in feed) ─────────────────────────
  const templateSentRef = useRef(false);
  useEffect(() => {
    if (!template_title || templateSentRef.current) return;
    templateSentRef.current = true;
    const msg = `I want to plan a trip inspired by "${template_title}" — a ${template_days}-day ${template_activity} adventure in ${template_region}. Can you help me plan something similar?`;
    setTimeout(() => send(msg), 250);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template_title]);

  // ── History modal state ──────────────────────────────────────────────────────
  const [showHistory,    setShowHistory]    = useState(false);
  const [historySearch,  setHistorySearch]  = useState("");
  const [sessions,       setSessions]       = useState<StoredSession[]>([]);
  const [viewingSession, setViewingSession] = useState<StoredSession | null>(null);

  // ── Session helpers ──────────────────────────────────────────────────────────

  function deriveTitle(): string {
    const trip = selectedTripRef.current;
    if (trip) return `Update: ${trip.title}`;
    const msgs = messagesRef.current;
    const first = msgs.find(
      m => m.kind === "text" && (m as TextMsg).role === "user" &&
           (m as TextMsg).text !== "Plan a new adventure" &&
           (m as TextMsg).text !== "Update a current trip",
    ) as TextMsg | undefined;
    if (first) return first.text.slice(0, 60);
    const fallback = msgs.find(m => m.kind === "text" && (m as TextMsg).role === "user") as TextMsg | undefined;
    return fallback?.text ?? "New conversation";
  }

  const persistCurrentSession = useCallback(async () => {
    if (messagesRef.current.length <= 1) return;
    await upsertSession({
      id:        sessionIdRef.current,
      createdAt: new Date().toISOString(),
      title:     deriveTitle(),
      mode:      modeRef.current,
      messages:  messagesRef.current,
      history:   historyRef.current,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetChat() {
    sessionIdRef.current = uid();
    setMessages([INITIAL]);
    setHistory([]);
    setMode(null);
    setSelectedTrip(null);
    setMyTrips([]);
    setSessionActivityType(undefined);
    setInput("");
    setInputHeight(MIN_INPUT_HEIGHT);
  }

  async function handleRefresh() {
    if (messagesRef.current.length <= 1) return;
    Alert.alert(
      "Start new chat",
      "Your current conversation will be saved to history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "New chat", onPress: async () => {
            await persistCurrentSession();
            resetChat();
            setSessions(await loadSessions());
          },
        },
      ],
    );
  }

  async function openHistory() {
    setSessions(await loadSessions());
    setHistorySearch("");
    setViewingSession(null);
    setShowHistory(true);
  }

  async function handleDeleteSession(id: string) {
    await removeSession(id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (viewingSession?.id === id) setViewingSession(null);
  }

  // ── Auto-save + auto-reset ───────────────────────────────────────────────────

  useFocusEffect(useCallback(() => {
    // On focus: reset if flagged (screen was left or app was backgrounded)
    if (shouldResetRef.current) {
      resetChat();
      shouldResetRef.current = false;
    }
    loadSessions().then(setSessions);

    return () => {
      // On blur: save + flag for reset on next focus
      if (messagesRef.current.length > 1) {
        persistCurrentSession().catch(e => console.warn("Session persist failed:", e));
        shouldResetRef.current = true;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  useEffect(() => {
    const sub = AppState.addEventListener("change", state => {
      if (state === "background" || state === "inactive") {
        if (messagesRef.current.length > 1) {
          persistCurrentSession().catch(e => console.warn("Session persist failed:", e));
          shouldResetRef.current = true;
        }
      }
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Chat send ────────────────────────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    setInputHeight(MIN_INPUT_HEIGHT);

    // Detect activity type from quick-reply selection for image context
    if (!sessionActivityType) {
      const ACTIVITY_PREFIXES: Array<[string, string]> = [
        ["Cycling", "cycling"], ["MTB", "mtb"], ["Hiking", "hiking"],
        ["Trail Running", "trail_running"], ["Climbing", "climbing"],
        ["Skiing", "skiing"], ["Kayaking", "kayaking"],
      ];
      for (const [prefix, type] of ACTIVITY_PREFIXES) {
        if (trimmed.startsWith(prefix)) { setSessionActivityType(type); break; }
      }
    }

    // ── Step 1: Choose mode ──────────────────────────────────────────────────
    if (mode === null) {
      setMessages(prev => [...prev, makeUserMsg(trimmed)]);
      scrollToBottom();

      if (trimmed === "Plan a new adventure") {
        setMode("new");
        const h: ChatMessage[] = [{ role: "user", content: trimmed }];
        setLoading(true);
        try {
          const data = await sendChatMessage(h);
          const aiText: string = data.text ?? "What activity are you planning?";
          const aiMsg = makeAiMsg(aiText);
          setMessages(prev => [...prev, aiMsg]);
          setHistory([...h, { role: "assistant", content: aiText }]);
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          setMessages(prev => [...prev, makeAiMsg(`Sorry, something went wrong.\n\n${detail}`)]);
        } finally {
          setLoading(false);
          scrollToBottom();
        }
        return;
      }

      if (trimmed === "Update a current trip") {
        setMode("update");
        try {
          const real = await getMyAdventures().catch(() => [] as AdventureRow[]);
          const ids  = new Set(real.map(a => a.id));
          const all  = [...real, ...MOCK_TRIPS.filter(m => !ids.has(m.id))];
          const eligible = all.filter(t => tripStatus(t) !== "past");
          setMyTrips(eligible);

          if (eligible.length === 0) {
            setMessages(prev => [...prev, makeAiMsg(
              "You don't have any current or upcoming trips yet.\nWould you like to plan a new adventure instead?",
            )]);
          } else {
            const aiMsg: TextMsg = {
              id: uid(), kind: "text", role: "ai",
              text: "Which trip would you like to update?",
              display: "Which trip would you like to update?",
              options: eligible.map(t => t.title),
            };
            setMessages(prev => [...prev, aiMsg]);
          }
        } catch {
          setMessages(prev => [...prev, makeAiMsg("Could not load your trips. Please try again.")]);
        }
        scrollToBottom();
        return;
      }

      return;
    }

    // ── Step 2: Pick a trip (update mode) ───────────────────────────────────
    if (mode === "update" && selectedTrip === null) {
      const trip = myTrips.find(t => t.title === trimmed) ?? null;
      setMessages(prev => [...prev, makeUserMsg(trimmed)]);

      if (!trip) {
        setMessages(prev => [...prev, makeAiMsg("Please select a trip from the list above.")]);
        scrollToBottom();
        return;
      }

      setSelectedTrip(trip);
      setHistory([]);

      const aiMsg: TextMsg = {
        id: uid(), kind: "text", role: "ai",
        text: `What would you like to add to "${trip.title}"?`,
        display: `What would you like to add to "${trip.title}"?`,
        options: ["Route details", "Accommodation", "Restaurant recommendations", "New days"],
      };
      setMessages(prev => [...prev, aiMsg]);
      scrollToBottom();
      return;
    }

    // ── Step 3: Chat (new trip or update trip) ───────────────────────────────
    setMessages(prev => [...prev, makeUserMsg(trimmed)]);
    scrollToBottom();

    const updatedHistory: ChatMessage[] = [...history, { role: "user", content: trimmed }];
    setLoading(true);

    try {
      const tripSummary: TripSummary | undefined = selectedTrip
        ? {
            title:         selectedTrip.title,
            activity_type: selectedTrip.activityType,
            region:        selectedTrip.region,
            duration_days: selectedTrip.durationDays,
            start_date:    selectedTrip.startDate,
            days: selectedTrip.adventure_days.map(d => ({
              day_number:       d.dayNumber,
              title:            d.title,
              distance_km:      d.distanceKm,
              elevation_gain_m: d.elevationGainM,
            })),
          }
        : undefined;

      const chatOptions = mode === "update" && selectedTrip
        ? { mode: "update" as const, adventure_id: selectedTrip.id, trip_summary: tripSummary }
        : undefined;

      const data = await sendChatMessage(updatedHistory, chatOptions);

      if (data.type === "adventure") {
        const adventureMsg: AdventureMsg = {
          id: uid(), kind: "adventure",
          adventure:          data.adventure,
          dayAlternatives:    data.day_alternatives ?? {},
          accommodationStops: data.accommodation_stops ?? [],
          adventureId:        data.adventure_id ?? null,
        };
        setMessages(prev => [...prev, adventureMsg]);
        setHistory(updatedHistory);
      } else if (data.type === "addition") {
        const addMsg: AdditionMsg = {
          id: uid(), kind: "addition",
          description: data.description ?? "Trip updated",
          adventureId: data.adventure_id ?? selectedTrip?.id ?? "",
        };
        setMessages(prev => [...prev, addMsg]);
        setHistory([...updatedHistory, { role: "assistant", content: data.description ?? "Done" }]);
      } else if (data.type === "rich_options") {
        const richMsg: RichOptionsMsg = {
          id: uid(), kind: "rich_options",
          text:           data.text ?? "",
          category:       (data.category as RichOptionCategory) ?? "route",
          options:        (data.options as RichOption[]) ?? [],
          footer_options: (data.footer_options as string[]) ?? [],
        };
        setMessages(prev => [...prev, richMsg]);
        setHistory([...updatedHistory, { role: "assistant", content: data.text ?? "" }]);
      } else {
        const aiText: string = data.text ?? "Could you tell me a bit more?";
        const aiMsg = makeAiMsg(aiText);
        setMessages(prev => [...prev, aiMsg]);
        setHistory([...updatedHistory, { role: "assistant", content: aiText }]);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setMessages(prev => [...prev, makeAiMsg(`Sorry, something went wrong.\n\n${detail}`)]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [mode, selectedTrip, myTrips, history, loading, scrollToBottom, sessionActivityType]);

  // ── Filtered history sessions ────────────────────────────────────────────────

  const filteredSessions = useMemo(() => {
    const q = historySearch.toLowerCase().trim();
    if (!q) return sessions;
    return sessions.filter(s => {
      if (s.title.toLowerCase().includes(q)) return true;
      return s.messages.some((m: Msg) => {
        if (m.kind === "text") return (m as TextMsg).text.toLowerCase().includes(q);
        return false;
      });
    });
  }, [sessions, historySearch]);

  // ── Render helpers ───────────────────────────────────────────────────────────

  function renderHistoryMessage(item: Msg, index: number) {
    if (item.kind === "adventure") {
      return (
        <View key={index} style={styles.adventureWrapper}>
          <AdventurePlanCard
            adventure={item.adventure}
            dayAlternatives={item.dayAlternatives}
            accommodationStops={item.accommodationStops}
            adventureId={item.adventureId}
          />
        </View>
      );
    }
    if (item.kind === "addition") {
      return (
        <View key={index} style={styles.additionCard}>
          <Feather name="check-circle" size={18} color={colors.accent} />
          <View style={styles.additionBody}>
            <Text style={styles.additionTitle}>Trip updated</Text>
            <Text style={styles.additionDesc}>{item.description}</Text>
          </View>
        </View>
      );
    }
    if (item.kind === "rich_options") {
      return (
        <View key={index} style={styles.questionBlock}>
          {item.text ? <Text style={styles.questionText}>{item.text}</Text> : null}
          <RichOptionTiles messageId={item.id} category={item.category} options={item.options} footer_options={item.footer_options} onSelect={send} />
        </View>
      );
    }
    const isUser = item.role === "user";
    const bodyText = item.options
      ? `${item.display}\n${item.options.map(o => `• ${o}`).join("\n")}`
      : item.display;
    return (
      <View key={index} style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{bodyText}</Text>
        </View>
      </View>
    );
  }

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

    if (item.kind === "addition") {
      return (
        <View style={styles.additionCard}>
          <Feather name="check-circle" size={18} color={colors.accent} />
          <View style={styles.additionBody}>
            <Text style={styles.additionTitle}>Trip updated</Text>
            <Text style={styles.additionDesc}>{item.description}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push(`/(app)/trips/${item.adventureId}`)}>
            <Text style={styles.additionLink}>View →</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (item.kind === "rich_options") {
      return (
        <View style={styles.questionBlock}>
          {item.text ? <Text style={styles.questionText}>{item.text}</Text> : null}
          <RichOptionTiles
            messageId={item.id}
            category={item.category}
            activityType={sessionActivityType ?? selectedTrip?.activityType ?? undefined}
            options={item.options}
            footer_options={item.footer_options}
            disabled={loading}
            onSelect={send}
          />
        </View>
      );
    }

    const isUser = item.role === "user";

    if (!isUser && item.options && item.options.length > 0) {
      return (
        <View style={styles.questionBlock}>
          {item.display ? <Text style={styles.questionText}>{item.display}</Text> : null}
          <QuickReplies options={item.options} disabled={loading} onSelect={send} />
        </View>
      );
    }

    return (
      <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.display}</Text>
        </View>
      </View>
    );
  }, [send, router, loading, sessionActivityType, selectedTrip]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      enabled={Platform.OS === "ios"}
      behavior="padding"
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>✦ Discover</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn} onPress={openHistory} activeOpacity={0.7}>
            <Feather name="clock" size={18} color={colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, messagesRef.current.length <= 1 && styles.headerBtnDim]}
            onPress={handleRefresh}
            activeOpacity={0.7}
          >
            <Feather name="rotate-ccw" size={18} color={messagesRef.current.length <= 1 ? colors.border : colors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat list */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
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
          style={[styles.input, { height: Math.min(inputHeight, MAX_INPUT_HEIGHT) }]}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send(input)}
          onContentSizeChange={e => {
            const h = e.nativeEvent.contentSize.height + 16;
            setInputHeight(Math.max(MIN_INPUT_HEIGHT, h));
          }}
          placeholder="Type a message…"
          placeholderTextColor={colors.muted}
          returnKeyType="send"
          multiline
          scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
          blurOnSubmit
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => send(input)}
          disabled={!input.trim() || loading}
          activeOpacity={0.8}
        >
          <Feather name="arrow-up" size={18} color={colors.inverse} />
        </TouchableOpacity>
      </View>

      {/* ── History modal ──────────────────────────────────────────────────── */}
      <Modal
        visible={showHistory}
        animationType="slide"
        onRequestClose={() => { setShowHistory(false); setViewingSession(null); }}
      >
        <View style={[styles.histOverlay, { paddingTop: insets.top }]}>

          {/* Modal header */}
          <View style={styles.histHeader}>
            {viewingSession ? (
              <TouchableOpacity onPress={() => setViewingSession(null)} style={styles.histBackBtn}>
                <Feather name="arrow-left" size={20} color={colors.text} />
              </TouchableOpacity>
            ) : null}
            <Text style={styles.histTitle} numberOfLines={1}>
              {viewingSession ? viewingSession.title : "Chat history"}
            </Text>
            {viewingSession ? (
              <TouchableOpacity
                onPress={() => {
                  Alert.alert("Delete chat", "Remove this conversation from history?", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => handleDeleteSession(viewingSession.id) },
                  ]);
                }}
                style={styles.histActionBtn}
              >
                <Feather name="trash-2" size={18} color={colors.muted} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => { setShowHistory(false); setViewingSession(null); setHistorySearch(""); }}
                style={styles.histActionBtn}
              >
                <Feather name="x" size={22} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>

          {/* Session detail */}
          {viewingSession ? (
            <FlatList
              data={viewingSession.messages as Msg[]}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item, index }) => renderHistoryMessage(item, index)}
              contentContainerStyle={styles.histMsgList}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <>
              {/* Search bar */}
              <View style={styles.histSearchRow}>
                <Feather name="search" size={15} color={colors.muted} />
                <TextInput
                  style={styles.histSearchInput}
                  value={historySearch}
                  onChangeText={setHistorySearch}
                  placeholder="Search conversations…"
                  placeholderTextColor={colors.muted}
                  returnKeyType="search"
                  autoCorrect={false}
                />
                {historySearch ? (
                  <TouchableOpacity onPress={() => setHistorySearch("")}>
                    <Feather name="x" size={14} color={colors.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Session list */}
              <FlatList
                data={filteredSessions}
                keyExtractor={s => s.id}
                renderItem={({ item }) => {
                  const date = new Date(item.createdAt);
                  const dateStr = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
                  const userMsgCount = (item.messages as Msg[]).filter(
                    m => m.kind === "text" && (m as TextMsg).role === "user",
                  ).length;
                  return (
                    <TouchableOpacity
                      style={styles.histSessionItem}
                      onPress={() => setViewingSession(item)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.histSessionIcon, item.mode === "update" && styles.histSessionIconUpdate]}>
                        <Feather
                          name={item.mode === "update" ? "edit-2" : "compass"}
                          size={14}
                          color={item.mode === "update" ? colors.easy : colors.accent}
                        />
                      </View>
                      <View style={styles.histSessionBody}>
                        <Text style={styles.histSessionTitle} numberOfLines={2}>{item.title}</Text>
                        <Text style={styles.histSessionMeta}>
                          {dateStr} · {userMsgCount} message{userMsgCount !== 1 ? "s" : ""}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={16} color={colors.muted} />
                    </TouchableOpacity>
                  );
                }}
                contentContainerStyle={styles.histList}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.histEmpty}>
                    <Feather name="clock" size={40} color={colors.border} />
                    <Text style={styles.histEmptyText}>
                      {historySearch ? "No matches found." : "No saved chats yet.\nStart a conversation and it will appear here."}
                    </Text>
                  </View>
                }
              />
            </>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg,
  },
  headerTitle:   { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerBtn:     { padding: 6 },
  headerBtnDim:  { opacity: 0.3 },

  // Chat
  list: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.lg, flexGrow: 1 },
  adventureWrapper: { marginVertical: spacing.sm },
  questionBlock:    { marginTop: spacing.sm, marginBottom: spacing.xs },
  questionText: { fontSize: fontSize.base, color: colors.muted, lineHeight: 22, marginBottom: spacing.sm },
  bubbleRow:     { flexDirection: "row", justifyContent: "flex-start", marginBottom: spacing.xs, marginTop: spacing.xs },
  bubbleRowUser: { justifyContent: "flex-end" },
  bubble:     { maxWidth: "82%", borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  bubbleAi:   { backgroundColor: colors.aiBubble },
  bubbleUser: { backgroundColor: colors.userBubble },
  bubbleText:     { fontSize: fontSize.base, color: colors.text, lineHeight: 22 },
  bubbleTextUser: { color: colors.inverse },
  thinkingRow:    { flexDirection: "row", justifyContent: "flex-start", marginTop: spacing.xs, marginBottom: spacing.sm },
  thinkingBubble: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.aiBubble, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  thinkingText: { fontSize: fontSize.sm, color: colors.muted },

  // Input
  inputBar: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg, gap: spacing.sm,
  },
  input: {
    flex: 1, backgroundColor: colors.inputBg, borderRadius: radius.xl,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm + 2, paddingBottom: spacing.sm + 2,
    fontSize: fontSize.base, color: colors.text, textAlignVertical: "top",
  },
  sendBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.text, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { backgroundColor: colors.border },

  // Addition card
  additionCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.md, marginVertical: spacing.sm,
    gap: spacing.sm, ...shadow.sm,
  },
  additionBody:  { flex: 1 },
  additionTitle: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text },
  additionDesc:  { fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },
  additionLink:  { fontSize: fontSize.sm, color: colors.accent, fontWeight: "700" },

  // ── History modal ────────────────────────────────────────────────────────────
  histOverlay: { flex: 1, backgroundColor: colors.bg },
  histHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm,
  },
  histBackBtn:   { padding: 4 },
  histTitle:     { flex: 1, fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  histActionBtn: { padding: 4 },

  histSearchRow: {
    flexDirection: "row", alignItems: "center",
    margin: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    backgroundColor: colors.inputBg, borderRadius: radius.lg, gap: spacing.sm,
  },
  histSearchInput: { flex: 1, fontSize: fontSize.base, color: colors.text, padding: 0 },

  histList:    { paddingBottom: 40 },
  histMsgList: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 60 },

  histSessionItem: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md,
  },
  histSessionIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.accent + "22",
    alignItems: "center", justifyContent: "center",
  },
  histSessionIconUpdate: { backgroundColor: colors.easy + "22" },
  histSessionBody:  { flex: 1 },
  histSessionTitle: { fontSize: fontSize.base, fontWeight: "600", color: colors.text, lineHeight: 20 },
  histSessionMeta:  { fontSize: fontSize.xs, color: colors.muted, marginTop: 2 },

  histEmpty: {
    alignItems: "center", paddingTop: spacing.xxl * 2, gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  histEmptyText: {
    fontSize: fontSize.base, color: colors.muted,
    textAlign: "center", lineHeight: 22,
  },
});
