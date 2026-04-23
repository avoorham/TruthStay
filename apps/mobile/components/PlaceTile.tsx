import {
  Animated, Dimensions, Image, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { Feather } from "@expo/vector-icons";
import type { PlaceSuggestion } from "../lib/adventure-types";
import { colors, fonts, fontSize, radius, shadow, spacing } from "../lib/theme";

const CARD_WIDTH   = Dimensions.get("window").width - spacing.md * 2;
const PHOTO_HEIGHT = 180;

// ─── Skeleton shimmer ─────────────────────────────────────────────────────────

function SkeletonBlock({ widthPct, height }: { widthPct: number; height: number }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);
  return (
    <Animated.View
      style={{
        width: CARD_WIDTH * widthPct,
        height,
        borderRadius: radius.sm,
        backgroundColor: colors.border,
        opacity: anim,
        marginBottom: 8,
      }}
    />
  );
}

// ─── Picsum-based place images (deterministic seed per place) ─────────────────

function placeImages(name: string, country?: string): string[] {
  const slug = `${name}${country ? `-${country}` : ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-");
  return [
    `https://picsum.photos/seed/${slug}-a/800/500`,
    `https://picsum.photos/seed/${slug}-b/800/500`,
    `https://picsum.photos/seed/${slug}-c/800/500`,
  ];
}

// ─── PlaceTile ────────────────────────────────────────────────────────────────

interface PlaceTileProps {
  place: PlaceSuggestion;
  selected: boolean;
  onToggle: () => void;
  loading?: boolean;
}

export function PlaceTile({ place, selected, onToggle, loading = false }: PlaceTileProps) {
  const [page, setPage] = useState(0);
  const images = place.images.length > 0 ? place.images : placeImages(place.name, place.country);

  return (
    <View style={[styles.card, selected ? styles.cardSelected : styles.cardDefault]}>
      {/* ── Photo carousel ────────────────────────────────────────────────── */}
      <View style={styles.carouselWrapper}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          style={styles.carousel}
          onScroll={e =>
            setPage(Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH))
          }
        >
          {images.map((uri, i) => (
            <Image key={i} source={{ uri }} style={styles.photo} resizeMode="cover" />
          ))}
        </ScrollView>

        {/* Dot indicators */}
        <View style={styles.dots}>
          {images.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>

        {/* Add / remove button */}
        <TouchableOpacity style={styles.addBtn} onPress={onToggle} activeOpacity={0.8}>
          <Feather name={selected ? "x" : "plus"} size={14} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Info section ──────────────────────────────────────────────────── */}
      <View style={styles.info}>
        {loading ? (
          <>
            <SkeletonBlock widthPct={0.55} height={18} />
            <SkeletonBlock widthPct={0.75} height={12} />
            <SkeletonBlock widthPct={0.45} height={12} />
          </>
        ) : (
          <>
            {/* Place name */}
            <Text style={styles.placeName}>
              {place.name}{place.country ? ` · ${place.country}` : ""}
            </Text>

            {/* Rating + weather */}
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>
                {place.rating !== undefined
                  ? `★ ${place.rating.toFixed(1)}${place.ratingCount ? `  (${place.ratingCount} TruthStayer${place.ratingCount !== 1 ? "s" : ""})` : ""}`
                  : "New destination"}
              </Text>
              {place.weather ? (
                <Text style={styles.weatherText}>
                  {place.weather.icon}  {place.weather.tempC}°C · {place.weather.description}
                </Text>
              ) : null}
            </View>

            {/* Key highlights */}
            {place.highlights.length > 0 && (
              <View style={styles.highlightsSection}>
                <Text style={styles.highlightsLabel}>KEY HIGHLIGHTS</Text>
                <View style={styles.chips}>
                  {place.highlights.slice(0, 4).map(h => (
                    <View key={h} style={styles.chip}>
                      <Text style={styles.chipText}>{h}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Summary */}
            {!!place.summary && (
              <Text style={styles.summary} numberOfLines={2}>{place.summary}</Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.card,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  cardDefault: {
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: colors.accent,
  },

  carouselWrapper: {
    height: PHOTO_HEIGHT,
  },
  carousel: {
    width: CARD_WIDTH,
    height: PHOTO_HEIGHT,
  },
  photo: {
    width: CARD_WIDTH,
    height: PHOTO_HEIGHT,
  },

  dots: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  dotActive: {
    backgroundColor: "#fff",
  },

  addBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  info: {
    padding: spacing.md,
  },
  placeName: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.text,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 10,
  },
  metaText: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  weatherText: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
  },

  highlightsSection: {
    marginBottom: 10,
  },
  highlightsLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.accent + "18",
    borderWidth: 1,
    borderColor: colors.accent + "40",
  },
  chipText: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.accent,
  },

  summary: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
    lineHeight: 20,
    fontStyle: "italic",
  },
});