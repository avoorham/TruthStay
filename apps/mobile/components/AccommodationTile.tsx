import {
  Linking, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts, fontSize, radius, spacing, shadow } from "../lib/theme";
import type { AccommodationOption } from "../lib/adventure-types";

const TYPE_CONFIG: Record<string, { icon: string; gradient: [string, string] }> = {
  camping:    { icon: "⛺", gradient: ["#3D7A50", "#1E4D33"] },
  hostel:     { icon: "🛏", gradient: ["#4A7FA5", "#2D5F80"] },
  hotel:      { icon: "🏨", gradient: ["#B08A50", "#7A5C30"] },
  guesthouse: { icon: "🏡", gradient: ["#7B6FA5", "#5A4A80"] },
  luxury:     { icon: "✦", gradient: ["#2C2C2C", "#111111"] },
};

const RATING: Record<string, string> = { budget: "3.8", mid: "4.3", luxury: "4.8" };

const TYPE_LABEL: Record<string, string> = {
  camping: "Campsite",
  hostel: "Hostel",
  hotel: "Hotel",
  guesthouse: "Guesthouse",
  luxury: "Luxury Hotel",
};

interface Props {
  opt: AccommodationOption;
  nightCount: number;
  nightNumbers: number[];
  location: string;
  startDate: string | null;
  adventureId: string | null;
  isSelected: boolean;
  onSelect: () => void;
}

function bookingUrl(params: {
  propertyName: string;
  location: string;
  checkin?: string;
  checkout?: string;
  trackingLabel?: string;
}): string {
  const aid = process.env.EXPO_PUBLIC_BOOKING_AFFILIATE_ID;
  const p = new URLSearchParams({
    ss: `${params.propertyName} ${params.location}`,
    group_adults: "1",
    no_rooms: "1",
  });
  if (aid) p.set("aid", aid);
  if (params.trackingLabel) p.set("label", params.trackingLabel);
  if (params.checkin) p.set("checkin", params.checkin);
  if (params.checkout) p.set("checkout", params.checkout);
  return `https://www.booking.com/searchresults.html?${p.toString()}`;
}

function offsetDate(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function AccommodationTile({
  opt, nightCount, nightNumbers, location, startDate, adventureId, isSelected, onSelect,
}: Props) {
  const config = TYPE_CONFIG[opt.type] ?? TYPE_CONFIG.hotel;
  const rating = RATING[opt.price_range] ?? "4.2";

  const checkin = startDate && nightNumbers.length > 0
    ? offsetDate(startDate, (nightNumbers[0] ?? 1) - 1) : undefined;
  const checkout = startDate && nightNumbers.length > 0
    ? offsetDate(startDate, nightNumbers[nightNumbers.length - 1] ?? 1) : undefined;
  const trackingLabel = adventureId ? `adventure-${adventureId}` : undefined;

  const handleBook = () => {
    const url = bookingUrl({ propertyName: opt.name, location, checkin, checkout, trackingLabel });
    Linking.openURL(url);
  };

  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={onSelect}
      activeOpacity={0.88}
    >
      {/* Left: photo placeholder */}
      <View style={styles.imageWrap}>
        <LinearGradient
          colors={config.gradient}
          style={styles.imagePlaceholder}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.typeIcon}>{config.icon}</Text>
        </LinearGradient>

        {/* Rating badge */}
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>★ {rating}</Text>
        </View>

        {/* Selected checkmark overlay */}
        {isSelected && (
          <View style={styles.selectedOverlay}>
            <View style={styles.checkCircle}>
              <Text style={styles.checkMark}>✓</Text>
            </View>
          </View>
        )}
      </View>

      {/* Right: content */}
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{opt.name}</Text>
        </View>

        <Text style={styles.type}>{TYPE_LABEL[opt.type] ?? opt.type}</Text>
        <Text style={styles.desc} numberOfLines={2}>{opt.description}</Text>

        <View style={styles.locationRow}>
          <Text style={styles.locationDot}>📍</Text>
          <Text style={styles.locationText} numberOfLines={1}>{location}</Text>
        </View>

        <View style={styles.footer}>
          <View>
            <Text style={styles.fromLabel}>From</Text>
            {opt.price_per_night_eur ? (
              <Text style={styles.price}>
                €{opt.price_per_night_eur}
                <Text style={styles.priceUnit}> /Night</Text>
              </Text>
            ) : (
              <Text style={styles.price}>On request</Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.bookBtn}
            onPress={(e) => { e.stopPropagation?.(); handleBook(); }}
            activeOpacity={0.8}
          >
            <Text style={styles.bookText}>Book →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const IMG_WIDTH = 110;

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadow.sm,
  },
  cardSelected: {
    borderColor: colors.accent,
    borderWidth: 2,
  },

  // ── Image block ──────────────────────────────────────────────────────────────
  imageWrap: {
    width: IMG_WIDTH,
    position: "relative",
  },
  imagePlaceholder: {
    width: IMG_WIDTH,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 130,
  },
  typeIcon: {
    fontSize: 32,
  },
  ratingBadge: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingText: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize.xs,
    color: "#FFD700",
  },
  selectedOverlay: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: colors.inverse,
  },

  // ── Content ──────────────────────────────────────────────────────────────────
  content: {
    flex: 1,
    padding: spacing.sm + 2,
    gap: 3,
    justifyContent: "space-between",
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  name: {
    fontFamily: fonts.display,
    fontSize: fontSize.sm,
    color: colors.text,
    flex: 1,
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  type: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 1,
  },
  desc: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    color: colors.muted,
    lineHeight: 16,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  locationDot: { fontSize: 10 },
  locationText: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    color: colors.muted,
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: spacing.xs,
  },
  fromLabel: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs - 1,
    color: colors.muted,
    lineHeight: 14,
  },
  price: {
    fontFamily: fonts.display,
    fontSize: fontSize.base,
    color: colors.text,
    lineHeight: 20,
  },
  priceUnit: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  bookBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  bookText: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize.xs,
    color: colors.inverse,
  },
});
