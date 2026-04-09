import { useRef, useState } from "react";
import {
  Dimensions, Image, Linking, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { colors, fontSize, radius, shadow, spacing } from "../lib/theme";
import type { RichOption, RichOptionCategory } from "../lib/adventure-types";

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_VISIBLE  = 3;
const LOAD_MORE_COUNT  = 7;
const CARD_WIDTH       = Dimensions.get("window").width - spacing.md * 2 - spacing.lg * 2;
const IMAGE_HEIGHT     = 160;
const IMAGE_COUNT      = 4;

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
}

// ─── Difficulty badge ─────────────────────────────────────────────────────────

const DIFFICULTY_COLOR: Record<string, string> = {
  easy:     "#2E7D32",
  moderate: "#E65100",
  hard:     "#B71C1C",
};

const DIFFICULTY_BG: Record<string, string> = {
  easy:     "#E8F5E9",
  moderate: "#FFF3E0",
  hard:     "#FFEBEE",
};

// ─── Price range display ──────────────────────────────────────────────────────

function priceLabel(price_range?: string, price_per_night?: number | null): string {
  if (price_per_night != null) return `€${price_per_night}/night`;
  if (!price_range) return "";
  const map: Record<string, string> = { budget: "$", mid: "$$", luxury: "$$$" };
  return map[price_range] ?? price_range;
}

function accommodationTypeLabel(type?: string): string {
  if (!type) return "";
  const map: Record<string, string> = {
    camping:   "Camping",
    hostel:    "Hostel",
    hotel:     "Hotel",
    guesthouse:"Guesthouse",
    luxury:    "Luxury",
  };
  return map[type] ?? type;
}

// ─── Single option tile ───────────────────────────────────────────────────────

interface OptionTileProps {
  option: RichOption;
  category: RichOptionCategory;
  onSelect: (title: string) => void;
}

function OptionTile({ option, category, onSelect }: OptionTileProps) {
  const seed = option.image_seed ?? slugify(option.title);
  const scrollRef = useRef<ScrollView>(null);

  function handleVisitSite() {
    const url = option.website_url
      ?? option.thefork_url
      ?? option.google_maps_url
      ?? `https://www.thefork.com/search?q=${encodeURIComponent(option.title)}`;
    Linking.openURL(url);
  }

  return (
    <View style={tileStyles.card}>
      {/* Image carousel */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={tileStyles.carousel}
        contentContainerStyle={{ width: CARD_WIDTH * IMAGE_COUNT }}
      >
        {Array.from({ length: IMAGE_COUNT }).map((_, i) => (
          <Image
            key={i}
            source={{ uri: `https://picsum.photos/seed/${seed}-${i}/400/250` }}
            style={tileStyles.image}
            resizeMode="cover"
          />
        ))}
      </ScrollView>

      {/* Dot indicator */}
      <View style={tileStyles.dotsRow}>
        {Array.from({ length: IMAGE_COUNT }).map((_, i) => (
          <View key={i} style={tileStyles.dot} />
        ))}
      </View>

      {/* Info */}
      <View style={tileStyles.info}>
        <Text style={tileStyles.title} numberOfLines={2}>{option.title}</Text>
        {option.subtitle ? (
          <Text style={tileStyles.subtitle} numberOfLines={1}>{option.subtitle}</Text>
        ) : null}

        {/* Stat chips */}
        <View style={tileStyles.chipsRow}>
          {category === "route" && (
            <>
              {option.distance_km != null && (
                <View style={tileStyles.chip}>
                  <Text style={tileStyles.chipText}>{option.distance_km} km</Text>
                </View>
              )}
              {option.elevation_gain_m != null && (
                <View style={tileStyles.chip}>
                  <Text style={tileStyles.chipText}>↑ {option.elevation_gain_m} m</Text>
                </View>
              )}
              {option.difficulty && (
                <View style={[tileStyles.chip, {
                  backgroundColor: DIFFICULTY_BG[option.difficulty] ?? "#F5F5F5",
                }]}>
                  <Text style={[tileStyles.chipText, {
                    color: DIFFICULTY_COLOR[option.difficulty] ?? colors.text,
                  }]}>
                    {option.difficulty.charAt(0).toUpperCase() + option.difficulty.slice(1)}
                  </Text>
                </View>
              )}
            </>
          )}

          {category === "accommodation" && (
            <>
              {option.accommodation_type && (
                <View style={tileStyles.chip}>
                  <Text style={tileStyles.chipText}>{accommodationTypeLabel(option.accommodation_type)}</Text>
                </View>
              )}
              {(option.price_per_night_eur != null || option.price_range) && (
                <View style={tileStyles.chip}>
                  <Text style={tileStyles.chipText}>
                    {priceLabel(option.price_range, option.price_per_night_eur)}
                  </Text>
                </View>
              )}
            </>
          )}

          {category === "restaurant" && (
            <>
              {option.cuisine && (
                <View style={tileStyles.chip}>
                  <Text style={tileStyles.chipText}>{option.cuisine}</Text>
                </View>
              )}
              {option.price_range && (
                <View style={tileStyles.chip}>
                  <Text style={tileStyles.chipText}>{priceLabel(option.price_range)}</Text>
                </View>
              )}
            </>
          )}
        </View>

        {option.description ? (
          <Text style={tileStyles.description} numberOfLines={2}>{option.description}</Text>
        ) : null}
      </View>

      {/* Action buttons */}
      {category === "restaurant" ? (
        <View style={tileStyles.restaurantBtns}>
          <TouchableOpacity
            style={tileStyles.menuBtn}
            onPress={handleVisitSite}
            activeOpacity={0.8}
          >
            <Text style={tileStyles.menuBtnText}>Visit Site</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={tileStyles.availBtn}
            onPress={() => onSelect("Confirmed restaurant: " + option.title)}
            activeOpacity={0.8}
          >
            <Text style={tileStyles.availBtnText}>Select</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={tileStyles.selectBtn}
          onPress={() => onSelect(option.title)}
          activeOpacity={0.8}
        >
          <Text style={tileStyles.selectBtnText}>Select</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Container ────────────────────────────────────────────────────────────────

interface Props {
  messageId: string;
  category: RichOptionCategory;
  options: RichOption[];
  footer_options?: string[];
  onSelect: (title: string) => void;
}

export function RichOptionTiles({ messageId, category, options, footer_options, onSelect }: Props) {
  const [visible, setVisible] = useState(INITIAL_VISIBLE);

  function loadMore() {
    setVisible(prev => Math.min(prev + LOAD_MORE_COUNT, options.length));
  }

  return (
    <View style={styles.container}>
      {options.slice(0, visible).map((opt, idx) => (
        <OptionTile
          key={`${messageId}-${opt.title}-${idx}`}
          option={opt}
          category={category}
          onSelect={onSelect}
        />
      ))}

      {visible < options.length && (
        <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} activeOpacity={0.7}>
          <Text style={styles.loadMoreText}>Load more</Text>
        </TouchableOpacity>
      )}

      {footer_options && footer_options.length > 0 && (
        <View style={styles.footerRow}>
          {footer_options.map(opt => (
            <TouchableOpacity key={opt} style={styles.footerChip} onPress={() => onSelect(opt)} activeOpacity={0.7}>
              <Text style={styles.footerChipText}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const tileStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  carousel: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
  },
  image: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    paddingTop: spacing.xs,
    paddingBottom: 2,
    backgroundColor: colors.card,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
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
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: -2,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: 2,
  },
  chip: {
    backgroundColor: colors.sheet ?? "#F2F2F2",
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: fontSize.xs,
    color: colors.text,
    fontWeight: "500",
  },
  description: {
    fontSize: fontSize.xs,
    color: colors.muted,
    lineHeight: 16,
    marginTop: 2,
  },
  // Non-restaurant select button
  selectBtn: {
    backgroundColor: colors.text,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    marginTop: 4,
    borderRadius: radius.full,
    paddingVertical: 12,
    alignItems: "center",
  },
  selectBtnText: {
    color: colors.inverse,
    fontSize: fontSize.base,
    fontWeight: "700",
  },
  // Restaurant action buttons
  restaurantBtns: {
    flexDirection: "row",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    marginTop: 4,
  },
  menuBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: radius.full,
    paddingVertical: 12,
    alignItems: "center",
  },
  menuBtnText: {
    color: colors.text,
    fontSize: fontSize.base,
    fontWeight: "700",
  },
  availBtn: {
    flex: 1,
    backgroundColor: colors.text,
    borderRadius: radius.full,
    paddingVertical: 12,
    alignItems: "center",
  },
  availBtnText: {
    color: colors.inverse,
    fontSize: fontSize.base,
    fontWeight: "700",
  },
});

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    gap: 0,
  },
  loadMoreBtn: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  loadMoreText: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text,
  },
  footerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  footerChip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  footerChipText: {
    fontSize: fontSize.sm,
    color: colors.muted,
    fontWeight: "500",
  },
});
