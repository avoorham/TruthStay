import React, {
  useEffect, useRef, useState,
} from "react";
import {
  Animated, Dimensions, Image, Keyboard, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import MapboxGL from "@rnmapbox/maps";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { getMyAdventures, type AdventureRow, type AdventureDayRow } from "../../../lib/api";
import {
  MOCK_TRIPS, MOCK_TRIP_META, type TripMeta, type RestaurantStop, type Booking,
} from "../../../lib/mock-trips";
import {
  MOCK_COLLABORATORS, MOCK_USERS, searchUsers,
  type MockUser, type Permission, type Collaborator,
} from "../../../lib/mock-users";
import { colors, fontSize, radius, spacing, shadow } from "../../../lib/theme";

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");

const SCREEN_H = Dimensions.get("window").height;
const HERO_H   = Math.round(SCREEN_H * 0.3);

// ─── Activity icon map ────────────────────────────────────────────────────────

const ACTIVITY_ICON: Record<string, string> = {
  cycling: "bike", road_cycling: "bike-fast", mtb: "bike-fast",
  hiking: "hiking", trail_running: "run", climbing: "carabiner",
  skiing: "ski", kayaking: "kayaking", gravel: "bike",
  bikepacking: "bike", other: "map-marker-outline",
};

// ─── Pin colours ──────────────────────────────────────────────────────────────

const PIN_COLORS = {
  activity:      colors.text,
  accommodation: colors.accent,
  restaurant:    "#E07B39",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDayDate(startDate: string | null, dayNumber: number): string {
  if (!startDate) return `Day ${dayNumber}`;
  const d = new Date(startDate);
  d.setDate(d.getDate() + dayNumber - 1);
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function stopCoords(meta: TripMeta | null, dayNumber: number, totalDays: number): [number, number] {
  if (meta?.dayCoords?.[dayNumber]) return meta.dayCoords[dayNumber];
  const base = meta?.coords ?? [0, 0];
  const spread = 0.03;
  const angle = (dayNumber / Math.max(totalDays, 1)) * Math.PI;
  return [
    base[0] + Math.cos(angle) * spread * (dayNumber * 0.5),
    base[1] + Math.sin(angle) * spread * (dayNumber * 0.5),
  ];
}

const BOOKING_ICON: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  flight: "send", hotel: "home", train: "map", car: "settings", activity: "star",
};

// ─── Review section ───────────────────────────────────────────────────────────

interface Review { rating: number; comment: string }

function ReviewSection({
  review, onRate, onComment,
}: { review: Review; onRate: (r: number) => void; onComment: (c: string) => void }) {
  return (
    <View style={reviewStyles.container}>
      {/* Star row */}
      <View style={reviewStyles.starRow}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity key={n} onPress={() => onRate(n)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <MaterialCommunityIcons
              name={n <= review.rating ? "star" : "star-outline"}
              size={22}
              color={n <= review.rating ? "#F59E0B" : colors.border}
            />
          </TouchableOpacity>
        ))}
        {review.rating > 0 && (
          <Text style={reviewStyles.ratingLabel}>{review.rating}.0</Text>
        )}
      </View>
      {/* Comment */}
      <TextInput
        style={reviewStyles.commentInput}
        value={review.comment}
        onChangeText={onComment}
        placeholder="Add a note about this stop…"
        placeholderTextColor={colors.subtle}
        multiline
      />
      {/* Add photo CTA */}
      <TouchableOpacity style={reviewStyles.photoBtn}>
        <Feather name="camera" size={14} color={colors.accent} />
        <Text style={reviewStyles.photoBtnText}>Add photo</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Invite friends modal ─────────────────────────────────────────────────────

const PERMISSIONS: Permission[] = ["Editor", "Suggest edits", "Viewer"];

function PermissionPicker({
  current, onSelect, onRemove, onClose,
}: {
  current: Permission;
  onSelect: (p: Permission) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={invStyles.pickerOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={invStyles.pickerCard}>
            {PERMISSIONS.map(p => (
              <TouchableOpacity
                key={p}
                style={invStyles.pickerRow}
                onPress={() => { onSelect(p); onClose(); }}
              >
                <Text style={[invStyles.pickerOption, p === current && invStyles.pickerOptionActive]}>{p}</Text>
                {p === current && <Feather name="check" size={14} color={colors.accent} />}
              </TouchableOpacity>
            ))}
            <View style={invStyles.pickerDivider} />
            <TouchableOpacity
              style={invStyles.pickerRow}
              onPress={() => { onRemove(); onClose(); }}
            >
              <Text style={invStyles.pickerRemove}>Remove</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function CollaboratorRow({
  collab, onChangeRole, onRemove,
}: {
  collab: Collaborator;
  onChangeRole: (p: Permission) => void;
  onRemove: () => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const isOwner = collab.role === "owner";

  return (
    <View style={invStyles.collabRow}>
      <Image
        source={{ uri: `https://picsum.photos/seed/${collab.user.id}/80/80` }}
        style={invStyles.collabAvatar}
      />
      <View style={invStyles.collabInfo}>
        <Text style={invStyles.collabName}>{collab.user.name}</Text>
        <Text style={invStyles.collabUsername}>@{collab.user.username}</Text>
      </View>
      {isOwner ? (
        <View style={invStyles.ownerBadge}>
          <Text style={invStyles.ownerText}>Owner</Text>
        </View>
      ) : (
        <>
          <TouchableOpacity style={invStyles.permBtn} onPress={() => setShowPicker(true)}>
            <Text style={invStyles.permBtnText}>{collab.role}</Text>
            <Feather name="chevron-down" size={12} color={colors.muted} />
          </TouchableOpacity>
          {showPicker && (
            <PermissionPicker
              current={collab.role as Permission}
              onSelect={onChangeRole}
              onRemove={onRemove}
              onClose={() => setShowPicker(false)}
            />
          )}
        </>
      )}
    </View>
  );
}

function isValidEmail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
}

function InviteFriendsModal({
  visible, onClose, adventure,
}: { visible: boolean; onClose: () => void; adventure: AdventureRow }) {
  const [showQR, setShowQR] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selected, setSelected] = useState<MockUser[]>([]);
  const [collabs, setCollabs] = useState<Collaborator[]>(
    MOCK_COLLABORATORS[adventure.id] ?? [{ user: { id: "me", username: "you", name: "You" }, role: "owner" }],
  );
  const [inviteSent, setInviteSent] = useState(false);
  const [toast, setToast] = useState("");
  const kbOffset = useRef(new Animated.Value(0)).current;

  // Smooth keyboard lift via Animated — avoids the shake that KeyboardAvoidingView causes
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      e => Animated.timing(kbOffset, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === "ios" ? (e.duration ?? 250) : 200,
        useNativeDriver: false,
      }).start(),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => Animated.timing(kbOffset, { toValue: 0, duration: 200, useNativeDriver: false }).start(),
    );
    return () => { show.remove(); hide.remove(); };
  }, [kbOffset]);

  // Reset offset when modal closes
  useEffect(() => { if (!visible) kbOffset.setValue(0); }, [visible, kbOffset]);

  // Reset "Invite sent" as soon as user types again
  useEffect(() => {
    if (searchText.length > 0) setInviteSent(false);
  }, [searchText]);

  const excludeIds = [
    ...collabs.map(c => c.user.id),
    ...selected.map(u => u.id),
  ];
  const suggestions = searchUsers(searchText, excludeIds);
  const canInvite = selected.length > 0 || isValidEmail(searchText);
  const inviteCode = `TRIP-${adventure.id.toUpperCase()}`;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  }

  function handleInvite() {
    if (!canInvite) return;
    const newCollabs: Collaborator[] = selected.map(u => ({ user: u, role: "Viewer" as Permission }));
    if (newCollabs.length > 0) setCollabs(prev => [...prev, ...newCollabs]);
    setSelected([]);
    setSearchText("");
    setInviteSent(true);
  }

  function handleClose() {
    Keyboard.dismiss();
    setShowQR(false);
    setSearchText("");
    setSelected([]);
    setInviteSent(false);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />

        <Animated.View style={{ marginBottom: kbOffset }}>
          <View style={invStyles.sheet}>
            <View style={invStyles.handle} />

            {showQR ? (
              /* ── QR view ─────────────────────────────────────────────── */
              <>
                <View style={invStyles.headerRow}>
                  <View>
                    <Text style={invStyles.title}>Invite to Trip</Text>
                    <Text style={invStyles.subtitle}>Scan this QR code to join the trip instantly.</Text>
                  </View>
                  <TouchableOpacity style={invStyles.iconBtn} onPress={() => setShowQR(false)}>
                    <Feather name="link" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <View style={invStyles.qrBox}>
                  <View style={invStyles.qrPlaceholder}>
                    <MaterialCommunityIcons name="qrcode" size={120} color={colors.text} />
                  </View>
                </View>

                <View style={invStyles.orRow}>
                  <View style={invStyles.orLine} />
                  <Text style={invStyles.orText}>or enter the invite code manually</Text>
                  <View style={invStyles.orLine} />
                </View>

                <View style={invStyles.codeRow}>
                  <Text style={invStyles.codeText}>{inviteCode}</Text>
                  <TouchableOpacity onPress={() => showToast("Code copied!")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="copy" size={16} color={colors.muted} />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* ── Share sheet ─────────────────────────────────────────── */
              <>
                {/* Scrollable content: header, trip card, divider, search field */}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  style={{ flexShrink: 1 }}
                >
                  <View style={invStyles.headerRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={invStyles.title}>Share trip itinerary</Text>
                      <Text style={invStyles.subtitle}>
                        Give your friends access to this trip and start collaborating in real time.
                      </Text>
                    </View>
                    <TouchableOpacity style={invStyles.iconBtn} onPress={() => setShowQR(true)}>
                      <MaterialCommunityIcons name="qrcode" size={20} color={colors.text} />
                    </TouchableOpacity>
                  </View>

                  {/* Trip card */}
                  <View style={invStyles.tripCard}>
                    <View style={invStyles.tripCardTop}>
                      <View style={invStyles.tripIconCircle}>
                        <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={invStyles.tripCardTitle} numberOfLines={1}>{adventure.title}</Text>
                        <Text style={invStyles.tripCardSub}>{collabs.length} Friend{collabs.length !== 1 ? "s" : ""}</Text>
                      </View>
                      <TouchableOpacity style={invStyles.copyLinkBtn} onPress={() => showToast("Link copied!")}>
                        <Feather name="copy" size={13} color={colors.text} />
                        <Text style={invStyles.copyLinkText}>Copy link</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Friends list */}
                    <View style={invStyles.friendsBox}>
                      <Text style={invStyles.friendsLabel}>Friends</Text>
                      {collabs.map((c, i) => (
                        <CollaboratorRow
                          key={c.user.id + i}
                          collab={c}
                          onChangeRole={p => setCollabs(prev =>
                            prev.map((x, xi) => xi === i ? { ...x, role: p } : x),
                          )}
                          onRemove={() => setCollabs(prev => prev.filter((_, xi) => xi !== i))}
                        />
                      ))}
                    </View>
                  </View>

                  {/* Divider */}
                  <View style={invStyles.orRow}>
                    <View style={invStyles.orLine} />
                    <Text style={invStyles.orText}>or</Text>
                    <View style={invStyles.orLine} />
                  </View>

                </ScrollView>

                {/* Search field — outside ScrollView so it's always visible */}
                <View style={invStyles.searchWrap}>
                  <Feather name="search" size={15} color={colors.muted} style={{ marginRight: 6 }} />
                  <TextInput
                    style={invStyles.searchInput}
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Write username or email…"
                    placeholderTextColor={colors.subtle}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {/* Suggestions — outside ScrollView so they're always visible above keyboard */}
                {suggestions.length > 0 && (
                  <View style={invStyles.suggestionList}>
                    {suggestions.slice(0, 2).map(u => (
                      <TouchableOpacity
                        key={u.id}
                        style={invStyles.suggestionRow}
                        onPress={() => { setSelected(prev => [...prev, u]); setSearchText(""); }}
                      >
                        <Image
                          source={{ uri: `https://picsum.photos/seed/${u.id}/80/80` }}
                          style={invStyles.suggestionAvatar}
                        />
                        <View>
                          <Text style={invStyles.suggestionName}>{u.name}</Text>
                          <Text style={invStyles.suggestionUsername}>@{u.username}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Selected chips — outside ScrollView so they stay visible */}
                {selected.length > 0 && (
                  <View style={invStyles.chipRow}>
                    {selected.map(u => (
                      <TouchableOpacity
                        key={u.id}
                        style={invStyles.chip}
                        onPress={() => setSelected(prev => prev.filter(x => x.id !== u.id))}
                      >
                        <Text style={invStyles.chipText}>{u.name}</Text>
                        <Feather name="x" size={12} color={colors.muted} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Pinned invite button */}
                <TouchableOpacity
                  style={[invStyles.inviteBtn, !canInvite && invStyles.inviteBtnDisabled]}
                  onPress={handleInvite}
                  disabled={!canInvite}
                >
                  <Text style={invStyles.inviteBtnText}>{inviteSent ? "Invite sent" : "Invite"}</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Toast */}
            {toast !== "" && (
              <View style={invStyles.toast} pointerEvents="none">
                <Text style={invStyles.toastText}>{toast}</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Route connect modal ──────────────────────────────────────────────────────

function RouteConnectModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [url, setUrl] = useState("");
  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={rcStyles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={rcStyles.sheet}>
        <View style={rcStyles.handle} />
        <Text style={rcStyles.title}>Connect a route</Text>
        <Text style={rcStyles.sub}>Paste a link from Komoot, Strava, Garmin Connect, or any GPX source.</Text>
        <TextInput
          style={rcStyles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="https://www.komoot.com/tour/…"
          placeholderTextColor={colors.subtle}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={rcStyles.btnRow}>
          <TouchableOpacity style={rcStyles.cancelBtn} onPress={onClose}>
            <Text style={rcStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[rcStyles.connectBtn, !url && rcStyles.connectBtnDisabled]}
            onPress={() => { /* handle connect */ onClose(); setUrl(""); }}
          >
            <Text style={rcStyles.connectText}>Connect</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Stop card ────────────────────────────────────────────────────────────────

function StopCard({
  day, adventureId, stopNumber, isLast, review, onRate, onComment, onConnectRoute,
}: {
  day: AdventureDayRow;
  adventureId: string;
  stopNumber: number;
  isLast: boolean;
  review: Review;
  onRate: (r: number) => void;
  onComment: (c: string) => void;
  onConnectRoute: () => void;
}) {
  const photoUrl = `https://picsum.photos/seed/${adventureId}-${day.dayNumber}/800/500`;
  return (
    <View style={tileStyles.row}>
      <View style={tileStyles.timeline}>
        <View style={tileStyles.circle}>
          <Text style={tileStyles.circleNum}>{stopNumber}</Text>
        </View>
        {!isLast && <View style={tileStyles.line} />}
      </View>

      <View style={tileStyles.card}>
        <Image source={{ uri: photoUrl }} style={tileStyles.photo} resizeMode="cover" />
        <View style={tileStyles.info}>
          <Text style={tileStyles.title} numberOfLines={2}>{day.title}</Text>
          {day.routeNotes ? (
            <View style={tileStyles.infoRow}>
              <Feather name="map-pin" size={11} color={colors.muted} />
              <Text style={tileStyles.infoText} numberOfLines={2}>{day.routeNotes}</Text>
            </View>
          ) : null}
          <View style={tileStyles.infoRow}>
            <Feather name="tag" size={11} color={colors.muted} />
            <Text style={tileStyles.infoText}>Free</Text>
          </View>
          {(day.distanceKm || day.elevationGainM) ? (
            <View style={tileStyles.statsRow}>
              {day.distanceKm ? <View style={tileStyles.statChip}><Text style={tileStyles.statText}>{day.distanceKm} km</Text></View> : null}
              {day.elevationGainM ? <View style={tileStyles.statChip}><Text style={tileStyles.statText}>↑ {day.elevationGainM} m</Text></View> : null}
            </View>
          ) : null}
        </View>

        {/* Action buttons */}
        <View style={tileStyles.actionRow}>
          <TouchableOpacity style={tileStyles.actionBtn}>
            <Feather name="volume-2" size={13} color={colors.text} />
            <Text style={tileStyles.actionText}>Voice guide</Text>
          </TouchableOpacity>
          <View style={tileStyles.actionDivider} />
          <TouchableOpacity style={tileStyles.actionBtn}>
            <Feather name="navigation" size={13} color={colors.text} />
            <Text style={tileStyles.actionText}>Directions</Text>
          </TouchableOpacity>
          <View style={tileStyles.actionDivider} />
          <TouchableOpacity style={tileStyles.actionBtn} onPress={onConnectRoute}>
            <MaterialCommunityIcons name="routes" size={14} color={colors.text} />
            <Text style={tileStyles.actionText}>Route</Text>
          </TouchableOpacity>
        </View>

        {/* Review section */}
        <ReviewSection review={review} onRate={onRate} onComment={onComment} />
      </View>
    </View>
  );
}

// ─── Accommodation tile ───────────────────────────────────────────────────────

function AccommodationCard({ meta, adventureId }: { meta: TripMeta; adventureId: string }) {
  const photoUrl = `https://picsum.photos/seed/${adventureId}-accom/800/500`;
  return (
    <View style={tileStyles.row}>
      <View style={tileStyles.timeline}>
        <View style={[tileStyles.circle, { backgroundColor: PIN_COLORS.accommodation }]}>
          <Feather name="home" size={14} color="#FFFFFF" />
        </View>
      </View>
      <View style={tileStyles.card}>
        <Image source={{ uri: photoUrl }} style={tileStyles.photo} resizeMode="cover" />
        <View style={tileStyles.info}>
          <Text style={tileStyles.title}>{meta.accommodation}</Text>
          <View style={tileStyles.infoRow}>
            <Feather name="moon" size={11} color={colors.muted} />
            <Text style={tileStyles.infoText}>{meta.nights}</Text>
          </View>
          <View style={tileStyles.infoRow}>
            <Feather name="tag" size={11} color={colors.muted} />
            <Text style={tileStyles.infoText}>From €{meta.pricePerNight}/night</Text>
          </View>
        </View>
        <View style={tileStyles.actionRow}>
          <TouchableOpacity style={tileStyles.actionBtn}>
            <Feather name="info" size={13} color={colors.text} />
            <Text style={tileStyles.actionText}>View details</Text>
          </TouchableOpacity>
          <View style={tileStyles.actionDivider} />
          <TouchableOpacity style={tileStyles.actionBtn}>
            <Feather name="external-link" size={13} color={colors.text} />
            <Text style={tileStyles.actionText}>Book</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Restaurant tile ──────────────────────────────────────────────────────────

function RestaurantCard({ restaurant, adventureId, idx }: { restaurant: RestaurantStop; adventureId: string; idx: number }) {
  const photoUrl = `https://picsum.photos/seed/${adventureId}-rest${idx}/800/500`;
  return (
    <View style={tileStyles.row}>
      <View style={tileStyles.timeline}>
        <View style={[tileStyles.circle, { backgroundColor: PIN_COLORS.restaurant }]}>
          <MaterialCommunityIcons name="silverware-fork-knife" size={14} color="#FFFFFF" />
        </View>
      </View>
      <View style={tileStyles.card}>
        <Image source={{ uri: photoUrl }} style={tileStyles.photo} resizeMode="cover" />
        <View style={tileStyles.info}>
          <Text style={tileStyles.title}>{restaurant.name}</Text>
          <View style={tileStyles.infoRow}>
            <MaterialCommunityIcons name="food" size={11} color={colors.muted} />
            <Text style={tileStyles.infoText}>{restaurant.cuisine}</Text>
          </View>
          <View style={tileStyles.infoRow}>
            <Feather name="tag" size={11} color={colors.muted} />
            <Text style={tileStyles.infoText}>{restaurant.priceRange}</Text>
          </View>
        </View>
        <View style={tileStyles.actionRow}>
          <TouchableOpacity style={tileStyles.actionBtn}>
            <Feather name="info" size={13} color={colors.text} />
            <Text style={tileStyles.actionText}>View menu</Text>
          </TouchableOpacity>
          <View style={tileStyles.actionDivider} />
          <TouchableOpacity style={tileStyles.actionBtn}>
            <Feather name="external-link" size={13} color={colors.text} />
            <Text style={tileStyles.actionText}>Reserve</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Bookings section ─────────────────────────────────────────────────────────

function BookingsSection({ bookings }: { bookings: Booking[] }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={bookingStyles.container}>
      <TouchableOpacity style={bookingStyles.header} onPress={() => setOpen(v => !v)}>
        <View style={bookingStyles.headerLeft}>
          <Feather name="credit-card" size={16} color={colors.text} />
          <Text style={bookingStyles.headerTitle}>Bookings</Text>
          <View style={bookingStyles.badge}>
            <Text style={bookingStyles.badgeText}>{bookings.length}</Text>
          </View>
        </View>
        <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </TouchableOpacity>

      {open && (
        <View style={bookingStyles.list}>
          {bookings.map((b, i) => (
            <View key={i} style={bookingStyles.row}>
              <View style={bookingStyles.iconBox}>
                <Feather name={BOOKING_ICON[b.type] ?? "calendar"} size={16} color={colors.accent} />
              </View>
              <View style={bookingStyles.rowInfo}>
                <Text style={bookingStyles.rowTitle} numberOfLines={1}>{b.title}</Text>
                <Text style={bookingStyles.rowSub}>{b.date} · Ref: {b.ref}</Text>
              </View>
              <Text style={bookingStyles.rowPrice}>
                {b.price === 0 ? "Free" : `${b.currency} ${b.price}`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Map pins ─────────────────────────────────────────────────────────────────

function MapPin({ number, color, active }: { number?: number; color: string; active?: boolean }) {
  return (
    <View style={[
      mapStyles.pin,
      { backgroundColor: color },
      active && mapStyles.pinActive,
    ]}>
      {number != null
        ? <Text style={mapStyles.pinNum}>{number}</Text>
        : <View style={mapStyles.pinDot} />}
    </View>
  );
}

// ─── Day selector with fading edges ──────────────────────────────────────────

function DaySelector({
  stops, activeIdx, onSelect,
}: {
  stops: { dayNumber: number }[];
  activeIdx: number;
  onSelect: (i: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const pillX = useRef<number[]>([]);
  const containerW = useRef(0);
  const contentW = useRef(0);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  function updateFades(scrollX: number) {
    setShowLeft(scrollX > 10);
    setShowRight(contentW.current > containerW.current + 10 && scrollX < contentW.current - containerW.current - 10);
  }

  useEffect(() => {
    const x = pillX.current[activeIdx];
    if (x != null && scrollRef.current) {
      scrollRef.current.scrollTo({ x: Math.max(0, x - 24), animated: true });
    }
  }, [activeIdx]);

  return (
    <View style={mapStyles.selectorWrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={mapStyles.selectorContent}
        onLayout={e => {
          containerW.current = e.nativeEvent.layout.width;
          updateFades(0);
        }}
        onContentSizeChange={w => {
          contentW.current = w;
          setShowRight(w > containerW.current + 10);
        }}
        onScroll={e => updateFades(e.nativeEvent.contentOffset.x)}
      >
        {stops.map((s, i) => (
          <TouchableOpacity
            key={i}
            style={[mapStyles.dayPill, i === activeIdx && mapStyles.dayPillActive]}
            onLayout={e => { pillX.current[i] = e.nativeEvent.layout.x; }}
            onPress={() => onSelect(i)}
          >
            <Text style={[mapStyles.dayPillText, i === activeIdx && mapStyles.dayPillTextActive]}>
              Day {s.dayNumber}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {showLeft && <LinearGradient colors={[colors.card, "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={mapStyles.fadeLeft} pointerEvents="none" />}
      {showRight && <LinearGradient colors={["transparent", colors.card]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={mapStyles.fadeRight} pointerEvents="none" />}
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

  const activityStops = days.map((d, i) => ({
    day: d,
    coords: stopCoords(meta, d.dayNumber, days.length),
    index: i,
  }));

  const active = activityStops[activeIdx];
  const centerCoords = meta?.coords ?? activityStops[0]?.coords ?? [0, 0];

  const routeGeoJSON = activityStops.length >= 2
    ? {
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: activityStops.map(s => s.coords) },
        properties: {},
      }
    : null;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={{ flex: 1 }}>
        {/* Map */}
        <MapboxGL.MapView style={{ flex: 1 }} logoEnabled={false} attributionEnabled={false}>
          <MapboxGL.Camera centerCoordinate={centerCoords} zoomLevel={meta ? 10 : 3} animationDuration={0} />

          {/* Route line */}
          {routeGeoJSON && (
            <MapboxGL.ShapeSource id="tripRoute" shape={routeGeoJSON}>
              <MapboxGL.LineLayer id="tripRouteLine" style={{ lineColor: colors.accent, lineWidth: 2, lineDasharray: [2, 2], lineOpacity: 0.8 }} />
            </MapboxGL.ShapeSource>
          )}

          {/* Activity pins */}
          {activityStops.map((stop, i) => (
            <MapboxGL.PointAnnotation key={`act-${i}`} id={`act-${i}`} coordinate={stop.coords} onSelected={() => setActiveIdx(i)}>
              <MapPin number={i + 1} color={PIN_COLORS.activity} active={i === activeIdx} />
            </MapboxGL.PointAnnotation>
          ))}

          {/* Accommodation pin */}
          {meta?.accommodationCoords && (
            <MapboxGL.PointAnnotation key="accom" id="accom" coordinate={meta.accommodationCoords}>
              <MapPin color={PIN_COLORS.accommodation} />
            </MapboxGL.PointAnnotation>
          )}

          {/* Restaurant pins */}
          {meta?.restaurants.map((r, i) => (
            <MapboxGL.PointAnnotation key={`rest-${i}`} id={`rest-${i}`} coordinate={r.coords}>
              <MapPin color={PIN_COLORS.restaurant} />
            </MapboxGL.PointAnnotation>
          ))}
        </MapboxGL.MapView>

        {/* Top bar */}
        <View style={[mapStyles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={mapStyles.iconBtn} onPress={() => onClose()}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          {/* Legend */}
          <View style={mapStyles.legendRow}>
            {([
              { color: PIN_COLORS.activity, label: "Activity" },
              { color: PIN_COLORS.accommodation, label: "Stay" },
              { color: PIN_COLORS.restaurant, label: "Dining" },
            ] as const).map(item => (
              <View key={item.label} style={mapStyles.legendItem}>
                <View style={[mapStyles.legendDot, { backgroundColor: item.color }]} />
                <Text style={mapStyles.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={mapStyles.iconBtn}>
            <Feather name="menu" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Bottom panel */}
        <View style={[mapStyles.bottomPanel, { paddingBottom: insets.bottom + 8 }]}>
          <DaySelector
            stops={activityStops.map(s => ({ dayNumber: s.day.dayNumber }))}
            activeIdx={activeIdx}
            onSelect={setActiveIdx}
          />

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
                    {active.day.distanceKm ? <Text style={mapStyles.stopMetaText}>{active.day.distanceKm} km</Text> : null}
                    {active.day.distanceKm && active.day.elevationGainM ? <Text style={mapStyles.stopMetaText}>  ·  </Text> : null}
                    {active.day.elevationGainM ? <Text style={mapStyles.stopMetaText}>↑ {active.day.elevationGainM} m</Text> : null}
                  </View>
                ) : null}
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
              <TouchableOpacity style={mapStyles.detailBtn} onPress={() => onClose(active.day.dayNumber)}>
                <Text style={mapStyles.detailBtnText}>Show detail</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Day tab strip with fading edges ─────────────────────────────────────────

function ItineraryDayTabs({
  days, selectedDay, onSelect,
}: { days: AdventureDayRow[]; selectedDay: number; onSelect: (d: number) => void }) {
  const scrollRef = useRef<ScrollView>(null);
  const pillX = useRef<number[]>([]);
  const containerW = useRef(0);
  const contentW = useRef(0);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  function updateFades(scrollX: number) {
    setShowLeft(scrollX > 10);
    setShowRight(contentW.current > containerW.current + 10 && scrollX < contentW.current - containerW.current - 10);
  }

  useEffect(() => {
    const idx = days.findIndex(d => d.dayNumber === selectedDay);
    const x = pillX.current[idx];
    if (x != null && scrollRef.current) {
      scrollRef.current.scrollTo({ x: Math.max(0, x - 24), animated: true });
    }
  }, [selectedDay, days]);

  return (
    <View style={detailStyles.dayTabWrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={detailStyles.dayTabScroll}
        onLayout={e => {
          containerW.current = e.nativeEvent.layout.width;
          updateFades(0);
        }}
        onContentSizeChange={w => {
          contentW.current = w;
          setShowRight(w > containerW.current + 10);
        }}
        onScroll={e => updateFades(e.nativeEvent.contentOffset.x)}
      >
        {days.map((d, i) => (
          <TouchableOpacity
            key={d.dayNumber}
            style={[detailStyles.dayTab, selectedDay === d.dayNumber && detailStyles.dayTabActive]}
            onLayout={e => { pillX.current[i] = e.nativeEvent.layout.x; }}
            onPress={() => onSelect(d.dayNumber)}
          >
            <Text style={[detailStyles.dayTabText, selectedDay === d.dayNumber && detailStyles.dayTabTextActive]}>
              Day {d.dayNumber}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {showLeft && <LinearGradient colors={[colors.card, "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={detailStyles.tabFadeLeft} pointerEvents="none" />}
      {showRight && <LinearGradient colors={["transparent", colors.card]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={detailStyles.tabFadeRight} pointerEvents="none" />}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const insets   = useSafeAreaInsets();
  const router   = useRouter();

  const [adventure, setAdventure]       = useState<AdventureRow | null>(null);
  const [selectedDay, setSelectedDay]   = useState(1);
  const [mapVisible, setMapVisible]     = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [routeModal, setRouteModal]     = useState(false);
  const [reviews, setReviews]           = useState<Record<number, { rating: number; comment: string }>>({});

  useEffect(() => {
    const mock = MOCK_TRIPS.find(m => m.id === id);
    if (mock) { setAdventure(mock); return; }
    getMyAdventures().then(list => setAdventure(list.find(a => a.id === id) ?? null));
  }, [id]);

  if (!adventure) {
    return (
      <View style={[detailStyles.container, { paddingTop: insets.top }]}>
        <TouchableOpacity style={detailStyles.headerBtn} onPress={() => router.replace("/(app)/trips")}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>
    );
  }

  const sortedDays  = [...(adventure.adventure_days ?? [])].sort((a, b) => a.dayNumber - b.dayNumber);
  const meta        = MOCK_TRIP_META[adventure.id] ?? null;
  const actIconName = (ACTIVITY_ICON[adventure.activityType] ?? "map-marker-outline") as React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  const heroUrl     = `https://picsum.photos/seed/${adventure.id}/800/600`;
  const currentDay  = sortedDays.find(d => d.dayNumber === selectedDay) ?? sortedDays[0];
  const todayRestaurants = meta?.restaurants.filter(r => r.night === selectedDay) ?? [];

  const getReview = (dayNum: number) => reviews[dayNum] ?? { rating: 0, comment: "" };
  const setReview = (dayNum: number, r: { rating: number; comment: string }) =>
    setReviews(prev => ({ ...prev, [dayNum]: r }));

  return (
    <View style={[detailStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={detailStyles.header}>
        <TouchableOpacity style={detailStyles.headerBtn} onPress={() => router.replace("/(app)/trips")}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={detailStyles.headerTitle}>Itinerary</Text>
        <View style={detailStyles.headerRight}>
          <TouchableOpacity style={detailStyles.headerBtn} onPress={() => setInviteVisible(true)}>
            <Feather name="user-plus" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={detailStyles.headerBtn} onPress={() => setMapVisible(true)}>
            <Feather name="map" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={{ height: HERO_H }}>
          <Image source={{ uri: heroUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.78)"]} style={StyleSheet.absoluteFill} />
          <View style={detailStyles.heroText}>
            <Text style={detailStyles.heroTitle}>{adventure.title}</Text>
            <View style={detailStyles.heroMeta}>
              <Feather name="map-pin" size={12} color="rgba(255,255,255,0.75)" />
              <Text style={detailStyles.heroMetaText}>{adventure.region}</Text>
              <Text style={detailStyles.heroMetaDot}>·</Text>
              <MaterialCommunityIcons name={actIconName} size={14} color="rgba(255,255,255,0.75)" />
              <Text style={detailStyles.heroMetaText}>{adventure.activityType.replace(/_/g, " ")}</Text>
              <Text style={detailStyles.heroMetaDot}>·</Text>
              <Text style={detailStyles.heroMetaText}>{adventure.durationDays} days</Text>
            </View>
          </View>
        </View>

        {/* Day tabs */}
        <ItineraryDayTabs days={sortedDays} selectedDay={selectedDay} onSelect={setSelectedDay} />

        {/* Day content */}
        {currentDay && (
          <View style={detailStyles.dayContent}>
            <Text style={detailStyles.dateLabel}>{formatDayDate(adventure.startDate, currentDay.dayNumber)}</Text>

            <StopCard
              day={currentDay}
              adventureId={adventure.id}
              stopNumber={currentDay.dayNumber}
              isLast={todayRestaurants.length === 0 && !meta}
              review={getReview(currentDay.dayNumber)}
              onRate={r => setReview(currentDay.dayNumber, { ...getReview(currentDay.dayNumber), rating: r })}
              onComment={c => setReview(currentDay.dayNumber, { ...getReview(currentDay.dayNumber), comment: c })}
              onConnectRoute={() => setRouteModal(true)}
            />

            {/* Restaurants for today */}
            {todayRestaurants.map((r, i) => (
              <RestaurantCard key={i} restaurant={r} adventureId={adventure.id} idx={i} />
            ))}

            {/* Accommodation */}
            {meta && <AccommodationCard meta={meta} adventureId={adventure.id} />}
          </View>
        )}

        {/* Bookings */}
        {meta?.bookings && meta.bookings.length > 0 && (
          <View style={{ marginHorizontal: spacing.md, marginBottom: spacing.md }}>
            <BookingsSection bookings={meta.bookings} />
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modals */}
      <TripMapModal
        visible={mapVisible}
        onClose={day => { setMapVisible(false); if (day != null) setSelectedDay(day); }}
        adventure={adventure}
        days={sortedDays}
        meta={meta}
      />
      <RouteConnectModal visible={routeModal} onClose={() => setRouteModal(false)} />
      <InviteFriendsModal
        visible={inviteVisible}
        onClose={() => setInviteVisible(false)}
        adventure={adventure}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const detailStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerRight: { flexDirection: "row", alignItems: "center" },
  headerTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
  heroText: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.md, gap: 6 },
  heroTitle: { color: "#FFFFFF", fontSize: fontSize.xxl, fontWeight: "800", lineHeight: 30, letterSpacing: -0.3 },
  heroMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
  heroMetaText: { color: "rgba(255,255,255,0.8)", fontSize: fontSize.sm, textTransform: "capitalize" },
  heroMetaDot: { color: "rgba(255,255,255,0.4)", fontSize: fontSize.sm },
  dayTabWrap: {
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.card,
    position: "relative",
  },
  dayTabScroll: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, gap: spacing.sm },
  dayTab: {
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
  },
  dayTabActive: { backgroundColor: colors.text, borderColor: colors.text },
  dayTabText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.muted },
  dayTabTextActive: { color: colors.inverse },
  tabFadeLeft: { position: "absolute", left: 0, top: 0, bottom: 0, width: 36, pointerEvents: "none" } as any,
  tabFadeRight: { position: "absolute", right: 0, top: 0, bottom: 0, width: 36, pointerEvents: "none" } as any,
  dayContent: { padding: spacing.md, gap: spacing.md },
  dateLabel: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
});

const tileStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  timeline: { alignItems: "center", width: 36 },
  circle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.text, alignItems: "center", justifyContent: "center", zIndex: 1,
  },
  circleNum: { color: colors.inverse, fontSize: fontSize.sm, fontWeight: "700" },
  line: {
    flex: 1, width: 2, borderLeftWidth: 2, borderLeftColor: colors.border,
    borderStyle: "dashed", marginTop: 4, marginBottom: 4, minHeight: 40,
  },
  card: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.lg,
    overflow: "hidden", ...shadow.sm, marginBottom: spacing.md,
  },
  photo: { width: "100%", height: 160 },
  info: { padding: spacing.md, gap: 6 },
  title: { fontSize: fontSize.base, fontWeight: "700", color: colors.text, lineHeight: 20 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
  infoText: { fontSize: fontSize.xs, color: colors.muted, flex: 1, lineHeight: 16 },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginTop: 2 },
  statChip: {
    backgroundColor: colors.sheet, borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  statText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "500" },
  actionRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 5, paddingVertical: 12,
  },
  actionText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "600" },
  actionDivider: { width: 1, backgroundColor: colors.border, marginVertical: 10 },
});

const reviewStyles = StyleSheet.create({
  container: {
    borderTopWidth: 1, borderTopColor: colors.border,
    padding: spacing.md, gap: 10,
  },
  starRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingLabel: { marginLeft: 6, fontSize: fontSize.sm, fontWeight: "700", color: "#F59E0B" },
  commentInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.sm, fontSize: fontSize.sm, color: colors.text,
    minHeight: 60, textAlignVertical: "top",
  },
  photoBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start",
  },
  photoBtnText: { fontSize: fontSize.sm, color: colors.accent, fontWeight: "600" },
});

const bookingStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    overflow: "hidden", ...shadow.sm,
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: spacing.md,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
  badge: {
    backgroundColor: colors.accent, borderRadius: radius.full,
    width: 20, height: 20, alignItems: "center", justifyContent: "center",
  },
  badgeText: { fontSize: fontSize.xs, color: "#FFFFFF", fontWeight: "700" },
  list: { borderTopWidth: 1, borderTopColor: colors.border },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.accentLight, alignItems: "center", justifyContent: "center",
  },
  rowInfo: { flex: 1, gap: 2 },
  rowTitle: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  rowSub: { fontSize: fontSize.xs, color: colors.muted },
  rowPrice: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text },
});

const rcStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, gap: spacing.md,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.xs },
  title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  sub: { fontSize: fontSize.sm, color: colors.muted, lineHeight: 20 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.md, fontSize: fontSize.sm, color: colors.text,
  },
  btnRow: { flexDirection: "row", gap: spacing.sm },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border, alignItems: "center",
  },
  cancelText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  connectBtn: {
    flex: 2, paddingVertical: 14, borderRadius: radius.full,
    backgroundColor: colors.text, alignItems: "center",
  },
  connectBtnDisabled: { backgroundColor: colors.border },
  connectText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.inverse },
});

const mapStyles = StyleSheet.create({
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.md, zIndex: 10,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center",
  },
  legendRow: { flexDirection: "row", gap: 8, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: "#FFFFFF", fontWeight: "600" },
  bottomPanel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: spacing.sm, ...shadow.lg,
  },
  selectorWrap: { position: "relative" },
  selectorContent: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, gap: spacing.sm },
  dayPill: {
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
  },
  dayPillActive: { backgroundColor: colors.text, borderColor: colors.text },
  dayPillText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.muted },
  dayPillTextActive: { color: colors.inverse },
  fadeLeft: { position: "absolute", left: 0, top: 0, bottom: 0, width: 36 } as any,
  fadeRight: { position: "absolute", right: 0, top: 0, bottom: 0, width: 36 } as any,
  stopCard: {
    marginHorizontal: spacing.md, marginTop: spacing.xs,
    backgroundColor: colors.card, borderRadius: radius.lg,
    overflow: "hidden", borderWidth: 1, borderColor: colors.border,
  },
  stopPhoto: { width: "100%", height: 100 },
  stopInfo: { padding: spacing.md, gap: 5 },
  stopTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
  stopMetaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  stopMetaText: { fontSize: fontSize.xs, color: colors.muted },
  stopActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  stopActionBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingVertical: 5, paddingHorizontal: spacing.sm,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
  },
  stopActionText: { fontSize: fontSize.xs, color: colors.text, fontWeight: "600" },
  detailBtn: {
    backgroundColor: colors.text, margin: spacing.md, marginTop: spacing.sm,
    borderRadius: radius.full, paddingVertical: 13, alignItems: "center",
  },
  detailBtnText: { color: colors.inverse, fontWeight: "700", fontSize: fontSize.sm },
  pin: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#FFFFFF",
  },
  pinActive: { width: 38, height: 38, borderRadius: 19, borderWidth: 3 },
  pinNum: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  pinDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#FFFFFF" },
});

const invStyles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing.lg, paddingBottom: spacing.md,
    maxHeight: "88%",
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between", gap: spacing.sm, marginBottom: spacing.md,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text, marginBottom: 2 },
  subtitle: { fontSize: fontSize.sm, color: colors.muted, lineHeight: 18 },

  // Trip card
  tripCard: {
    backgroundColor: colors.accentLight ?? "#EEF5EE",
    borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tripCardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  tripIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center",
  },
  tripCardTitle: { fontSize: fontSize.base, fontWeight: "700", color: colors.text },
  tripCardSub: { fontSize: fontSize.xs, color: colors.muted },
  copyLinkBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  copyLinkText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.text },

  // Friends list
  friendsBox: {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm, gap: 2,
  },
  friendsLabel: { fontSize: fontSize.sm, fontWeight: "700", color: colors.text, paddingHorizontal: 4, paddingBottom: 4 },
  collabRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingVertical: 6, paddingHorizontal: 4,
  },
  collabAvatar: { width: 38, height: 38, borderRadius: 19 },
  collabInfo: { flex: 1 },
  collabName: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  collabUsername: { fontSize: fontSize.xs, color: colors.muted },
  ownerBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
  },
  ownerText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.muted },
  permBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: spacing.sm, paddingVertical: 5,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
  },
  permBtnText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.text },

  // Permission picker
  pickerOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center", alignItems: "center",
  },
  pickerCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    ...shadow.md, minWidth: 190, overflow: "hidden",
  },
  pickerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  pickerOption: { fontSize: fontSize.sm, color: colors.text },
  pickerOptionActive: { fontWeight: "700", color: colors.accent },
  pickerDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  pickerRemove: { fontSize: fontSize.sm, color: "#E03E3E", fontWeight: "600" },

  // Divider
  orRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginVertical: spacing.md },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { fontSize: fontSize.xs, color: colors.muted, fontWeight: "500" },

  // Search
  searchWrap: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 10,
    backgroundColor: colors.bg,
  },
  searchInput: { flex: 1, fontSize: fontSize.sm, color: colors.text },

  // Suggestions
  suggestionList: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, overflow: "hidden",
    marginTop: spacing.xs,
  },
  suggestionRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  suggestionAvatar: { width: 32, height: 32, borderRadius: 16 },
  suggestionName: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  suggestionUsername: { fontSize: fontSize.xs, color: colors.muted },

  // Chips
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: spacing.sm, paddingVertical: 5,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chipText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.text },

  // Invite button
  inviteBtn: {
    backgroundColor: colors.text, borderRadius: radius.full,
    paddingVertical: 14, alignItems: "center",
    marginTop: spacing.md,
  },
  inviteBtnDisabled: { backgroundColor: colors.border },
  inviteBtnText: { color: colors.inverse, fontWeight: "700", fontSize: fontSize.base },

  // QR view
  qrBox: {
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#FFFFFF", borderRadius: radius.xl,
    padding: spacing.xl, marginVertical: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  qrPlaceholder: { width: 200, height: 200, alignItems: "center", justifyContent: "center" },
  codeRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    backgroundColor: colors.bg,
  },
  codeText: { fontSize: fontSize.base, fontWeight: "700", color: colors.text, letterSpacing: 0.5 },

  // Toast
  toast: {
    position: "absolute", bottom: spacing.xl, alignSelf: "center",
    backgroundColor: colors.text, borderRadius: radius.full,
    paddingHorizontal: spacing.lg, paddingVertical: 10,
  },
  toastText: { color: colors.inverse, fontSize: fontSize.sm, fontWeight: "600" },
});
