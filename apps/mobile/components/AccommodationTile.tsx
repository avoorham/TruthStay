import {
  Linking, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { colors, fontSize, radius, spacing, shadow } from "../lib/theme";
import type { AccommodationOption } from "../lib/adventure-types";

const TYPE_EMOJI: Record<string, string> = {
  camping: "⛺",
  hostel: "🛏️",
  hotel: "🏨",
  guesthouse: "🏡",
  luxury: "🏰",
};

const PRICE_STARS: Record<string, number> = { budget: 2, mid: 3, luxury: 5 };

function StarRating({ count }: { count: number }) {
  return (
    <View style={styles.stars}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Text key={i} style={[styles.star, i < count && styles.starFilled]}>★</Text>
      ))}
    </View>
  );
}

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
  const stars = PRICE_STARS[opt.price_range] ?? 3;
  const emoji = TYPE_EMOJI[opt.type] ?? "🏨";
  const totalEur = opt.price_per_night_eur ? opt.price_per_night_eur * nightCount : null;

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
      activeOpacity={0.85}
    >
      {/* Left: coloured icon block */}
      <View style={[styles.imageBlock, isSelected && styles.imageBlockSelected]}>
        <Text style={styles.typeEmoji}>{emoji}</Text>
        <StarRating count={stars} />
      </View>

      {/* Right: info */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{opt.name}</Text>
          {isSelected && (
            <View style={styles.checkCircle}>
              <Text style={styles.checkMark}>✓</Text>
            </View>
          )}
        </View>

        <Text style={styles.type}>{opt.type.charAt(0).toUpperCase() + opt.type.slice(1)}</Text>
        <Text style={styles.desc} numberOfLines={2}>{opt.description}</Text>

        <View style={styles.bottomRow}>
          {opt.price_per_night_eur ? (
            <View>
              <Text style={styles.price}>€{opt.price_per_night_eur}<Text style={styles.priceUnit}>/night</Text></Text>
              {nightCount > 1 && totalEur && (
                <Text style={styles.total}>€{totalEur} total</Text>
              )}
            </View>
          ) : (
            <Text style={styles.priceUnit}>Price on request</Text>
          )}

          <TouchableOpacity style={styles.bookBtn} onPress={handleBook} activeOpacity={0.8}>
            <Text style={styles.bookText}>Book →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

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
    borderColor: colors.text,
  },
  imageBlock: {
    width: 80,
    backgroundColor: colors.sheet,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    padding: spacing.sm,
  },
  imageBlockSelected: {
    backgroundColor: colors.accentLight,
  },
  typeEmoji: { fontSize: 28 },
  stars: { flexDirection: "row" },
  star: { fontSize: 9, color: colors.border },
  starFilled: { color: "#F59E0B" },
  info: {
    flex: 1,
    padding: spacing.md,
    gap: 3,
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.xs,
  },
  checkMark: { fontSize: 10, color: colors.inverse, fontWeight: "700" },
  type: { fontSize: fontSize.xs, color: colors.muted },
  desc: { fontSize: fontSize.xs, color: colors.muted, lineHeight: 17 },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: spacing.xs,
  },
  price: {
    fontSize: fontSize.base,
    fontWeight: "800",
    color: colors.text,
  },
  priceUnit: { fontSize: fontSize.xs, color: colors.muted, fontWeight: "400" },
  total: { fontSize: fontSize.xs, color: colors.muted },
  bookBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 1,
  },
  bookText: { fontSize: fontSize.xs, color: colors.inverse, fontWeight: "700" },
});
