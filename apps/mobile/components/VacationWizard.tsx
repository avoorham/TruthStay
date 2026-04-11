import {
  Modal, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors, fontSize, radius, spacing } from "../lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WizardResult {
  locations: string[];
  destinations: string[];
  focuses: string[];
  activities: string[];
}

interface Props {
  visible: boolean;
  onComplete: (result: WizardResult) => void;
  onCancel: () => void;
}

// ─── Static location data ─────────────────────────────────────────────────────

const ALL_COUNTRIES = [
  "France", "Spain", "Italy", "Greece", "Portugal", "Switzerland", "Austria",
  "Croatia", "Norway", "Iceland", "Netherlands", "Scotland", "Slovenia",
  "Montenegro", "USA", "Canada", "Mexico", "Costa Rica", "Cuba", "Jamaica",
  "Dominican Republic", "Argentina", "Brazil", "Chile", "Peru", "Colombia",
  "Ecuador", "Bolivia", "Uruguay", "Japan", "Thailand", "Vietnam", "Indonesia",
  "India", "Nepal", "Sri Lanka", "Cambodia", "Philippines", "South Korea",
  "Taiwan", "Georgia", "Kyrgyzstan", "Morocco", "South Africa", "Tanzania",
  "Kenya", "Egypt", "Namibia", "Madagascar", "Rwanda", "Ethiopia", "Senegal",
  "New Zealand", "Australia", "Fiji", "Papua New Guinea", "Samoa", "Vanuatu",
  "Jordan", "Oman", "UAE", "Saudi Arabia", "Israel", "Lebanon", "Turkey", "Armenia",
];

const POPULAR_CITIES = [
  "Paris", "Tokyo", "Bali", "New York", "Barcelona", "Rome", "Amsterdam",
  "Dubai", "Bangkok", "Sydney", "Lisbon", "Prague", "Vienna", "Istanbul",
  "Marrakech", "Cape Town", "Rio de Janeiro", "Buenos Aires", "Kyoto",
  "Singapore", "Santorini", "Dubrovnik", "Reykjavik", "Vancouver",
  "Mexico City", "Chiang Mai", "Hanoi", "Ho Chi Minh City", "Seville",
  "Palma de Mallorca", "Florence", "Venice", "Bruges", "Edinburgh",
  "Queenstown", "Zanzibar", "Nairobi", "Casablanca",
];

const POPULAR_REGIONS = [
  "Algarve, Portugal", "Tuscany, Italy", "Provence, France",
  "Scottish Highlands, UK", "Amalfi Coast, Italy", "Balearic Islands, Spain",
  "Dolomites, Italy", "Swiss Alps, Switzerland", "Patagonia, South America",
  "Maldives", "Seychelles", "Bali, Indonesia", "Phuket, Thailand",
  "Costa Rica Rainforest", "Azores, Portugal", "Canary Islands, Spain",
  "Lake District, UK", "Cotswolds, UK", "Normandy, France", "Andalusia, Spain",
  "Catalonia, Spain", "Basque Country, Spain", "Lofoten Islands, Norway",
  "Faroe Islands", "Cinque Terre, Italy", "Dalmatian Coast, Croatia",
  "Black Forest, Germany", "Bohemia, Czech Republic",
];

const ALL_LOCATIONS = Array.from(new Set([...ALL_COUNTRIES, ...POPULAR_CITIES, ...POPULAR_REGIONS])).sort();

// ─── Static activity data ─────────────────────────────────────────────────────

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

// ─── Activity sections ─────────────────────────────────────────────────────────

type ActivitySection = { label: string; items: string[] };

function getActivitySections(destinations: string[], focuses: string[]): ActivitySection[] {
  const seen = new Set<string>();
  const sections: ActivitySection[] = [];

  for (const d of destinations) {
    const items = (DESTINATION_ACTIVITIES[d] ?? []).filter(a => !seen.has(a));
    items.forEach(a => seen.add(a));
    if (items.length > 0) sections.push({ label: d, items });
  }
  for (const f of focuses) {
    const items = (FOCUS_ACTIVITIES[f] ?? []).filter(a => !seen.has(a));
    items.forEach(a => seen.add(a));
    if (items.length > 0) sections.push({ label: f, items });
  }

  const outlier = OUTLIERS.find(o => !seen.has(o));
  if (outlier && sections.length > 0) sections[sections.length - 1].items.push(outlier);

  return sections;
}

// ─── Step config ───────────────────────────────────────────────────────────────

const STEP_QUESTIONS = [
  "Where would you like to go?",
  "What's the setting?",
  "What would you like to do?",
  "Which activities interest you?",
];

// ─── Chip component ────────────────────────────────────────────────────────────

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

// ─── Main component ────────────────────────────────────────────────────────────

export function VacationWizard({ visible, onComplete, onCancel }: Props) {
  const insets = useSafeAreaInsets();

  const [step, setStep]                   = useState(1);
  const [locationQuery, setLocationQuery] = useState("");
  const [locations, setLocations]         = useState<string[]>([]);
  const [destinations, setDestinations]   = useState<string[]>([]);
  const [focuses, setFocuses]             = useState<string[]>([]);
  const [activities, setActivities]       = useState<string[]>([]);

  function reset() {
    setStep(1);
    setLocationQuery("");
    setLocations([]);
    setDestinations([]);
    setFocuses([]);
    setActivities([]);
  }

  function handleCancel() {
    reset();
    onCancel();
  }

  function handleBack() {
    if (step === 1) { handleCancel(); return; }
    if (step === 1) setLocationQuery("");
    setStep(s => s - 1);
  }

  function handleNext() {
    if (step < 4) {
      setStep(s => s + 1);
      return;
    }
    // Step 4 — complete
    onComplete({ locations, destinations, focuses, activities });
    reset();
  }

  function toggle(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);
  }

  const filteredLocations = locationQuery.trim().length >= 1
    ? ALL_LOCATIONS.filter(l => l.toLowerCase().includes(locationQuery.toLowerCase()))
    : ALL_LOCATIONS;

  const activitySections = getActivitySections(destinations, focuses);

  const canProceed =
    (step === 1 && locations.length > 0) ||
    (step === 2 && destinations.length > 0) ||
    (step === 3 && focuses.length > 0) ||
    (step === 4 && activities.length > 0);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleBack} style={s.headerBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.stepCounter}>{step} / 4</Text>
        </View>

        {/* ── Progress dots ── */}
        <View style={s.dots}>
          {[1, 2, 3, 4].map(n => (
            <View key={n} style={[s.dot, n <= step && s.dotFilled]} />
          ))}
        </View>

        {/* ── Question ── */}
        <Text style={s.question}>{STEP_QUESTIONS[step - 1]}</Text>

        {/* ── Step 1: Location search + chips ── */}
        {step === 1 && (
          <TextInput
            style={s.searchInput}
            placeholder="Search country, city or region…"
            placeholderTextColor={colors.muted}
            value={locationQuery}
            onChangeText={setLocationQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}

        {/* ── Chips ── */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={step === 4 ? s.sectionedContainer : s.chipContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 1 — Location */}
          {step === 1 && filteredLocations.map(opt => (
            <Chip
              key={opt} label={opt}
              selected={locations.includes(opt)}
              onPress={() => toggle(locations, setLocations, opt)}
            />
          ))}

          {/* Step 2 — Destinations */}
          {step === 2 && DESTINATIONS.map(opt => (
            <Chip
              key={opt} label={opt}
              selected={destinations.includes(opt)}
              onPress={() => toggle(destinations, setDestinations, opt)}
            />
          ))}

          {/* Step 3 — Focuses */}
          {step === 3 && FOCUSES.map(opt => (
            <Chip
              key={opt} label={opt}
              selected={focuses.includes(opt)}
              onPress={() => toggle(focuses, setFocuses, opt)}
            />
          ))}

          {/* Step 4 — Sectioned activities */}
          {step === 4 && activitySections.map(section => (
            <View key={section.label} style={s.sectionBlock}>
              <Text style={s.sectionLabel}>{section.label}</Text>
              <View style={s.chipContainer}>
                {section.items.map(opt => (
                  <Chip
                    key={opt} label={opt}
                    selected={activities.includes(opt)}
                    onPress={() => toggle(activities, setActivities, opt)}
                  />
                ))}
              </View>
            </View>
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
            {step === 4 ? "Let's plan" : "Next"}
          </Text>
          <Feather
            name={step === 4 ? "check" : "arrow-right"}
            size={18}
            color={colors.inverse}
            style={{ marginLeft: 6 }}
          />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

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
  searchInput: {
    backgroundColor: colors.aiBubble,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSize.base,
    color: colors.text,
    marginBottom: spacing.md,
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
  sectionedContainer: {
    paddingBottom: spacing.xl,
  },
  sectionBlock: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
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