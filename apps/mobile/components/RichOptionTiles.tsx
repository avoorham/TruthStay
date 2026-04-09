import { useState } from "react";
import {
  Dimensions, Image, Linking, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { colors, fontSize, radius, shadow, spacing } from "../lib/theme";
import type { RichOption, RichOptionCategory } from "../lib/adventure-types";

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_VISIBLE  = 3;
const LOAD_MORE_COUNT  = 7;
const CARD_WIDTH       = Dimensions.get("window").width - spacing.md * 2;
const IMAGE_HEIGHT     = 160;

// ─── Activity-type image IDs (picsum numeric IDs — consistent, pre-vetted) ───

const ROUTE_IMAGE_ID: Record<string, number> = {
  cycling:       10,
  road_cycling:  10,
  gravel:        10,
  mtb:           200,
  hiking:        15,
  trail_running: 39,
  climbing:      36,
  skiing:        102,
  kayaking:      129,
};

const ACCOMMODATION_IMAGE_ID: Record<string, number> = {
  camping:    202,
  hostel:     305,
  hotel:      219,
  guesthouse: 164,
  luxury:     118,
};

function cardImageUri(
  category: RichOptionCategory,
  activityType: string | undefined,
  accommodationType: string | undefined,
  seed: string,
): string {
  if (category === "route") {
    const id = ROUTE_IMAGE_ID[activityType ?? ""] ?? 11;
    return `https://picsum.photos/id/${id}/800/400`;
  }
  if (category === "accommodation") {
    const id = ACCOMMODATION_IMAGE_ID[accommodationType ?? ""] ?? 219;
    return `https://picsum.photos/id/${id}/800/400`;
  }
  // restaurant — seed-based for variety
  return `https://picsum.photos/seed/${seed}/800/400`;
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
  activityType?: string;
  disabled?: boolean;
  onSelect: (title: string) => void;
}

function OptionTile({ option, category, activityType, disabled, onSelect }: OptionTileProps) {
  const seed = option.image_seed ?? option.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const imageUri = cardImageUri(category, activityType, option.accommodation_type, seed);

  function handleVisitSite() {
    const url = option.website_url
      ?? option.thefork_url
      ?? option.google_maps_url
      ?? `https://www.thefork.com/search?q=${encodeURIComponent(option.title)}`;
    Linking.openURL(url);
  }

  return (
    <View style={tileStyles.card}>
      {/* Single hero image */}
      <Image
        source={{ uri: imageUri }}
        style={tileStyles.image}
        resizeMode="cover"
      />

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

        {/* Komoot link for routes */}
        {category === "route" && option.komoot_url ? (
          <TouchableOpacity onPress={() => Linking.openURL(option.komoot_url!)} activeOpacity={0.7}>
            <Text style={tileStyles.komootLink}>View on Komoot →</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Action buttons */}
      {category === "restaurant" ? (
        <View style={tileStyles.restaurantBtns}>
          <TouchableOpacity
            style={tileStyles.menuBtn}
            onPress={handleVisitSite}
            activeOpacity={0.8}
            disabled={disabled}
          >
            <Text style={tileStyles.menuBtnText}>Visit Site</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[tileStyles.availBtn, disabled && tileStyles.btnDisabled]}
            onPress={() => !disabled && onSelect("Confirmed restaurant: " + option.title)}
            activeOpacity={0.8}
            disabled={disabled}
          >
            <Text style={tileStyles.availBtnText}>Select</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[tileStyles.selectBtn, disabled && tileStyles.btnDisabled]}
          onPress={() => !disabled && onSelect(option.title)}
          activeOpacity={0.8}
          disabled={disabled}
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
  activityType?: string;
  options: RichOption[];
  footer_options?: string[];
  disabled?: boolean;
  onSelect: (title: string) => void;
}

export function RichOptionTiles({ messageId, category, activityType, options, footer_options, disabled, onSelect }: Props) {
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
          activityType={activityType}
          disabled={disabled}
          onSelect={onSelect}
        />
      ))}

      {visible < options.length && (
        <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} activeOpacity={0.7} disabled={disabled}>
          <Text style={styles.loadMoreText}>Load more</Text>
        </TouchableOpacity>
      )}

      {footer_options && footer_options.length > 0 && (
        <View style={styles.footerRow}>
          {footer_options.map(opt => (
            <TouchableOpacity
              key={opt}
              style={[styles.footerChip, disabled && styles.footerChipDisabled]}
              onPress={() => !disabled && onSelect(opt)}
              activeOpacity={0.7}
              disabled={disabled}
            >
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
  image: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
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
  komootLink: {
    fontSize: fontSize.xs,
    color: "#2E7D32",
    fontWeight: "600",
    marginTop: 2,
  },
  btnDisabled: {
    opacity: 0.4,
  },
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
  footerChipDisabled: {
    opacity: 0.4,
  },
  footerChipText: {
    fontSize: fontSize.sm,
    color: colors.muted,
    fontWeight: "500",
  },
});
