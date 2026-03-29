import {
  Dimensions, Image, Modal, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import MapboxGL from "@rnmapbox/maps";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { getMyAdventures, type AdventureRow, type AdventureDayRow } from "../../../lib/api";
import { MOCK_TRIPS, MOCK_TRIP_META, type TripMeta } from "../../../lib/mock-trips";
import { colors, fontSize, radius, spacing, shadow } from "../../../lib/theme";

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

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;
const HERO_H  = Math.round(SCREEN_H * 0.3);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDayDate(startDate: string | null, dayNumber: number): string {
  if (!startDate) return `Day ${dayNumber}`;
  const d = new Date(startDate);
  d.setDate(d.getDate() + dayNumber - 1);
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function stopCoords(
  meta: TripMeta | null,
  dayNumber: number,
  totalDays: number,
): [number, number] {
  if (meta?.dayCoords?.[dayNumber]) return meta.dayCoords[dayNumber];
  const base = meta?.coords ?? [0, 0];
  const spread = 0.03;
  const angle = (dayNumber / Math.max(totalDays, 1)) * Math.PI;
  return [
    base[0] + Math.cos(angle) * spread * (dayNumber * 0.5),
    base[1] + Math.sin(angle) * spread * (dayNumber * 0.5),
  ];
}

// ─── Stop card ────────────────────────────────────────────────────────────────

function StopCard({
  day, adventureId, stopNumber, isLast,
}: {
  day: AdventureDayRow;
  adventureId: string;
  stopNumber: number;
  isLast: boolean;
}) {
  const photoUrl = `https://picsum.photos/seed/${adventureId}-${day.dayNumber}/800/500`;

  return (
    <View style={stopStyles.row}>
      {/* Timeline */}
      <View style={stopStyles.timeline}>
        <View style={stopStyles.circle}>
          <Text style={stopStyles.circleNum}>{stopNumber}</Text>
        </View>
        {!isLast && <View style={stopStyles.line} />}
      </View>

      {/* Card body */}
      <View style={stopStyles.card}>
        {/* Photo */}
        <Image
          source={{ uri: photoUrl }}
          style={stopStyles.photo}
          resizeMode="cover"
        />

        {/* Info */}
        <View style={stopStyles.info}>
          <Text style={stopStyles.title} numberOfLines={2}>{day.title}</Text>

          {day.routeNotes ? (
            <View style={stopStyles.infoRow}>
              <Feather name="map-pin" size={11} color={colors.muted} />
              <Text style={stopStyles.infoText} numberOfLines={2}>{day.routeNotes}</Text>
            </View>
          ) : null}

          <View style={stopStyles.infoRow}>
            <Feather name="tag" size={11} color={colors.muted} />
            <Text style={stopStyles.infoText}>Free</Text>
          </View>

          {(day.distanceKm || day.elevationGainM) ? (
            <View style={stopStyles.statsRow}>
              {day.distanceKm ? (
                <View style={stopStyles.statChip}>
                  <Text style={stopStyles.statText}>{day.distanceKm} km</Text>
                </View>
              ) : null}
              {day.elevationGainM ? (
                <View style={stopStyles.statChip}>
                  <Text style={stopStyles.statText}>↑ {day.elevationGainM} m</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Action buttons */}
        <View style={stopStyles.actionRow}>
          <TouchableOpacity style={stopStyles.actionBtn}>
            <Feather name="volume-2" size={13} color={colors.text} />
            <Text style={stopStyles.actionText}>Voice guide</Text>
          </TouchableOpacity>
          <View style={stopStyles.actionDivider} />
          <TouchableOpacity style={stopStyles.actionBtn}>
            <Feather name="navigation" size={13} color={colors.text} />
            <Text style={stopStyles.actionText}>Directions</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Accommodation card ───────────────────────────────────────────────────────

function AccommodationCard({ meta, adventureId }: { meta: TripMeta; adventureId: string }) {
  const photoUrl = `https://picsum.photos/seed/${adventureId}-accom/800/500`;

  return (
    <View style={stopStyles.row}>
      {/* Timeline circle — home icon, accent colour */}
      <View style={stopStyles.timeline}>
        <View style={[stopStyles.circle, { backgroundColor: colors.accent }]}>
          <Feather name="home" size={14} color="#FFFFFF" />
        </View>
      </View>

      {/* Same card body as StopCard */}
      <View style={stopStyles.card}>
        <Image
          source={{ uri: photoUrl }}
          style={stopStyles.photo}
          resizeMode="cover"
        />
        <View style={stopStyles.info}>
          <Text style={stopStyles.title}>{meta.accommodation}</Text>
          <View style={stopStyles.infoRow}>
            <Feather name="moon" size={11} color={colors.muted} />
            <Text style={stopStyles.infoText}>{meta.nights}</Text>
          </View>
          <View style={stopStyles.infoRow}>
            <Feather name="tag" size={11} color={colors.muted} />
            <Text style={stopStyles.infoText}>From €{meta.pricePerNight}/night</Text>
          </View>
        </View>
        <View style={stopStyles.actionRow}>
          <TouchableOpacity style={stopStyles.actionBtn}>
            <Feather name="info" size={13} color={colors.text} />
            <Text style={stopStyles.actionText}>View details</Text>
          </TouchableOpacity>
          <View style={stopStyles.actionDivider} />
          <TouchableOpacity style={stopStyles.actionBtn}>
            <Feather name="external-link" size={13} color={colors.text} />
            <Text style={stopStyles.actionText}>Book</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Map pin marker ───────────────────────────────────────────────────────────

function MapPin({ number, active }: { number: number; active: boolean }) {
  return (
    <View style={[mapStyles.pin, active && mapStyles.pinActive]}>
      <Text style={[mapStyles.pinNum, active && mapStyles.pinNumActive]}>{number}</Text>
    </View>
  );
}

// ─── Map modal ────────────────────────────────────────────────────────────────

function TripMapModal({
  visible, onClose, adventure, days, meta,
}: {
  visible: boolean;
  onClose: (jumpToDay?: number) => void;
  adventure: AdventureRow;
  days: AdventureDayRow[];
  meta: TripMeta | null;
}) {
  const insets = useSafeAreaInsets();
  const [activeIdx, setActiveIdx] = useState(0);

  const stops = days.map((d, i) => ({
    day: d,
    coords: stopCoords(meta, d.dayNumber, days.length),
    index: i,
  }));

  const active = stops[activeIdx];
  const centerCoords = meta?.coords ?? stops[0]?.coords ?? [0, 0];

  const routeGeoJSON = stops.length >= 2
    ? {
        type: "Feature" as const,
        geometry: {
          type: "LineString" as const,
          coordinates: stops.map(s => s.coords),
        },
        properties: {},
      }
    : null;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={{ flex: 1 }}>
        {/* Map */}
        <MapboxGL.MapView style={{ flex: 1 }} logoEnabled={false} attributionEnabled={false}>
          <MapboxGL.Camera
            centerCoordinate={centerCoords}
            zoomLevel={meta ? 10 : 3}
            animationDuration={0}
          />

          {/* Dotted route line */}
          {routeGeoJSON && (
            <MapboxGL.ShapeSource id="tripRoute" shape={routeGeoJSON}>
              <MapboxGL.LineLayer
                id="tripRouteLine"
                style={{
                  lineColor: colors.accent,
                  lineWidth: 2,
                  lineDasharray: [2, 2],
                  lineOpacity: 0.8,
                }}
              />
            </MapboxGL.ShapeSource>
          )}

          {/* Numbered pins */}
          {stops.map((stop, i) => (
            <MapboxGL.PointAnnotation
              key={`map-pin-${i}`}
              id={`map-pin-${i}`}
              coordinate={stop.coords}
              onSelected={() => setActiveIdx(i)}
            >
              <MapPin number={i + 1} active={i === activeIdx} />
            </MapboxGL.PointAnnotation>
          ))}
        </MapboxGL.MapView>

        {/* Top bar */}
        <View style={[mapStyles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={mapStyles.iconBtn} onPress={() => onClose()}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={mapStyles.iconBtn}>
            <Feather name="menu" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Bottom panel */}
        <View style={[mapStyles.bottomPanel, { paddingBottom: insets.bottom + 8 }]}>
          {/* Day selector strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={mapStyles.daySelectorContent}
          >
            {stops.map((stop, i) => (
              <TouchableOpacity
                key={i}
                style={[mapStyles.dayPill, i === activeIdx && mapStyles.dayPillActive]}
                onPress={() => setActiveIdx(i)}
              >
                <Text style={[mapStyles.dayPillText, i === activeIdx && mapStyles.dayPillTextActive]}>
                  Day {stop.day.dayNumber}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Active stop info */}
          {active && (
            <View style={mapStyles.stopCard}>
              <Image
                source={{ uri: `https://picsum.photos/seed/${adventure.id}-${active.day.dayNumber}/800/500` }}
                style={mapStyles.stopPhoto}
                resizeMode="cover"
              />
              <View style={mapStyles.stopInfo}>
                <Text style={mapStyles.stopTitle} numberOfLines={2}>{active.day.title}</Text>
                <View style={mapStyles.stopMetaRow}>
                  <Feather name="map-pin" size={11} color={colors.muted} />
                  <Text style={mapStyles.stopMetaText} numberOfLines={1}>{adventure.region}</Text>
                </View>
                {(active.day.distanceKm || active.day.elevationGainM) ? (
                  <View style={mapStyles.stopMetaRow}>
                    {active.day.distanceKm ? (
                      <Text style={mapStyles.stopMetaText}>{active.day.distanceKm} km</Text>
                    ) : null}
                    {active.day.distanceKm && active.day.elevationGainM ? (
                      <Text style={mapStyles.stopMetaText}>  ·  </Text>
                    ) : null}
                    {active.day.elevationGainM ? (
                      <Text style={mapStyles.stopMetaText}>↑ {active.day.elevationGainM} m</Text>
                    ) : null}
                  </View>
                ) : null}

                {/* Action row */}
                <View style={mapStyles.stopActions}>
                  <TouchableOpacity style={mapStyles.stopActionBtn}>
                    <Feather name="volume-2" size={12} color={colors.text} />
                    <Text style={mapStyles.stopActionText}>Voice guide</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={mapStyles.stopActionBtn}>
                    <Feather name="navigation" size={12} color={colors.text} />
                    <Text style={mapStyles.stopActionText}>Directions</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Show detail CTA */}
              <TouchableOpacity
                style={mapStyles.detailBtn}
                onPress={() => onClose(active.day.dayNumber)}
              >
                <Text style={mapStyles.detailBtnText}>Show detail</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const [adventure, setAdventure] = useState<AdventureRow | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [mapVisible, setMapVisible] = useState(false);

  useEffect(() => {
    const mock = MOCK_TRIPS.find(m => m.id === id);
    if (mock) { setAdventure(mock); return; }
    getMyAdventures().then(list => {
      setAdventure(list.find(a => a.id === id) ?? null);
    });
  }, [id]);

  if (!adventure) {
    return (
      <View style={[detailStyles.container, { paddingTop: insets.top }]}>
        <TouchableOpacity style={detailStyles.headerBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>
    );
  }

  const sortedDays = [...(adventure.adventure_days ?? [])].sort((a, b) => a.dayNumber - b.dayNumber);
  const meta        = MOCK_TRIP_META[adventure.id] ?? null;
  const actIconName = (ACTIVITY_ICON[adventure.activityType] ?? "map-marker-outline") as React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  const heroUrl     = `https://picsum.photos/seed/${adventure.id}/800/600`;
  const currentDay = sortedDays.find(d => d.dayNumber === selectedDay) ?? sortedDays[0];

  return (
    <View style={[detailStyles.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={detailStyles.header}>
        <TouchableOpacity style={detailStyles.headerBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={detailStyles.headerTitle}>Itinerary</Text>
        <View style={detailStyles.headerRight}>
          <TouchableOpacity style={detailStyles.headerBtn}>
            <Feather name="user-plus" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={detailStyles.headerBtn} onPress={() => setMapVisible(true)}>
            <Feather name="map" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Hero photo ── */}
        <View style={{ height: HERO_H }}>
          <Image source={{ uri: heroUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.78)"]}
            style={StyleSheet.absoluteFill}
          />
          <View style={detailStyles.heroText}>
            <Text style={detailStyles.heroTitle}>{adventure.title}</Text>
            <View style={detailStyles.heroMeta}>
              <Feather name="map-pin" size={12} color="rgba(255,255,255,0.75)" />
              <Text style={detailStyles.heroMetaText}>{adventure.region}</Text>
              <Text style={detailStyles.heroMetaDot}>·</Text>
              <MaterialCommunityIcons name={actIconName} size={14} color="rgba(255,255,255,0.75)" />
              <Text style={detailStyles.heroMetaText}>
                {adventure.activityType.replace(/_/g, " ")}
              </Text>
              <Text style={detailStyles.heroMetaDot}>·</Text>
              <Text style={detailStyles.heroMetaText}>{adventure.durationDays} days</Text>
            </View>
          </View>
        </View>

        {/* ── Day tab strip ── */}
        <View style={detailStyles.dayTabWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={detailStyles.dayTabScroll}
          >
            {sortedDays.map(d => (
              <TouchableOpacity
                key={d.dayNumber}
                style={[
                  detailStyles.dayTab,
                  selectedDay === d.dayNumber && detailStyles.dayTabActive,
                ]}
                onPress={() => setSelectedDay(d.dayNumber)}
              >
                <Text style={[
                  detailStyles.dayTabText,
                  selectedDay === d.dayNumber && detailStyles.dayTabTextActive,
                ]}>
                  Day {d.dayNumber}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Day content ── */}
        {currentDay && (
          <View style={detailStyles.dayContent}>
            {/* Date label */}
            <Text style={detailStyles.dateLabel}>
              {formatDayDate(adventure.startDate, currentDay.dayNumber)}
            </Text>

            {/* Stop */}
            <StopCard
              day={currentDay}
              adventureId={adventure.id}
              stopNumber={currentDay.dayNumber}
              isLast
            />

            {/* Accommodation */}
            {meta && <AccommodationCard meta={meta} adventureId={adventure.id} />}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Map modal ── */}
      <TripMapModal
        visible={mapVisible}
        onClose={(day) => {
          setMapVisible(false);
          if (day != null) setSelectedDay(day);
        }}
        adventure={adventure}
        days={sortedDays}
        meta={meta}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const detailStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: {
    width: 40, height: 40,
    alignItems: "center", justifyContent: "center",
  },
  headerRight: { flexDirection: "row", alignItems: "center" },
  headerTitle: {
    fontSize: fontSize.base,
    fontWeight: "700",
    color: colors.text,
  },
  heroText: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    padding: spacing.md,
    gap: 6,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: fontSize.xxl,
    fontWeight: "800",
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  heroMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
  heroMetaText: { color: "rgba(255,255,255,0.8)", fontSize: fontSize.sm, textTransform: "capitalize" },
  heroMetaDot: { color: "rgba(255,255,255,0.4)", fontSize: fontSize.sm },
  dayTabWrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  dayTabScroll: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  dayTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: "transparent",
  },
  dayTabActive: { backgroundColor: colors.text, borderColor: colors.text },
  dayTabText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.muted },
  dayTabTextActive: { color: colors.inverse },
  dayContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  dateLabel: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
});

const stopStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  timeline: {
    alignItems: "center",
    width: 36,
  },
  circle: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  circleNum: {
    color: colors.inverse,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
  line: {
    flex: 1,
    width: 2,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    borderStyle: "dashed",
    marginTop: 4,
    marginBottom: 4,
    minHeight: 40,
  },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadow.sm,
    marginBottom: spacing.md,
  },
  photo: {
    width: "100%",
    height: 160,
  },
  info: {
    padding: spacing.md,
    gap: 6,
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 20,
  },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
  infoText: { fontSize: fontSize.xs, color: colors.muted, flex: 1, lineHeight: 16 },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginTop: 2 },
  statChip: {
    backgroundColor: colors.sheet,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  statText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "500" },
  actionRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 12,
  },
  actionText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "600" },
  actionDivider: { width: 1, backgroundColor: colors.border, marginVertical: 10 },
});


const mapStyles = StyleSheet.create({
  topBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    zIndex: 10,
  },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomPanel: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.sm,
    ...shadow.lg,
  },
  daySelectorContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  dayPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  dayPillActive: { backgroundColor: colors.text, borderColor: colors.text },
  dayPillText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.muted },
  dayPillTextActive: { color: colors.inverse },
  stopCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  stopPhoto: { width: "100%", height: 100 },
  stopInfo: { padding: spacing.md, gap: 5 },
  stopTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
  stopMetaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  stopMetaText: { fontSize: fontSize.xs, color: colors.muted },
  stopActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  stopActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stopActionText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "600" },
  detailBtn: {
    backgroundColor: colors.text,
    margin: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.full,
    paddingVertical: 13,
    alignItems: "center",
  },
  detailBtnText: {
    color: colors.inverse,
    fontWeight: "700",
    fontSize: fontSize.sm,
  },
  pin: {
    width: 30, height: 30,
    borderRadius: 15,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  pinActive: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    borderColor: "#FFFFFF",
    borderWidth: 3,
  },
  pinNum: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  pinNumActive: {
    fontSize: 14,
  },
});
