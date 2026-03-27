import {
  Animated, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "expo-router";
import Mapbox, {
  MapView, Camera, ShapeSource,
  CircleLayer, SymbolLayer,
} from "@rnmapbox/maps";
import { Feather } from "@expo/vector-icons";
import { colors, fontSize, radius, spacing, ACTIVITY_COLOR } from "../../../lib/theme";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");

// ─── Types ────────────────────────────────────────────────────────────────────

interface Adventure {
  id: string;
  title: string;
  activityType: string;
  region: string;
  country: string;
  days: number;
  avgDistanceKm: number | null;
  avgElevationM: number | null;
  description: string;
  budget: "budget" | "mid" | "luxury";
  level: "beginner" | "intermediate" | "advanced";
  rating: number;
  coords: [number, number]; // [lng, lat]
}

interface FilterState {
  activities: string[];
  duration: string | null;   // "1-3" | "4-7" | "8-14" | "14+"
  budget: string | null;     // "budget" | "mid" | "luxury"
  level: string | null;      // "beginner" | "intermediate" | "advanced"
  rating: number | null;     // 3 | 4 | 4.5
  region: string | null;
}

const DEFAULT_FILTERS: FilterState = {
  activities: [],
  duration: null,
  budget: null,
  level: null,
  rating: null,
  region: null,
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_ADVENTURES: Adventure[] = [
  {
    id: "1", title: "Sa Calobra Loop", activityType: "cycling",
    region: "Balearic Islands", country: "Spain",
    days: 7, avgDistanceKm: 85, avgElevationM: 1800,
    description: "Mallorca's iconic cycling circuit — Sa Calobra, Cap Formentor, and the Tramuntana mountains.",
    budget: "mid", level: "advanced", rating: 4.9,
    coords: [-2.85, 39.85],
  },
  {
    id: "2", title: "Alta Via 1", activityType: "hiking",
    region: "Dolomites", country: "Italy",
    days: 8, avgDistanceKm: 22, avgElevationM: 1100,
    description: "Hut-to-hut traverse of the Dolomites on one of Europe's most iconic long-distance trails.",
    budget: "mid", level: "intermediate", rating: 4.8,
    coords: [12.0, 46.5],
  },
  {
    id: "3", title: "UTMB Course Recon", activityType: "trail_running",
    region: "Mont Blanc", country: "France",
    days: 5, avgDistanceKm: 35, avgElevationM: 2400,
    description: "Run the iconic 170km UTMB loop in stages — one of trail running's ultimate bucket-list objectives.",
    budget: "mid", level: "advanced", rating: 4.9,
    coords: [6.87, 45.92],
  },
  {
    id: "4", title: "Kalymnos Sport Climbing", activityType: "climbing",
    region: "Aegean Islands", country: "Greece",
    days: 10, avgDistanceKm: null, avgElevationM: null,
    description: "World-class limestone sport climbing on the Aegean island — thousands of routes from 5a to 9a.",
    budget: "budget", level: "intermediate", rating: 4.7,
    coords: [26.98, 37.05],
  },
  {
    id: "5", title: "Finale Ligure Enduro", activityType: "mtb",
    region: "Ligurian Riviera", country: "Italy",
    days: 5, avgDistanceKm: 40, avgElevationM: 1600,
    description: "Loamy singletrack, stone-slab tech sections, sea views — Europe's best enduro destination.",
    budget: "mid", level: "advanced", rating: 4.8,
    coords: [8.34, 44.17],
  },
  {
    id: "6", title: "Verbier Freeride Week", activityType: "skiing",
    region: "Valais Alps", country: "Switzerland",
    days: 6, avgDistanceKm: null, avgElevationM: 2200,
    description: "Off-piste skiing in the 4 Vallées — Mont Fort descents, Tortin chutes, glacier runs.",
    budget: "luxury", level: "advanced", rating: 4.9,
    coords: [7.23, 46.1],
  },
  {
    id: "7", title: "Sistiana Gravel Loop", activityType: "cycling",
    region: "Karst Plateau", country: "Slovenia",
    days: 4, avgDistanceKm: 65, avgElevationM: 900,
    description: "Rolling karst plateau routes connecting the Adriatic coast to Slovenian wine country.",
    budget: "budget", level: "intermediate", rating: 4.4,
    coords: [13.6, 45.7],
  },
  {
    id: "8", title: "Peaks of the Balkans", activityType: "hiking",
    region: "Prokletije", country: "Albania",
    days: 10, avgDistanceKm: 20, avgElevationM: 1300,
    description: "Remote multi-day traverse through Albania, Kosovo, and Montenegro on rugged mountain trails.",
    budget: "budget", level: "intermediate", rating: 4.6,
    coords: [20.1, 42.4],
  },
  {
    id: "9", title: "Aiguilles Rouges Traverse", activityType: "trail_running",
    region: "French Alps", country: "France",
    days: 3, avgDistanceKm: 30, avgElevationM: 2100,
    description: "Technical alpine ridge running above Chamonix with jaw-dropping views of Mont Blanc.",
    budget: "mid", level: "advanced", rating: 4.7,
    coords: [6.78, 45.97],
  },
  {
    id: "10", title: "Fontainebleau Bouldering", activityType: "climbing",
    region: "Île-de-France", country: "France",
    days: 3, avgDistanceKm: null, avgElevationM: null,
    description: "The world's best bouldering forest — thousands of sandstone problems across all grades.",
    budget: "budget", level: "beginner", rating: 4.5,
    coords: [2.67, 48.4],
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVITY_OPTIONS = [
  { key: "cycling", label: "Cycling" },
  { key: "mtb", label: "MTB" },
  { key: "hiking", label: "Hiking" },
  { key: "trail_running", label: "Trail" },
  { key: "climbing", label: "Climbing" },
  { key: "skiing", label: "Skiing" },
];

const ACTIVITY_SHORT: Record<string, string> = {
  cycling: "ROAD", mtb: "MTB", hiking: "HIKE",
  trail_running: "TRAIL", climbing: "CLIMB", skiing: "SKI", other: "ADV",
};

const DURATION_OPTIONS = [
  { key: "1-3", label: "1–3 days" },
  { key: "4-7", label: "4–7 days" },
  { key: "8-14", label: "1–2 weeks" },
  { key: "14+", label: "2+ weeks" },
];

const BUDGET_OPTIONS = [
  { key: "budget", label: "Budget" },
  { key: "mid", label: "Mid-range" },
  { key: "luxury", label: "Luxury" },
];

const LEVEL_OPTIONS = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

const RATING_OPTIONS = [
  { key: 4.5, label: "4.5+" },
  { key: 4, label: "4.0+" },
  { key: 3, label: "3.0+" },
];

const REGIONS = [...new Set(MOCK_ADVENTURES.map(a => a.region))].sort();

// ─── Filter helpers ───────────────────────────────────────────────────────────

function matchesDuration(days: number, duration: string | null): boolean {
  if (!duration) return true;
  if (duration === "1-3") return days <= 3;
  if (duration === "4-7") return days >= 4 && days <= 7;
  if (duration === "8-14") return days >= 8 && days <= 14;
  if (duration === "14+") return days > 14;
  return true;
}

function applyFilters(adventures: Adventure[], filters: FilterState): Adventure[] {
  return adventures.filter(a => {
    if (filters.activities.length > 0 && !filters.activities.includes(a.activityType)) return false;
    if (!matchesDuration(a.days, filters.duration)) return false;
    if (filters.budget && a.budget !== filters.budget) return false;
    if (filters.level && a.level !== filters.level) return false;
    if (filters.rating !== null && a.rating < filters.rating) return false;
    if (filters.region && a.region !== filters.region) return false;
    return true;
  });
}

function countActiveFilters(filters: FilterState): number {
  let n = filters.activities.length;
  if (filters.duration) n++;
  if (filters.budget) n++;
  if (filters.level) n++;
  if (filters.rating !== null) n++;
  if (filters.region) n++;
  return n;
}

// ─── GeoJSON ──────────────────────────────────────────────────────────────────

function toGeoJson(adventures: Adventure[]) {
  return {
    type: "FeatureCollection" as const,
    features: adventures.map(a => ({
      type: "Feature" as const,
      id: a.id,
      geometry: { type: "Point" as const, coordinates: a.coords },
      properties: {
        id: a.id,
        title: a.title,
        activityType: a.activityType,
        color: ACTIVITY_COLOR[a.activityType] ?? colors.accent,
        label: ACTIVITY_SHORT[a.activityType] ?? "ADV",
        rating: a.rating,
        days: a.days,
      },
    })),
  };
}

// ─── Filter sheet ─────────────────────────────────────────────────────────────

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={filterStyles.section}>
      <Text style={filterStyles.sectionTitle}>{title}</Text>
      <View style={filterStyles.optionRow}>{children}</View>
    </View>
  );
}

function FilterChip({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[filterStyles.chip, active && filterStyles.chipActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[filterStyles.chipText, active && filterStyles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FilterSheet({
  visible, filters, onChange, onClose, onReset,
}: {
  visible: boolean;
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  const toggleActivity = (key: string) => {
    const acts = filters.activities.includes(key)
      ? filters.activities.filter(a => a !== key)
      : [...filters.activities, key];
    onChange({ ...filters, activities: acts });
  };

  return (
    <View style={filterStyles.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />
      <View style={[filterStyles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        {/* Header */}
        <View style={filterStyles.header}>
          <Text style={filterStyles.headerTitle}>Filter adventures</Text>
          <View style={filterStyles.headerActions}>
            <TouchableOpacity onPress={onReset}>
              <Text style={filterStyles.resetText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={filterStyles.closeBtn}>
              <Feather name="x" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={filterStyles.body}>
          <FilterSection title="Activity">
            {ACTIVITY_OPTIONS.map(o => (
              <FilterChip
                key={o.key} label={o.label}
                active={filters.activities.includes(o.key)}
                onPress={() => toggleActivity(o.key)}
              />
            ))}
          </FilterSection>

          <FilterSection title="Duration">
            {DURATION_OPTIONS.map(o => (
              <FilterChip
                key={o.key} label={o.label}
                active={filters.duration === o.key}
                onPress={() => onChange({ ...filters, duration: filters.duration === o.key ? null : o.key })}
              />
            ))}
          </FilterSection>

          <FilterSection title="Budget">
            {BUDGET_OPTIONS.map(o => (
              <FilterChip
                key={o.key} label={o.label}
                active={filters.budget === o.key}
                onPress={() => onChange({ ...filters, budget: filters.budget === o.key ? null : o.key })}
              />
            ))}
          </FilterSection>

          <FilterSection title="Experience level">
            {LEVEL_OPTIONS.map(o => (
              <FilterChip
                key={o.key} label={o.label}
                active={filters.level === o.key}
                onPress={() => onChange({ ...filters, level: filters.level === o.key ? null : o.key })}
              />
            ))}
          </FilterSection>

          <FilterSection title="Min rating">
            {RATING_OPTIONS.map(o => (
              <FilterChip
                key={o.key} label={o.label}
                active={filters.rating === o.key}
                onPress={() => onChange({ ...filters, rating: filters.rating === o.key ? null : o.key as number })}
              />
            ))}
          </FilterSection>

          <FilterSection title="Region">
            {REGIONS.map(r => (
              <FilterChip
                key={r} label={r}
                active={filters.region === r}
                onPress={() => onChange({ ...filters, region: filters.region === r ? null : r })}
              />
            ))}
          </FilterSection>
        </ScrollView>
      </View>
    </View>
  );
}

// ─── Adventure bottom sheet ───────────────────────────────────────────────────

const SHEET_HEIGHT = 290;

function AdventureSheet({
  adventure, translateY, onClose, onPlan,
}: {
  adventure: Adventure | null;
  translateY: Animated.Value;
  onClose: () => void;
  onPlan: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!adventure) return null;
  const pinColor = ACTIVITY_COLOR[adventure.activityType] ?? colors.accent;

  return (
    <Animated.View style={[
      styles.sheet,
      { transform: [{ translateY }], paddingBottom: insets.bottom + spacing.sm },
    ]}>
      <View style={styles.handle} />
      <View style={styles.sheetContent}>
        <View style={styles.sheetTopRow}>
          <View style={[styles.activityChip, { backgroundColor: pinColor + "22" }]}>
            <Text style={[styles.activityChipText, { color: pinColor }]}>
              {ACTIVITY_SHORT[adventure.activityType] ?? "ADV"}
            </Text>
          </View>
          <Text style={styles.regionText}>{adventure.region}, {adventure.country}</Text>
          <Text style={styles.ratingText}>★ {adventure.rating}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Feather name="x" size={16} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sheetTitle}>{adventure.title}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statText}>{adventure.days} days</Text>
          </View>
          {adventure.avgDistanceKm && (
            <View style={styles.statChip}>
              <Text style={styles.statText}>{adventure.avgDistanceKm} km/day</Text>
            </View>
          )}
          {adventure.avgElevationM && (
            <View style={styles.statChip}>
              <Text style={styles.statText}>{adventure.avgElevationM} m ↑/day</Text>
            </View>
          )}
          <View style={styles.statChip}>
            <Text style={styles.statText}>{adventure.level}</Text>
          </View>
        </View>

        <Text style={styles.sheetDesc} numberOfLines={2}>{adventure.description}</Text>

        <TouchableOpacity style={styles.ctaBtn} onPress={onPlan} activeOpacity={0.85}>
          <Text style={styles.ctaText}>Plan this adventure</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<InstanceType<typeof Camera>>(null);

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedAdventure, setSelectedAdventure] = useState<Adventure | null>(null);
  const sheetY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const filtered = useMemo(() => applyFilters(MOCK_ADVENTURES, filters), [filters]);
  const geoJson = useMemo(() => toGeoJson(filtered), [filtered]);
  const activeFilterCount = countActiveFilters(filters);

  const showSheet = useCallback((adventure: Adventure) => {
    setSelectedAdventure(adventure);
    Animated.spring(sheetY, {
      toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
    }).start();
  }, [sheetY]);

  const hideSheet = useCallback(() => {
    Animated.timing(sheetY, {
      toValue: SHEET_HEIGHT, duration: 200, useNativeDriver: true,
    }).start(() => setSelectedAdventure(null));
  }, [sheetY]);

  const onMapPress = useCallback((e: { features?: GeoJSON.Feature[] }) => {
    const feature = e.features?.[0];
    if (!feature) { hideSheet(); return; }

    const props = feature.properties as Record<string, unknown>;

    if (props?.cluster) {
      // Zoom into cluster
      const coords = (feature.geometry as GeoJSON.Point).coordinates;
      cameraRef.current?.setCamera({
        centerCoordinate: coords as [number, number],
        zoomLevel: (props.expansion_zoom as number) ?? 6,
        animationDuration: 400,
      });
    } else if (props?.id) {
      const adventure = MOCK_ADVENTURES.find(a => a.id === String(props.id));
      if (adventure) showSheet(adventure);
    }
  }, [hideSheet, showSheet]);

  return (
    <View style={styles.container}>
      {/* Full-screen map */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        styleURL="mapbox://styles/mapbox/outdoors-v12"
        onPress={hideSheet}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: [13.0, 46.5], zoomLevel: 3.8 }}
        />

        <ShapeSource
          id="adventures"
          shape={geoJson}
          cluster={true}
          clusterRadius={50}
          clusterMaxZoom={7}
          onPress={onMapPress}
        >
          {/* ── Cluster circles ── */}
          <CircleLayer
            id="clusters"
            filter={["has", "point_count"]}
            style={{
              circleColor: colors.accent,
              circleRadius: ["step", ["get", "point_count"], 22, 5, 30, 20, 38],
              circleOpacity: 0.92,
              circleStrokeWidth: 2.5,
              circleStrokeColor: "#FFFFFF",
            }}
          />
          {/* Cluster count */}
          <SymbolLayer
            id="cluster-count"
            filter={["has", "point_count"]}
            style={{
              textField: "{point_count_abbreviated}",
              textFont: ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
              textSize: 14,
              textColor: "#FFFFFF",
              textIgnorePlacement: true,
              textAllowOverlap: true,
            }}
          />

          {/* ── Individual pin circles ── */}
          <CircleLayer
            id="pin-circle"
            filter={["!", ["has", "point_count"]]}
            style={{
              circleColor: ["get", "color"],
              circleRadius: 13,
              circleStrokeWidth: 2.5,
              circleStrokeColor: "#FFFFFF",
              circlePitchAlignment: "map",
            }}
          />
          {/* Activity type label above pin */}
          <SymbolLayer
            id="pin-label"
            filter={["!", ["has", "point_count"]]}
            style={{
              textField: ["get", "label"],
              textFont: ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
              textSize: 9,
              textColor: "#FFFFFF",
              textHaloColor: ["get", "color"],
              textHaloWidth: 2,
              textOffset: [0, -2.2],
              textAnchor: "bottom",
              textIgnorePlacement: false,
              textAllowOverlap: false,
            }}
          />
        </ShapeSource>
      </MapView>

      {/* Filter button — floating top-right */}
      <View style={[styles.filterBtnWrap, { top: insets.top + spacing.sm }]}>
        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setFilterOpen(true)}
          activeOpacity={0.85}
        >
          <Feather name="sliders" size={16} color={activeFilterCount > 0 ? colors.inverse : colors.text} />
          {activeFilterCount > 0 && (
            <Text style={styles.filterCount}>{activeFilterCount}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Results count — floating top-left */}
      <View style={[styles.resultsWrap, { top: insets.top + spacing.sm }]}>
        <Text style={styles.resultsText}>{filtered.length} adventure{filtered.length !== 1 ? "s" : ""}</Text>
      </View>

      {/* Filter sheet */}
      <FilterSheet
        visible={filterOpen}
        filters={filters}
        onChange={setFilters}
        onClose={() => setFilterOpen(false)}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />

      {/* Adventure preview sheet */}
      <AdventureSheet
        adventure={selectedAdventure}
        translateY={sheetY}
        onClose={hideSheet}
        onPlan={() => { hideSheet(); router.push("/(app)/discover"); }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  filterBtnWrap: { position: "absolute", right: spacing.md },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.full,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  filterBtnActive: { backgroundColor: colors.accent },
  filterCount: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.inverse,
  },

  resultsWrap: { position: "absolute", left: spacing.md },
  resultsText: {
    backgroundColor: "rgba(0,0,0,0.55)",
    color: "#FFFFFF",
    fontSize: fontSize.xs,
    fontWeight: "600",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    overflow: "hidden",
  },

  // ── Adventure bottom sheet ─────────────────────────────────────────────────
  sheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 16,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: spacing.sm,
  },
  sheetContent: { padding: spacing.md, gap: spacing.sm },
  sheetTopRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
  },
  activityChip: {
    paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full,
  },
  activityChipText: { fontSize: fontSize.xs, fontWeight: "700", letterSpacing: 0.5 },
  regionText: { flex: 1, fontSize: fontSize.sm, color: colors.muted },
  ratingText: { fontSize: fontSize.sm, fontWeight: "700", color: "#F59E0B" },
  sheetTitle: {
    fontSize: fontSize.xl, fontWeight: "800", color: colors.text, letterSpacing: -0.3,
  },
  statsRow: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" },
  statChip: {
    backgroundColor: colors.sheet, borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  statText: { fontSize: fontSize.xs, color: colors.muted, fontWeight: "600" },
  sheetDesc: { fontSize: fontSize.sm, color: colors.muted, lineHeight: 20 },
  ctaBtn: {
    backgroundColor: colors.accent, borderRadius: radius.full,
    paddingVertical: 14, alignItems: "center", marginTop: spacing.xs,
  },
  ctaText: { color: colors.inverse, fontWeight: "700", fontSize: fontSize.base },
});

const filterStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
    zIndex: 100,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  resetText: { fontSize: fontSize.sm, color: colors.accent, fontWeight: "600" },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.sheet,
    alignItems: "center", justifyContent: "center",
  },
  body: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: fontSize.sm, fontWeight: "700",
    color: colors.text, textTransform: "uppercase", letterSpacing: 0.5,
  },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 3,
    borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontSize: fontSize.sm, color: colors.text, fontWeight: "500" },
  chipTextActive: { color: colors.inverse },
});
