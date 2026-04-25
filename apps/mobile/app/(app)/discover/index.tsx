"use client";
import {
  Alert, AppState, FlatList, KeyboardAvoidingView, Modal,
  Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, fontSize, radius, spacing, shadow } from "../../../lib/theme";
import { sendChatMessage, getMyAdventures, saveAdventure, type ChatMessage, type AdventureRow, type TripSummary } from "../../../lib/api";
import { MOCK_TRIPS } from "../../../lib/mock-trips";
import { QuickReplies, detectQuickReplies } from "../../../components/QuickReplies";
import { AdventurePlanCard } from "../../../components/AdventurePlanCard";
import { RichOptionTiles } from "../../../components/RichOptionTiles";
import { DateRangePicker } from "../../../components/DateRangePicker";
import { loadSessions, upsertSession, removeSession, type StoredSession } from "../../../lib/chat-history";
import type {
  GeneratedAdventure, DayAlternativesMap, AccommodationStop,
  RichOption, RichOptionCategory, RichOptionsMsg,
  PlaceSuggestion, PlaceSuggestionsMsg,
} from "../../../lib/adventure-types";
import { VacationWizard, type WizardResult } from "../../../components/VacationWizard";
import { PlaceTile } from "../../../components/PlaceTile";
import { ALL_LOCATIONS } from "../../../lib/locationData";
import { fetchPlaceWeather } from "../../../lib/weather";
import { getPublicAdventures } from "../../../lib/api";

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

function parseAiMessage(text: string, nights = 0): { display: string; options: string[] | null } {
  const keywordReplies = detectQuickReplies(text, nights);
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
type Msg = TextMsg | AdventureMsg | AdditionMsg | RichOptionsMsg | PlaceSuggestionsMsg;
type Mode = "new" | "update" | null;

function uid() { return Math.random().toString(36).slice(2); }

const LINE_HEIGHT = 22;
const MIN_INPUT_HEIGHT = LINE_HEIGHT + 16;
const MAX_INPUT_HEIGHT = LINE_HEIGHT * 8 + 16;

function makeAiMsg(text: string, nights = 0): TextMsg {
  const { display, options } = parseAiMessage(text, nights);
  return { id: uid(), kind: "text", role: "ai", text, display, options };
}
function makeUserMsg(text: string): TextMsg {
  return { id: uid(), kind: "text", role: "user", text, display: text, options: null };
}

// ─── Place suggestion detection ───────────────────────────────────────────────

const LOC_SET = new Set(ALL_LOCATIONS.map(l => l.toLowerCase()));

function isPlaceSuggestion(options: string[]): boolean {
  if (options.length < 2) return false;
  const matches = options.filter(opt => {
    const base = opt.split(",")[0].trim().toLowerCase();
    return LOC_SET.has(base) || LOC_SET.has(opt.trim().toLowerCase());
  });
  return matches.length >= 2;
}

async function enrichPlaces(
  names: string[],
  startDate?: string | null,
): Promise<PlaceSuggestion[]> {
  return Promise.all(
    names.map(async name => {
      const [weatherResult, adventures] = await Promise.allSettled([
        fetchPlaceWeather(name, startDate ?? undefined),
        getPublicAdventures({ region: name }),
      ]);

      const geo = weatherResult.status === "fulfilled" ? weatherResult.value?.geo : null;
      const weather = weatherResult.status === "fulfilled" ? weatherResult.value?.weather : null;
      const advRows = adventures.status === "fulfilled" ? adventures.value : [];

      let rating: number | undefined;
      let ratingCount: number | undefined;
      if (advRows.length > 0) {
        const rated = advRows.filter(a => a.rating > 0);
        if (rated.length > 0) {
          rating = Math.round((rated.reduce((s, a) => s + a.rating, 0) / rated.length) * 10) / 10;
          ratingCount = rated.length;
        }
      }

      const slug = `${name}${geo?.country ? `-${geo.country}` : ""}`
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-");

      return {
        name,
        country: geo?.country,
        summary: "",
        highlights: [],
        images: [
          `https://picsum.photos/seed/${slug}-a/800/500`,
          `https://picsum.photos/seed/${slug}-b/800/500`,
          `https://picsum.photos/seed/${slug}-c/800/500`,
        ],
        coords: geo ? [geo.lat, geo.lon] : undefined,
        weather: weather ?? undefined,
        rating,
        ratingCount,
      } satisfies PlaceSuggestion;
    }),
  );
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardResult, setWizardResult] = useState<WizardResult | null>(null);
  const [pendingUpdateTrip, setPendingUpdateTrip] = useState<AdventureRow | null>(null);
  const [placeSelections, setPlaceSelections] = useState<Record<string, Set<string>>>({});
  const [tripStartDate, setTripStartDate] = useState<string | null>(null);
  const [tripNights, setTripNights] = useState<number>(0);
  const [savingItinerary, setSavingItinerary] = useState(false);
  const listRef = useRef<FlatList>(null);

  // Most recent generated adventure in this session (null until AI produces one)
  const latestAdventureId = useMemo(() =>
    [...messages].reverse().find(m => m.kind === "adventure")?.adventureId ?? null,
  [messages]);

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
    setPendingUpdateTrip(null);
    setMyTrips([]);
    setSessionActivityType(undefined);
    setShowDatePicker(false);
    setShowWizard(false);
    setWizardResult(null);
    setInput("");
    setInputHeight(MIN_INPUT_HEIGHT);
  }

  function fmtDate(d: Date): string {
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }

  // Called when user confirms dates in the DateRangePicker
  async function handleDateConfirm(
    start: Date, end: Date,
    adults: number, children: number, rooms: number,
  ) {
    setShowDatePicker(false);
    setTripStartDate(start.toISOString().slice(0, 10));
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    setTripNights(days);
    const guestLine = `${adults} adult${adults !== 1 ? "s" : ""}${children > 0 ? `, ${children} child${children !== 1 ? "ren" : ""}` : ""}, ${rooms} room${rooms !== 1 ? "s" : ""}`;
    const tripContext = `Trip: ${fmtDate(start)} to ${fmtDate(end)} (${days} day${days !== 1 ? "s" : ""}). Guests: ${guestLine}.`;
    if (pendingUpdateTrip) {
      // Update-trip path: dates confirmed for existing trip
      const trip = pendingUpdateTrip;
      setPendingUpdateTrip(null);
      setSelectedTrip(trip);
      setHistory([]);
      const whatMsg: TextMsg = {
        id: uid(), kind: "text", role: "ai",
        text: `What would you like to add to "${trip.title}"?`,
        display: `What would you like to add to "${trip.title}"?`,
        options: ["Route details", "Accommodation", "Restaurant recommendations", "New days"],
      };
      setMessages(prev => [...prev, whatMsg]);
      scrollToBottom();
      return;
    }

    // New adventure path: send enriched context as first user message
    const result = wizardResult;
    const wizardContext = result
      ? `\nVacation preferences:\n- Location: ${result.locations.join(", ")}\n- Destination: ${result.destinations.join(", ")}\n- Focus: ${result.focuses.join(", ")}\n- Activities: ${result.activities.join(", ")}`
      : "";
    send(`I want to plan a new vacation.${wizardContext}\n${tripContext}`);
  }

  function handleWizardComplete(result: WizardResult) {
    setWizardResult(result);
    setShowWizard(false);
    setShowDatePicker(true);
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
        ["Surfing", "other"], ["Yoga", "other"], ["Safari", "other"],
        ["Wildlife", "other"], ["Wellness", "other"], ["Snorkeling", "other"],
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
        // Show vacation wizard first, then date/guest picker
        setShowWizard(true);
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

      // Ask if dates are still correct before opening the AI
      setPendingUpdateTrip(trip);
      const startLabel = trip.startDate
        ? new Date(trip.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : null;
      const dateText = startLabel
        ? `Are these dates still correct for "${trip.title}"? (${startLabel}, ${trip.durationDays} days)`
        : `Would you like to update the dates for "${trip.title}"?`;
      const dateAiMsg: TextMsg = {
        id: uid(), kind: "text", role: "ai",
        text: dateText,
        display: dateText,
        options: ["Yes, keep dates", "No, change dates"],
      };
      setMessages(prev => [...prev, dateAiMsg]);
      scrollToBottom();
      return;
    }

    // ── Step 2b: Date confirmation for update trip ───────────────────────────
    if (mode === "update" && pendingUpdateTrip !== null && selectedTrip === null) {
      setMessages(prev => [...prev, makeUserMsg(trimmed)]);
      if (trimmed === "No, change dates") {
        setShowDatePicker(true);
        scrollToBottom();
        return;
      }
      // "Yes, keep dates" or anything else → proceed to update flow
      const trip = pendingUpdateTrip;
      setPendingUpdateTrip(null);
      setSelectedTrip(trip);
      setHistory([]);
      const whatMsg: TextMsg = {
        id: uid(), kind: "text", role: "ai",
        text: `What would you like to add to "${trip.title}"?`,
        display: `What would you like to add to "${trip.title}"?`,
        options: ["Route details", "Accommodation", "Restaurant recommendations", "New days"],
      };
      setMessages(prev => [...prev, whatMsg]);
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
        // Store compact JSON summary so AI has full context of what options it presented
        const richSummary = JSON.stringify({
          type: "rich_options",
          text: data.text ?? "",
          category: data.category,
          options: ((data.options ?? []) as RichOption[]).map((o: RichOption) => ({ title: o.title })),
          footer_options: data.footer_options ?? [],
        });
        setHistory([...updatedHistory, { role: "assistant", content: richSummary }]);
      } else {
        const aiText: string = data.text ?? "Could you tell me a bit more?";
        const aiMsg = makeAiMsg(aiText, tripNights);

        if (aiMsg.options && isPlaceSuggestion(aiMsg.options)) {
          const placesMsg: PlaceSuggestionsMsg = {
            id: uid(),
            kind: "place_suggestions",
            intro: aiMsg.display,
            places: aiMsg.options.map(name => ({
              name: name.split(",")[0].trim(),
              summary: "", highlights: [], images: [],
            })),
          };
          setMessages(prev => [...prev, placesMsg]);
          setHistory([...updatedHistory, { role: "assistant", content: aiText }]);
          enrichPlaces(placesMsg.places.map(p => p.name), tripStartDate).then(enriched => {
            setMessages(prev => prev.map(m =>
              m.id === placesMsg.id ? { ...placesMsg, places: enriched } : m,
            ));
          });
        } else {
          setMessages(prev => [...prev, aiMsg]);
          setHistory([...updatedHistory, { role: "assistant", content: aiText }]);
        }
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setMessages(prev => [...prev, makeAiMsg(`Sorry, something went wrong.\n\n${detail}`)]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [mode, selectedTrip, pendingUpdateTrip, myTrips, history, loading, scrollToBottom, sessionActivityType, tripStartDate]);

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

  // ── Save itinerary handler ───────────────────────────────────────────────────

  const handleSaveItinerary = useCallback(async () => {
    if (!latestAdventureId) {
      // No adventure generated yet — ask the AI to finalise the plan now
      send("Please generate the full adventure plan now based on everything we've discussed so far.");
      return;
    }
    setSavingItinerary(true);
    try {
      await saveAdventure(latestAdventureId);
      router.push(`/(app)/trips/${latestAdventureId}` as never);
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : "Please check your connection and try again.");
    } finally {
      setSavingItinerary(false);
    }
  }, [latestAdventureId, router, send]);

  // ── Render helpers ───────────────────────────────────────────────────────────

  function renderHistoryMessage(item: Msg, index: number) {
    if (item.kind === "adventure") {
      return null;
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
    if (item.kind === "place_suggestions") {
      const names = item.places.map(p => p.name).join(", ");
      return (
        <View key={index} style={[styles.bubbleRow]}>
          <View style={styles.bubbleAi}>
            <Text style={styles.bubbleText}>{item.intro ? `${item.intro}\n` : ""}Suggested: {names}</Text>
          </View>
        </View>
      );
    }
    const isUser = (item as TextMsg).role === "user";
    const bodyText = (item as TextMsg).options
      ? `${(item as TextMsg).display}\n${(item as TextMsg).options!.map((o: string) => `• ${o}`).join("\n")}`
      : (item as TextMsg).display;
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
      return null;
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

    if (item.kind === "place_suggestions") {
      const selections = placeSelections[item.id] ?? new Set<string>();
      const isLoading = item.places.some(p => !p.coords && !p.weather);
      return (
        <View style={styles.questionBlock}>
          {item.intro ? <Text style={styles.questionText}>{item.intro}</Text> : null}
          {item.places.map(place => (
            <PlaceTile
              key={place.name}
              place={place}
              selected={selections.has(place.name)}
              loading={isLoading}
              onToggle={() => {
                setPlaceSelections(prev => {
                  const next = new Set(prev[item.id] ?? []);
                  if (next.has(place.name)) { next.delete(place.name); } else { next.add(place.name); }
                  return { ...prev, [item.id]: next };
                });
              }}
            />
          ))}
          {selections.size > 0 && (
            <TouchableOpacity
              style={styles.placeContinueBtn}
              onPress={() => send(`I want to visit ${[...selections].join(" and ")}`)}
              activeOpacity={0.85}
            >
              <Text style={styles.placeContinueBtnText}>
                Continue with {selections.size} selected →
              </Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    const textItem = item as TextMsg;
    const isUser = textItem.role === "user";

    if (!isUser && textItem.options && textItem.options.length > 0) {
      return (
        <View style={styles.questionBlock}>
          {textItem.display ? <Text style={styles.questionText}>{textItem.display}</Text> : null}
          <QuickReplies options={textItem.options} disabled={loading} onSelect={send} />
        </View>
      );
    }

    return (
      <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{textItem.display}</Text>
        </View>
      </View>
    );
  }, [send, router, loading, sessionActivityType, selectedTrip, placeSelections]);

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
        <View style={{ width: 36 }} />
        <Text style={styles.headerTitle}>✦ Discover</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={openHistory} activeOpacity={0.7}>
          <Feather name="clock" size={18} color={colors.muted} />
        </TouchableOpacity>
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

      {/* Persistent save CTA — visible once conversation has started */}
      {messages.length >= 2 && (
        <TouchableOpacity
          style={[styles.saveCta, savingItinerary && styles.saveCtaDisabled]}
          onPress={handleSaveItinerary}
          disabled={savingItinerary}
          activeOpacity={0.85}
        >
          {savingItinerary
            ? <ActivityIndicator color={colors.inverse} size="small" />
            : <>
                <Feather name="bookmark" size={15} color={colors.inverse} />
                <Text style={styles.saveCtaText}>
                  {latestAdventureId ? "Save & view itinerary" : "Generate & save itinerary"}
                </Text>
              </>
          }
        </TouchableOpacity>
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: Platform.OS === "ios" ? insets.bottom + spacing.sm : spacing.sm }]}>
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

      {/* ── Vacation wizard ────────────────────────────────────────────────── */}
      <VacationWizard
        visible={showWizard}
        onComplete={handleWizardComplete}
        onCancel={() => {
          setShowWizard(false);
          setMode(null);
          setMessages([INITIAL]);
        }}
      />

      {/* ── Date range picker ─────────────────────────────────────────────── */}
      <DateRangePicker
        visible={showDatePicker}
        onConfirm={handleDateConfirm}
        onClose={() => {
          setShowDatePicker(false);
          // If user closes without picking dates, reset to initial state
          if (mode === "new" && history.length === 0) {
            setMode(null);
          }
        }}
      />

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
  headerTitle:   { fontFamily: fonts.display, flex: 1, textAlign: "center", fontSize: fontSize.xl, color: colors.text, letterSpacing: -0.4 },
  headerBtn:     { padding: 6 },

  // Chat
  list: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.lg, flexGrow: 1 },
  adventureWrapper: { marginVertical: spacing.sm },
  questionBlock:    { marginTop: spacing.sm, marginBottom: spacing.xs },
  questionText: { fontFamily: fonts.sans, fontSize: fontSize.base, color: colors.muted, lineHeight: 22, marginBottom: spacing.sm },
  bubbleRow:     { flexDirection: "row", justifyContent: "flex-start", marginBottom: spacing.xs, marginTop: spacing.xs },
  bubbleRowUser: { justifyContent: "flex-end" },
  bubble:     { maxWidth: "82%", borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  bubbleAi:   { backgroundColor: colors.aiBubble },
  bubbleUser: { backgroundColor: colors.userBubble },
  bubbleText:     { fontFamily: fonts.sans, fontSize: fontSize.base, color: colors.text, lineHeight: 22 },
  bubbleTextUser: { fontFamily: fonts.sans, color: colors.text },
  thinkingRow:    { flexDirection: "row", justifyContent: "flex-start", marginTop: spacing.xs, marginBottom: spacing.sm },
  thinkingBubble: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.aiBubble, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  thinkingText: { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.muted },

  // Input
  inputBar: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg, gap: spacing.sm,
  },
  input: {
    fontFamily: fonts.sans,
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
  additionTitle: { fontFamily: fonts.sansBold, fontSize: fontSize.sm, color: colors.text },
  additionDesc:  { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.muted, marginTop: 2 },
  additionLink:  { fontFamily: fonts.sansBold, fontSize: fontSize.sm, color: colors.accent },

  // ── History modal ────────────────────────────────────────────────────────────
  histOverlay: { flex: 1, backgroundColor: colors.bg },
  histHeader: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm,
  },
  histBackBtn:   { padding: 4 },
  histTitle:     { fontFamily: fonts.display, flex: 1, fontSize: fontSize.lg, color: colors.text, letterSpacing: -0.3 },
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
  histSessionTitle: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.base, color: colors.text, lineHeight: 20 },
  histSessionMeta:  { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted, marginTop: 2 },

  histEmpty: {
    alignItems: "center", paddingTop: spacing.xxl * 2, gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  histEmptyText: {
    fontFamily: fonts.sans,
    fontSize: fontSize.base, color: colors.muted,
    textAlign: "center", lineHeight: 22,
  },

  placeContinueBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  placeContinueBtnText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSize.base,
    color: "#FFFFFF",
  },
  saveCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: radius.md,
  },
  saveCtaDisabled: {
    backgroundColor: colors.subtle,
  },
  saveCtaText: {
    fontFamily: fonts.sansBold,
    color: colors.inverse,
    fontSize: fontSize.sm,
  },
});
