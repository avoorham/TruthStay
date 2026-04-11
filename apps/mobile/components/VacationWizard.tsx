import {
  Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors, fontSize, radius, spacing } from "../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WizardResult {
  destinations: string[];
  focuses: string[];
  activities: string[];
  continent: string;
  countries: string[];
}

interface Props {
  visible: boolean;
  onComplete: (result: WizardResult) => void;
  onCancel: () => void;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const DESTINATIONS = [
  "Beach & Coast", "Mountains & Highlands", "Countryside & Rural", "City & Culture",
  "Lakes & Rivers", "Forest & Nature", "Islands", "Desert & Arid", "Snow & Ice", "Jungle & Tropics",
];

const FOCUSES = [
  "Relax & Unwind", "Sport & Active", "Family Fun", "Sightseeing & Culture",
  "Food & Gastronomy", "Adventure & Thrills", "Wellness & Spa",
  "Nightlife & Social", "Wildlife & Nature", "Digital Detox",
];

const DESTINATION_ACTIVITIES: Record<string, string[]> = {
  "Beach & Coast":        ["Surfing", "Snorkeling", "Scuba diving", "Swimming", "Sailing", "Kitesurfing", "Stand-up paddleboarding", "Beach volleyball", "Sunset cruise", "Sea kayaking"],
  "Mountains & Highlands":["Hiking", "Rock climbing", "Trail running", "Mountain biking", "Via ferrata", "Paragliding", "Ski touring", "Snowshoeing", "Mountaineering", "Photography walks"],
  "Countryside & Rural":  ["Cycling", "Walking", "Horse riding", "Wine tasting", "Farm stays", "Foraging", "Bird watching", "Picnicking", "Yoga", "Cooking classes"],
  "City & Culture":       ["Walking tours", "Museum visits", "Food tours", "Architecture walks", "Street art", "Shopping", "Live music", "Cooking classes", "Rooftop bars", "Theatre"],
  "Lakes & Rivers":       ["Kayaking", "Swimming", "Fishing", "Stand-up paddleboarding", "Sailing", "Wild camping", "Trail running", "Cycling", "Photography", "Wellness retreats"],
  "Forest & Nature":      ["Hiking", "Mountain biking", "Wild camping", "Bird watching", "Photography", "Foraging", "Trail running", "Yoga", "Stargazing", "Mindfulness walks"],
  "Islands":              ["Snorkeling", "Sailing", "Scuba diving", "Fishing", "Hiking", "Beach walks", "Kayaking", "Surfing", "Cultural tours", "Yoga retreat"],
  "Desert & Arid":        ["Camel trekking", "Stargazing", "Photography", "Dune surfing", "Off-road driving", "Guided desert hikes", "Wild camping", "Cultural visits", "Quad biking", "Hot air balloon"],
  "Snow & Ice":           ["Skiing", "Snowboarding", "Snowshoeing", "Ice skating", "Dog sledding", "Snowmobile", "Winter photography", "Husky safari", "Ski touring", "Ice fishing"],
  "Jungle & Tropics":     ["Wildlife spotting", "Guided jungle treks", "Zip-lining", "River kayaking", "Bird watching", "Night safari", "Waterfall swimming", "Cultural village visits", "Photography", "Yoga"],
};

const FOCUS_ACTIVITIES: Record<string, string[]> = {
  "Relax & Unwind":       ["Sunbathing", "Yoga", "Meditation", "Reading", "Hot spring bathing", "Hammam & spa", "Slow scenic walks", "Massage therapy", "Napping on beach", "Journaling"],
  "Sport & Active":       ["Cycling", "Trail running", "Hiking", "Swimming", "Rock climbing", "Kayaking", "Open-water swimming", "Triathlon training", "Crossfit", "Stretching & mobility"],
  "Family Fun":           ["Nature trails", "Sand castle building", "Cycling", "Swimming", "Wildlife parks", "Boat trips", "Mini golf", "Theme parks", "Treasure hunts", "Ice cream tours"],
  "Sightseeing & Culture":["Guided tours", "Museums", "Historical sites", "Architecture walks", "Viewpoints", "Photography", "Boat tours", "City walks", "Landmarks", "Local markets"],
  "Food & Gastronomy":    ["Food tours", "Cooking classes", "Wine tasting", "Market visits", "Restaurant hopping", "Farm visits", "Cheese tastings", "Foraging", "Olive oil tastings", "Craft brewery tours"],
  "Adventure & Thrills":  ["Bungee jumping", "Paragliding", "White water rafting", "Rock climbing", "Skydiving", "Cave exploration", "Zip-lining", "Surfing", "Mountain biking", "Mountaineering"],
  "Wellness & Spa":       ["Yoga", "Meditation", "Spa treatments", "Pilates", "Sound healing", "Breathwork", "Massage therapy", "Detox programme", "Forest bathing", "Silent retreat"],
  "Nightlife & Social":   ["Bar hopping", "Club nights", "Live music", "Comedy shows", "Night markets", "Rooftop bars", "Cocktail masterclasses", "Street food tours", "Jazz bars", "Festival attendance"],
  "Wildlife & Nature":    ["Safari", "Bird watching", "Whale watching", "Turtle nesting tours", "Snorkeling", "Marine diving", "Nature walks", "Wildlife photography", "Guided conservation tours", "Marine reserve visits"],
  "Digital Detox":        ["Hiking", "Reading", "Yoga", "Swimming", "Journaling", "Watercolour painting", "Pottery", "Bread baking", "Foraging", "Stargazing"],
};

const OUTLIERS = [
  "Stargazing", "Bird watching", "Knitting retreat", "Foraging walk",
  "Astronomy tour", "Origami workshop", "Local pottery class", "Sunrise meditation",
];

const CONTINENTS = [
  "Europe", "North America", "South America", "Asia", "Africa", "Oceania", "Middle East",
];

const COUNTRIES_BY_CONTINENT: Record<string, string[]> = {
  "Europe":        ["France", "Spain", "Italy", "Greece", "Portugal", "Switzerland", "Austria", "Croatia", "Norway", "Iceland", "Netherlands", "Scotland", "Slovenia", "Montenegro"],
  "North America": ["USA", "Canada", "Mexico", "Costa Rica", "Cuba", "Jamaica", "Belize", "Panama", "Dominican Republic", "Guatemala"],
  "South America": ["Argentina", "Brazil", "Chile", "Peru", "Colombia", "Ecuador", "Bolivia", "Uruguay", "Patagonia"],
  "Asia":          ["Japan", "Thailand", "Vietnam", "Indonesia", "India", "Nepal", "Sri Lanka", "Cambodia", "Philippines", "South Korea", "Taiwan", "Georgia", "Kyrgyzstan"],
  "Africa":        ["Morocco", "South Africa", "Tanzania", "Kenya", "Egypt", "Namibia", "Madagascar", "Rwanda", "Ethiopia", "Senegal"],
  "Oceania":       ["New Zealand", "Australia", "Fiji", "Papua New Guinea", "Samoa", "Vanuatu"],
  "Middle East":   ["Jordan", "Oman", "UAE", "Saudi Arabia", "Israel", "Lebanon", "Turkey", "Georgia", "Armenia"],
};

function getActivitySuggestions(
  destinations: string[],
  focuses: string[],
): { initial: string[]; full: string[] } {
  const pool = new Set<string>();
  destinations.forEach(d => DESTINATION_ACTIVITIES[d]?.forEach(a => pool.add(a)));
  focuses.forEach(f => FOCUS_ACTIVITIES[f]?.forEach(a => pool.add(a)));
  const all = Array.from(pool);
  const outlier = OUTLIERS.find(o => !pool.has(o));
  if (outlier) all.push(outlier);
  return { initial: all.slice(0, 10), full: all };
}

// ─── Step config ──────────────────────────────────────────────────────────────

const STEP_QUESTIONS = [
  "Where would you like to go?",
  "What would you like to do?",
  "Which activities interest you?",
  "Which part of the world?",
  "Which countries?",
];

// ─── Chip component ───────────────────────────────────────────────────────────

function Chip({
  label, selected, onPress, outline,
}: {
  label: string; selected?: boolean; onPress: () => void; outline?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[s.chip, selected && s.chipSelected, outline && s.chipOutline]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[s.chipText, selected && s.chipTextSelected, outline && s.chipTextOutline]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VacationWizard({ visible, onComplete, onCancel }: Props) {
  const insets = useSafeAreaInsets();

  const [step, setStep]                   = useState(1);
  const [destinations, setDestinations]   = useState<string[]>([]);
  const [focuses, setFocuses]             = useState<string[]>([]);
  const [activities, setActivities]       = useState<string[]>([]);
  const [continent, setContinent]         = useState<string | null>(null);
  const [countries, setCountries]         = useState<string[]>([]);
  const [showAllActivities, setShowAllActivities] = useState(false);

  function reset() {
    setStep(1);
    setDestinations([]);
    setFocuses([]);
    setActivities([]);
    setContinent(null);
    setCountries([]);
    setShowAllActivities(false);
  }

  function handleCancel() {
    reset();
    onCancel();
  }

  function handleBack() {
    if (step === 1) { handleCancel(); return; }
    if (step === 3) setShowAllActivities(false);
    setStep(s => s - 1);
  }

  function handleNext() {
    if (step < 5) {
      if (step === 2) setShowAllActivities(false);
      setStep(s => s + 1);
      return;
    }
    // Step 5 — complete
    onComplete({ destinations, focuses, activities, continent: continent!, countries });
    reset();
  }

  function toggle(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);
  }

  // Compute activity suggestions when on step 3
  const activitySuggestions = getActivitySuggestions(destinations, focuses);
  const displayedActivities = showAllActivities
    ? activitySuggestions.full
    : activitySuggestions.initial;
  const hasMore = !showAllActivities && activitySuggestions.full.length > activitySuggestions.initial.length;

  // Determine if Next should be enabled
  const canProceed =
    (step === 1 && destinations.length > 0) ||
    (step === 2 && focuses.length > 0) ||
    (step === 3 && activities.length > 0) ||
    (step === 4 && continent !== null) ||
    (step === 5 && countries.length > 0);

  const countryList = continent ? (COUNTRIES_BY_CONTINENT[continent] ?? []) : [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleBack} style={s.headerBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.stepCounter}>{step} / 5</Text>
        </View>

        {/* ── Progress dots ── */}
        <View style={s.dots}>
          {[1, 2, 3, 4, 5].map(n => (
            <View key={n} style={[s.dot, n <= step && s.dotFilled]} />
          ))}
        </View>

        {/* ── Question ── */}
        <Text style={s.question}>{STEP_QUESTIONS[step - 1]}</Text>

        {/* ── Chips ── */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.chipContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Step 1 — Destinations */}
          {step === 1 && DESTINATIONS.map(opt => (
            <Chip
              key={opt} label={opt}
              selected={destinations.includes(opt)}
              onPress={() => toggle(destinations, setDestinations, opt)}
            />
          ))}

          {/* Step 2 — Focuses */}
          {step === 2 && FOCUSES.map(opt => (
            <Chip
              key={opt} label={opt}
              selected={focuses.includes(opt)}
              onPress={() => toggle(focuses, setFocuses, opt)}
            />
          ))}

          {/* Step 3 — Activities */}
          {step === 3 && (
            <>
              {displayedActivities.map(opt => (
                <Chip
                  key={opt} label={opt}
                  selected={activities.includes(opt)}
                  onPress={() => toggle(activities, setActivities, opt)}
                />
              ))}
              {hasMore && (
                <Chip
                  label="Show more +"
                  outline
                  onPress={() => setShowAllActivities(true)}
                />
              )}
            </>
          )}

          {/* Step 4 — Continent */}
          {step === 4 && CONTINENTS.map(opt => (
            <Chip
              key={opt} label={opt}
              selected={continent === opt}
              onPress={() => setContinent(opt)}
            />
          ))}

          {/* Step 5 — Countries */}
          {step === 5 && countryList.map(opt => (
            <Chip
              key={opt} label={opt}
              selected={countries.includes(opt)}
              onPress={() => toggle(countries, setCountries, opt)}
            />
          ))}
        </ScrollView>

        {/* ── Next button ── */}
        <TouchableOpacity
          style={[s.nextBtn, !canProceed && s.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!canProceed}
          activeOpacity={0.85}
        >
          <Text style={s.nextBtnText}>
            {step === 5 ? "Let's plan" : "Next"}
          </Text>
          <Feather
            name={step === 5 ? "check" : "arrow-right"}
            size={18}
            color={colors.inverse}
            style={{ marginLeft: 6 }}
          />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  headerBtn: {
    padding: 4,
  },
  stepCounter: {
    fontSize: fontSize.sm,
    color: colors.muted,
    fontWeight: "500",
  },
  dots: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotFilled: {
    backgroundColor: colors.accent,
  },
  question: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.lg,
    lineHeight: 34,
  },
  scroll: {
    flex: 1,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: spacing.xl,
  },
  chip: {
    backgroundColor: colors.aiBubble,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipSelected: {
    backgroundColor: colors.accent,
  },
  chipOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: "500",
  },
  chipTextSelected: {
    color: colors.inverse,
  },
  chipTextOutline: {
    color: colors.muted,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 16,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  nextBtnDisabled: {
    opacity: 0.35,
  },
  nextBtnText: {
    fontSize: fontSize.base,
    fontWeight: "700",
    color: colors.inverse,
  },
});