import React, { useRef, useState, useCallback, useMemo } from "react";
import {
  Animated, Dimensions, FlatList, Image, Modal, PanResponder,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Mapbox, {
  MapView, Camera, ShapeSource,
  CircleLayer, SymbolLayer, PointAnnotation,
} from "@rnmapbox/maps";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fontSize, radius, spacing, ACTIVITY_COLOR } from "../../../lib/theme";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");

const SCREEN_H      = Dimensions.get("window").height;
const SCREEN_W      = Dimensions.get("window").width;
const SNAP_PEEK     = SCREEN_H - 90;
const SNAP_HALF     = SCREEN_H * 0.45;
const SNAP_EXPANDED = SCREEN_H * 0.12;
const CARD_W        = SCREEN_W - 32;
const CARD_H        = 260;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Adventure {
  id: string;
  title: string;
  activityTypes: string[];
  region: string;
  country: string;
  days: number;
  avgDistanceKm: number | null;
  avgElevationM: number | null;
  description: string;
  budget: "budget" | "mid" | "luxury";
  level: "beginner" | "intermediate" | "advanced";
  rating: number;
  coords: [number, number];
  uploadedBy: string | null;
  photos: string[];
}

interface FilterState {
  activities: string[];
  duration: string | null;
  budget: string | null;
  level: string | null;
  rating: number | null;
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
    id: "1", title: "Sa Calobra Loop", activityTypes: ["cycling"],
    region: "Balearic Islands", country: "Spain",
    days: 7, avgDistanceKm: 85, avgElevationM: 1800,
    description: "Mallorca's iconic cycling circuit — Sa Calobra, Cap Formentor, and the Tramuntana mountains.",
    budget: "mid", level: "advanced", rating: 4.9,
    coords: [-2.85, 39.85], uploadedBy: "James",
    photos: ["https://picsum.photos/seed/1-1/800/500", "https://picsum.photos/seed/1-2/800/500", "https://picsum.photos/seed/1-3/800/500"],
  },
  {
    id: "2", title: "Alta Via 1", activityTypes: ["hiking"],
    region: "Dolomites", country: "Italy",
    days: 8, avgDistanceKm: 22, avgElevationM: 1100,
    description: "Hut-to-hut traverse of the Dolomites on one of Europe's most iconic long-distance trails.",
    budget: "mid", level: "intermediate", rating: 4.8,
    coords: [12.0, 46.5], uploadedBy: null,
    photos: ["https://picsum.photos/seed/2-1/800/500", "https://picsum.photos/seed/2-2/800/500", "https://picsum.photos/seed/2-3/800/500"],
  },
  {
    id: "3", title: "UTMB Course Recon", activityTypes: ["trail_running", "hiking"],
    region: "Mont Blanc", country: "France",
    days: 5, avgDistanceKm: 35, avgElevationM: 2400,
    description: "Run the iconic 170km UTMB loop in stages — one of trail running's ultimate bucket-list objectives.",
    budget: "mid", level: "advanced", rating: 4.9,
    coords: [6.87, 45.92], uploadedBy: "Sophie",
    photos: ["https://picsum.photos/seed/3-1/800/500", "https://picsum.photos/seed/3-2/800/500", "https://picsum.photos/seed/3-3/800/500"],
  },
  {
    id: "4", title: "Kalymnos Sport Climbing", activityTypes: ["climbing"],
    region: "Aegean Islands", country: "Greece",
    days: 10, avgDistanceKm: null, avgElevationM: null,
    description: "World-class limestone sport climbing on the Aegean island — thousands of routes from 5a to 9a.",
    budget: "budget", level: "intermediate", rating: 4.7,
    coords: [26.98, 37.05], uploadedBy: null,
    photos: ["https://picsum.photos/seed/4-1/800/500", "https://picsum.photos/seed/4-2/800/500", "https://picsum.photos/seed/4-3/800/500"],
  },
  {
    id: "5", title: "Finale Ligure Enduro", activityTypes: ["mtb", "cycling"],
    region: "Ligurian Riviera", country: "Italy",
    days: 5, avgDistanceKm: 40, avgElevationM: 1600,
    description: "Loamy singletrack, stone-slab tech sections, sea views — Europe's best enduro destination.",
    budget: "mid", level: "advanced", rating: 4.8,
    coords: [8.34, 44.17], uploadedBy: "Marco",
    photos: ["https://picsum.photos/seed/5-1/800/500", "https://picsum.photos/seed/5-2/800/500", "https://picsum.photos/seed/5-3/800/500"],
  },
  {
    id: "6", title: "Verbier Freeride Week", activityTypes: ["skiing"],
    region: "Valais Alps", country: "Switzerland",
    days: 6, avgDistanceKm: null, avgElevationM: 2200,
    description: "Off-piste skiing in the 4 Vallées — Mont Fort descents, Tortin chutes, glacier runs.",
    budget: "luxury", level: "advanced", rating: 4.9,
    coords: [7.23, 46.1], uploadedBy: null,
    photos: ["https://picsum.photos/seed/6-1/800/500", "https://picsum.photos/seed/6-2/800/500", "https://picsum.photos/seed/6-3/800/500"],
  },
  {
    id: "7", title: "Sistiana Gravel Loop", activityTypes: ["cycling"],
    region: "Karst Plateau", country: "Slovenia",
    days: 4, avgDistanceKm: 65, avgElevationM: 900,
    description: "Rolling karst plateau routes connecting the Adriatic coast to Slovenian wine country.",
    budget: "budget", level: "intermediate", rating: 4.4,
    coords: [13.6, 45.7], uploadedBy: "Lena",
    photos: ["https://picsum.photos/seed/7-1/800/500", "https://picsum.photos/seed/7-2/800/500", "https://picsum.photos/seed/7-3/800/500"],
  },
  {
    id: "8", title: "Peaks of the Balkans", activityTypes: ["hiking"],
    region: "Prokletije", country: "Albania",
    days: 10, avgDistanceKm: 20, avgElevationM: 1300,
    description: "Remote multi-day traverse through Albania, Kosovo, and Montenegro on rugged mountain trails.",
    budget: "budget", level: "intermediate", rating: 4.6,
    coords: [20.1, 42.4], uploadedBy: null,
    photos: ["https://picsum.photos/seed/8-1/800/500", "https://picsum.photos/seed/8-2/800/500", "https://picsum.photos/seed/8-3/800/500"],
  },
  {
    id: "9", title: "Aiguilles Rouges Traverse", activityTypes: ["trail_running"],
    region: "French Alps", country: "France",
    days: 3, avgDistanceKm: 30, avgElevationM: 2100,
    description: "Technical alpine ridge running above Chamonix with jaw-dropping views of Mont Blanc.",
    budget: "mid", level: "advanced", rating: 4.7,
    coords: [6.78, 45.97], uploadedBy: "Thomas",
    photos: ["https://picsum.photos/seed/9-1/800/500", "https://picsum.photos/seed/9-2/800/500", "https://picsum.photos/seed/9-3/800/500"],
  },
  {
    id: "10", title: "Fontainebleau Bouldering", activityTypes: ["climbing"],
    region: "Île-de-France", country: "France",
    days: 3, avgDistanceKm: null, avgElevationM: null,
    description: "The world's best bouldering forest — thousands of sandstone problems across all grades.",
    budget: "budget", level: "beginner", rating: 4.5,
    coords: [2.67, 48.4], uploadedBy: null,
    photos: ["https://picsum.photos/seed/10-1/800/500", "https://picsum.photos/seed/10-2/800/500", "https://picsum.photos/seed/10-3/800/500"],
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

const ACTIVITY_ICON: Record<string, string> = {
  cycling:       "bike",
  road_cycling:  "bike-fast",
  mtb:           "bike-fast",
  hiking:        "hiking",
  trail_running: "run",
  climbing:      "carabiner",
  skiing:        "ski",
  kayaking:      "kayaking",
  gravel:        "bike",
  bikepacking:   "bike",
  other:         "map-marker-outline",
};

const PILL_ZOOM     = 4.5;
const CLUSTER_RADIUS = 50;

function getUnclusteredIds(adventures: Adventure[], zoom: number): Set<string> {
  const scale = 256 * Math.pow(2, zoom);
  const toPixel = (lng: number, lat: number) => {
    const x = ((lng + 180) / 360) * scale;
    const latRad = (lat * Math.PI) / 180;
    const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * scale;
    return { x, y };
  };
  const pts = adventures.map(a => ({ id: a.id, ...toPixel(a.coords[0], a.coords[1]) }));
  const inCluster = new Set<string>();
  for (let i = 0; i < pts.length; i++) {
    if (inCluster.has(pts[i].id)) continue;
    for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i].x - pts[j].x;
      const dy = pts[i].y - pts[j].y;
      if (Math.sqrt(dx * dx + dy * dy) < CLUSTER_RADIUS) {
        inCluster.add(pts[j].id);
        inCluster.add(pts[i].id);
      }
    }
  }
  return new Set(adventures.map(a => a.id).filter(id => !inCluster.has(id)));
}

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
    if (filters.activities.length > 0 && !a.activityTypes.some(t => filters.activities.includes(t))) return false;
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
        activityType: a.activityTypes[0],
        color: ACTIVITY_COLOR[a.activityTypes[0]] ?? colors.accent,
        label: ACTIVITY_SHORT[a.activityTypes[0]] ?? "ADV",
        rating: a.rating,
        days: a.days,
      },
    })),
  };
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatDuration(days: number): string {
  if (days < 7) return `${days} days`;
  const weeks = Math.round(days / 7);
  if (days < 28) return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  const months = Math.round(days / 30);
  if (days < 365) return `${months} ${months === 1 ? "month" : "months"}`;
  const years = Math.round(days / 365);
  return `${years} ${years === 1 ? "year" : "years"}`;
}

function formatBudget(budget: string): string {
  const map: Record<string, string> = { budget: "$", mid: "$$", luxury: "$$$" };
  return map[budget] ?? "$";
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
  const pinColor = ACTIVITY_COLOR[adventure.activityTypes[0]] ?? colors.accent;

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
              {ACTIVITY_SHORT[adventure.activityTypes[0]] ?? "ADV"}
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

// ─── Pill pin ─────────────────────────────────────────────────────────────────

function PillPin({ adventure }: { adventure: Adventure }) {
  const label = adventure.uploadedBy ?? "Public";
  return (
    <View style={pillStyles.pill}>
      <Text style={pillStyles.label} numberOfLines={1}>{label}</Text>
      {adventure.activityTypes.map(type => {
        const iconName = (ACTIVITY_ICON[type] ?? "map-marker-outline") as React.ComponentProps<typeof MaterialCommunityIcons>["name"];
        return <MaterialCommunityIcons key={type} name={iconName} size={15} color="#000000" />;
      })}
    </View>
  );
}

// ─── Adventure card (impressions tile) ────────────────────────────────────────

function AdventureCard({
  adventure, isSaved, onToggleSaved, onPress,
}: {
  adventure: Adventure;
  isSaved: boolean;
  onToggleSaved: () => void;
  onPress: () => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);

  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.95}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_W);
          setPhotoIndex(idx);
        }}
        scrollEventThrottle={16}
        style={StyleSheet.absoluteFillObject}
      >
        {adventure.photos.map((uri, i) => (
          <Image
            key={i}
            source={{ uri }}
            style={{ width: CARD_W, height: CARD_H }}
            resizeMode="cover"
          />
        ))}
      </ScrollView>

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.65)"]}
        style={cardStyles.gradient}
      />

      <TouchableOpacity
        style={cardStyles.heartBtn}
        onPress={onToggleSaved}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialCommunityIcons
          name={isSaved ? "heart" : "heart-outline"}
          size={20}
          color={isSaved ? "#EF4444" : "#FFFFFF"}
        />
      </TouchableOpacity>

      <View style={cardStyles.textOverlay} pointerEvents="none">
        <View style={cardStyles.titleRow}>
          <Text style={cardStyles.cardTitle} numberOfLines={1}>{adventure.title}</Text>
          <View style={cardStyles.dots}>
            {adventure.photos.map((_, i) => (
              <View key={i} style={[cardStyles.dot, photoIndex === i && cardStyles.dotActive]} />
            ))}
          </View>
        </View>
        <Text style={cardStyles.cardSubtitle}>
          {formatDuration(adventure.days)} · {adventure.level} · {formatBudget(adventure.budget)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Adventure expanded modal ─────────────────────────────────────────────────

function AdventureExpandedModal({
  adventure, visible, isSaved, onToggleSaved, onClose,
}: {
  adventure: Adventure | null;
  visible: boolean;
  isSaved: boolean;
  onToggleSaved: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [photoIndex, setPhotoIndex] = useState(0);
  const SCREEN_W = Dimensions.get("window").width;
  const PHOTO_H  = SCREEN_H * 0.55;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      {adventure && (
        <View style={modalStyles.container}>
          {/* Photo carousel */}
          <View style={{ height: PHOTO_H }}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                setPhotoIndex(idx);
              }}
              scrollEventThrottle={16}
              style={StyleSheet.absoluteFillObject}
            >
              {adventure.photos.map((uri, i) => (
                <Image
                  key={i}
                  source={{ uri }}
                  style={{ width: SCREEN_W, height: PHOTO_H }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>

            <LinearGradient
              colors={["rgba(0,0,0,0.25)", "transparent", "rgba(0,0,0,0.55)"]}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />

            {/* Top bar */}
            <View style={[modalStyles.topBar, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity style={modalStyles.iconBtn} onPress={onClose}>
                <Feather name="arrow-left" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={modalStyles.iconBtn} onPress={onToggleSaved}>
                <MaterialCommunityIcons
                  name={isSaved ? "heart" : "heart-outline"}
                  size={20}
                  color={isSaved ? "#EF4444" : "#FFFFFF"}
                />
              </TouchableOpacity>
            </View>

            {/* Title + location overlaid on photo bottom */}
            <View style={modalStyles.photoBottom} pointerEvents="none">
              <Text style={modalStyles.modalTitle} numberOfLines={2}>{adventure.title}</Text>
              <View style={modalStyles.locationRow}>
                <Feather name="map-pin" size={13} color="rgba(255,255,255,0.85)" />
                <Text style={modalStyles.locationText}>{adventure.region}, {adventure.country}</Text>
                <Text style={modalStyles.ratingBadge}>★ {adventure.rating}</Text>
              </View>
              <View style={modalStyles.modalDots}>
                {adventure.photos.map((_, i) => (
                  <View key={i} style={[modalStyles.modalDot, photoIndex === i && modalStyles.modalDotActive]} />
                ))}
              </View>
            </View>
          </View>

          {/* White detail sheet */}
          <ScrollView
            style={modalStyles.detailSheet}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          >
            {/* Activity icons */}
            <View style={modalStyles.activityRow}>
              {adventure.activityTypes.map(type => {
                const iconName = (ACTIVITY_ICON[type] ?? "map-marker-outline") as React.ComponentProps<typeof MaterialCommunityIcons>["name"];
                return (
                  <View key={type} style={modalStyles.activityItem}>
                    <MaterialCommunityIcons name={iconName} size={26} color={colors.accent} />
                    <Text style={modalStyles.activityLabel}>
                      {type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                    </Text>
                  </View>
                );
              })}
            </View>

            <Text style={modalStyles.sectionHeader}>About this adventure</Text>
            <Text style={modalStyles.description}>{adventure.description}</Text>

            <View style={modalStyles.chipsRow}>
              <View style={modalStyles.detailChip}>
                <Text style={modalStyles.detailChipText}>{formatDuration(adventure.days)}</Text>
              </View>
              <View style={modalStyles.detailChip}>
                <Text style={modalStyles.detailChipText}>{adventure.level}</Text>
              </View>
              <View style={modalStyles.detailChip}>
                <Text style={modalStyles.detailChipText}>{formatBudget(adventure.budget)}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={modalStyles.ctaBtn}
              onPress={() => {
                onClose();
                router.push(`/(app)/trips/${adventure.id}` as any);
              }}
              activeOpacity={0.85}
            >
              <Text style={modalStyles.ctaText}>See full adventure</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}

// ─── Impressions sheet ────────────────────────────────────────────────────────

function ImpressionsSheet({
  adventures, savedIds, onToggleSaved, onCardPress, impressionsY,
}: {
  adventures: Adventure[];
  savedIds: Set<string>;
  onToggleSaved: (id: string) => void;
  onCardPress: (adv: Adventure) => void;
  impressionsY: Animated.Value;
}) {
  const snapStateRef = useRef<"peek" | "half" | "expanded">("peek");

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dy) > 5 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderGrant: () => {
      impressionsY.stopAnimation();
      impressionsY.extractOffset();
    },
    onPanResponderMove: (_, g) => {
      impressionsY.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      impressionsY.flattenOffset();
      const currentY = (impressionsY as any)._value;
      const { vy } = g;

      let target: number;
      if (vy > 0.5) {
        target = snapStateRef.current === "expanded" ? SNAP_HALF : SNAP_PEEK;
      } else if (vy < -0.5) {
        target = snapStateRef.current === "peek" ? SNAP_HALF : SNAP_EXPANDED;
      } else {
        const opts = [
          { v: SNAP_PEEK,     d: Math.abs(currentY - SNAP_PEEK) },
          { v: SNAP_HALF,     d: Math.abs(currentY - SNAP_HALF) },
          { v: SNAP_EXPANDED, d: Math.abs(currentY - SNAP_EXPANDED) },
        ];
        target = opts.reduce((a, b) => (a.d < b.d ? a : b)).v;
      }

      snapStateRef.current =
        target === SNAP_PEEK ? "peek" : target === SNAP_HALF ? "half" : "expanded";
      Animated.spring(impressionsY, {
        toValue: target, useNativeDriver: true, tension: 65, friction: 11,
      }).start();
    },
  }), [impressionsY]);

  return (
    <Animated.View style={[impStyles.sheet, { transform: [{ translateY: impressionsY }] }]}>
      <View style={impStyles.handleArea} {...panResponder.panHandlers}>
        <View style={impStyles.handle} />
        <Text style={impStyles.countLabel}>
          {adventures.length} public {adventures.length === 1 ? "adventure" : "adventures"}
        </Text>
      </View>

      <FlatList
        data={adventures}
        keyExtractor={a => a.id}
        showsVerticalScrollIndicator={false}
        snapToInterval={CARD_H + 16}
        decelerationRate="fast"
        contentContainerStyle={impStyles.listContent}
        renderItem={({ item }) => (
          <AdventureCard
            adventure={item}
            isSaved={savedIds.has(item.id)}
            onToggleSaved={() => onToggleSaved(item.id)}
            onPress={() => onCardPress(item)}
          />
        )}
      />
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<Camera>(null);

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedAdventure, setSelectedAdventure] = useState<Adventure | null>(null);
  const [expandedAdventure, setExpandedAdventure] = useState<Adventure | null>(null);
  const [zoom, setZoom] = useState(3.8);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const sheetY      = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const impressionsY = useRef(new Animated.Value(SNAP_PEEK)).current;

  const filtered = useMemo(() => applyFilters(MOCK_ADVENTURES, filters), [filters]);
  const geoJson  = useMemo(() => toGeoJson(filtered), [filtered]);
  const activeFilterCount = countActiveFilters(filters);
  const unclusteredIds    = useMemo(() => getUnclusteredIds(filtered, zoom), [filtered, zoom]);
  const publicAdventures  = useMemo(() => filtered.filter(a => a.uploadedBy === null), [filtered]);

  const toggleSaved = useCallback((id: string) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const showSheet = useCallback((adventure: Adventure) => {
    setSelectedAdventure(adventure);
    Animated.spring(impressionsY, {
      toValue: SCREEN_H, useNativeDriver: true, tension: 65, friction: 11,
    }).start();
    Animated.spring(sheetY, {
      toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
    }).start();
  }, [sheetY, impressionsY]);

  const hideSheet = useCallback(() => {
    Animated.timing(sheetY, {
      toValue: SHEET_HEIGHT, duration: 200, useNativeDriver: true,
    }).start(() => {
      setSelectedAdventure(null);
      Animated.spring(impressionsY, {
        toValue: SNAP_PEEK, useNativeDriver: true, tension: 65, friction: 11,
      }).start();
    });
  }, [sheetY, impressionsY]);

  const onMapPress = useCallback((e: { features?: GeoJSON.Feature[] }) => {
    const feature = e.features?.[0];
    if (!feature) { hideSheet(); return; }

    const props = feature.properties as Record<string, unknown>;

    if (props?.cluster) {
      const coords = (feature.geometry as GeoJSON.Point).coordinates;
      cameraRef.current?.setCamera({
        centerCoordinate: coords as [number, number],
        zoomLevel: Math.max((props.expansion_zoom as number) ?? 0, PILL_ZOOM + 1),
        animationDuration: 400,
      });
    } else if (props?.id) {
      const adventure = MOCK_ADVENTURES.find(a => a.id === String(props.id));
      if (adventure) showSheet(adventure);
    }
  }, [hideSheet, showSheet]);

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        styleURL="mapbox://styles/mapbox/outdoors-v12"
        onPress={hideSheet}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        onCameraChanged={(state) => setZoom(state.properties.zoom)}
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
          onPress={onMapPress}
        >
          <CircleLayer
            id="clusters"
            filter={["has", "point_count"]}
            style={{
              circleColor: "rgba(0,0,0,0.55)",
              circleRadius: ["step", ["get", "point_count"], 22, 5, 30, 20, 38],
              circleStrokeWidth: 2.5,
              circleStrokeColor: "#FFFFFF",
            }}
          />
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
        </ShapeSource>

        {zoom >= PILL_ZOOM && filtered
          .filter(adv => unclusteredIds.has(adv.id))
          .map(adv => (
            <PointAnnotation
              key={adv.id}
              id={adv.id}
              coordinate={adv.coords}
              anchor={{ x: 0, y: 1 }}
              onSelected={() => showSheet(adv)}
            >
              <PillPin adventure={adv} />
            </PointAnnotation>
          ))}
      </MapView>

      {/* Filter button */}
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

      {/* Results count */}
      <View style={[styles.resultsWrap, { top: insets.top + spacing.sm }]}>
        <Text style={styles.resultsText}>{filtered.length} adventure{filtered.length !== 1 ? "s" : ""}</Text>
      </View>

      <FilterSheet
        visible={filterOpen}
        filters={filters}
        onChange={setFilters}
        onClose={() => setFilterOpen(false)}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />

      <AdventureSheet
        adventure={selectedAdventure}
        translateY={sheetY}
        onClose={hideSheet}
        onPlan={() => { hideSheet(); router.push("/(app)/discover"); }}
      />

      <ImpressionsSheet
        adventures={publicAdventures}
        savedIds={savedIds}
        onToggleSaved={toggleSaved}
        onCardPress={setExpandedAdventure}
        impressionsY={impressionsY}
      />

      <AdventureExpandedModal
        adventure={expandedAdventure}
        visible={expandedAdventure !== null}
        isSaved={expandedAdventure ? savedIds.has(expandedAdventure.id) : false}
        onToggleSaved={() => expandedAdventure && toggleSaved(expandedAdventure.id)}
        onClose={() => setExpandedAdventure(null)}
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

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 5,
    maxWidth: 160,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  colorBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#000000",
    flexShrink: 1,
  },
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

const cardStyles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.sheet,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  gradient: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: CARD_H * 0.45,
  },
  heartBtn: {
    position: "absolute",
    top: 12, right: 12,
    width: 34, height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  textOverlay: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    padding: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cardTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  dots: {
    flexDirection: "row",
    gap: 4,
    marginLeft: 8,
  },
  dot: {
    width: 5, height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  dotActive: {
    backgroundColor: "#FFFFFF",
  },
  cardSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: fontSize.sm,
  },
});

const impStyles = StyleSheet.create({
  sheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: SCREEN_H,
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  handleArea: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  countLabel: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.muted,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
});

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  topBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 10,
  },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoBottom: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    padding: 16,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: fontSize.xl,
    fontWeight: "800",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  locationText: {
    flex: 1,
    color: "rgba(255,255,255,0.85)",
    fontSize: fontSize.sm,
  },
  ratingBadge: {
    color: "#F59E0B",
    fontWeight: "700",
    fontSize: fontSize.sm,
  },
  modalDots: {
    flexDirection: "row",
    gap: 5,
  },
  modalDot: {
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  modalDotActive: {
    backgroundColor: "#FFFFFF",
    width: 16,
  },
  detailSheet: {
    flex: 1,
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
  },
  activityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityItem: {
    alignItems: "center",
    gap: 4,
  },
  activityLabel: {
    fontSize: fontSize.xs,
    color: colors.muted,
    fontWeight: "500",
  },
  sectionHeader: {
    fontSize: fontSize.base,
    fontWeight: "700",
    color: colors.text,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  description: {
    fontSize: fontSize.sm,
    color: colors.muted,
    lineHeight: 22,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  detailChip: {
    backgroundColor: colors.sheet,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  detailChipText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  ctaBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: 16,
    marginHorizontal: 20,
    alignItems: "center",
  },
  ctaText: {
    color: colors.inverse,
    fontWeight: "700",
    fontSize: fontSize.base,
  },
});
