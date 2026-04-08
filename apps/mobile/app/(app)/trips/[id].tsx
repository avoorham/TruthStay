import React, {
  useEffect, useRef, useState,
} from "react";
import {
  ActivityIndicator, Alert, Animated, Dimensions, Image, Keyboard, Modal, PanResponder, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import MapboxGL from "@rnmapbox/maps";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { getMyAdventures, getAdventureById, submitDayFeedback, createPost, shareAdventurePublic, type AdventureRow, type AdventureDayRow } from "../../../lib/api";
import { pickImage, uploadTripCover, uploadReviewPhoto, uploadPostPhoto } from "../../../lib/storage";
import { colors, fontSize, radius, spacing, shadow } from "../../../lib/theme";

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");

// ─── Local types (replacing mock-trips / mock-users) ──────────────────────────

export interface RestaurantStop {
  name: string;
  cuisine: string;
  priceRange: string;
  night: number;
  coords: [number, number];
}

export interface Booking {
  type: "flight" | "hotel" | "train" | "activity" | "car";
  title: string;
  ref: string;
  date: string;
  price: number;
  currency: string;
}

export interface TripMeta {
  coords: [number, number];
  dayCoords: Record<number, [number, number]>;
  accommodation: string;
  accommodationCoords: [number, number];
  pricePerNight: number;
  nights: string;
  restaurants: RestaurantStop[];
  bookings: Booking[];
}

export type Permission = "Editor" | "Suggest edits" | "Viewer";
export interface MockUser { id: string; name: string; username: string }
export interface Collaborator { user: MockUser; role: string }

function searchUsers(_query: string, _excludeIds: string[]): MockUser[] { return []; }

// Derive TripMeta from real AdventureRow data
function deriveMetaMeta(adventure: AdventureRow): TripMeta {
  const baseCoords: [number, number] = (adventure.meta?.coords as [number, number] | undefined) ?? [10, 48];
  const restaurants: RestaurantStop[] = [];
  const dayCoords: Record<number, [number, number]> = {};
  let accommodation = "";
  let pricePerNight = 0;

  for (const day of adventure.adventure_days ?? []) {
    const alt = day.alternatives;
    if (!alt) continue;

    // Extract restaurants for this day
    for (const r of alt.restaurants ?? []) {
      restaurants.push({
        name: r.name ?? "Restaurant",
        cuisine: r.cuisine ?? "",
        priceRange: r.price_range ?? "",
        night: day.dayNumber,
        coords: baseCoords,
      });
    }

    // First accommodation option encountered
    const accomOpt = alt.accommodationStop?.options?.[0];
    if (accomOpt && !accommodation) {
      accommodation = accomOpt.name ?? "";
      pricePerNight = accomOpt.price_per_night_eur ?? 0;
    }
  }

  return {
    coords: baseCoords,
    dayCoords,
    accommodation,
    accommodationCoords: baseCoords,
    pricePerNight,
    nights: `${adventure.durationDays - 1} nights`,
    restaurants,
    bookings: [],
  };
}

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

function computeBounds(coords: [number, number][]): { ne: [number, number]; sw: [number, number] } | null {
  if (coords.length === 0) return null;
  const lngs = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  return {
    ne: [Math.max(...lngs), Math.max(...lats)],
    sw: [Math.min(...lngs), Math.min(...lats)],
  };
}

const BOOKING_ICON: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  flight: "send", hotel: "home", train: "map", car: "settings", activity: "star",
};

// ─── Review section ───────────────────────────────────────────────────────────

interface Review { rating: number; comment: string }

function ReviewSection({
  review, onRate, onComment, photos, onAddPhoto,
}: {
  review: Review;
  onRate: (r: number) => void;
  onComment: (c: string) => void;
  photos: string[];
  onAddPhoto: () => void;
}) {
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
      {/* Photo thumbnails */}
      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 2 }}>
          <View style={reviewStyles.photoStrip}>
            {photos.map((url, i) => (
              <Image key={i} source={{ uri: url }} style={reviewStyles.photoThumb} />
            ))}
          </View>
        </ScrollView>
      )}
      {/* Add photo CTA */}
      <TouchableOpacity style={reviewStyles.photoBtn} onPress={onAddPhoto}>
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
    [{ user: { id: "me", username: "you", name: "You" }, role: "owner" }],
  );
  const [inviteSent, setInviteSent] = useState(false);
  const [toast, setToast] = useState("");
  const kbOffset = useRef(new Animated.Value(0)).current;
  const sheetY   = useRef(new Animated.Value(0)).current;

  // Swipe handle pan responder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderMove: (_, gs) => {
        // Allow full downward drag; resist upward past 60px
        sheetY.setValue(Math.max(gs.dy, -60));
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || (gs.vy > 0.5 && gs.dy > 0)) {
          // Swipe down fast enough → dismiss
          Animated.timing(sheetY, { toValue: 900, duration: 220, useNativeDriver: false }).start(() => {
            sheetY.setValue(0);
            handleClose();
          });
        } else {
          // Snap back
          Animated.spring(sheetY, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
        }
      },
    }),
  ).current;

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

  // Reset offsets when modal closes
  useEffect(() => {
    if (!visible) { kbOffset.setValue(0); sheetY.setValue(0); }
  }, [visible, kbOffset, sheetY]);

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
          <Animated.View style={{ transform: [{ translateY: sheetY }] }}>
          <View style={invStyles.sheet}>
            {/* Draggable handle — pan responder attached here only */}
            <View
              {...panResponder.panHandlers}
              style={{ alignItems: "center", paddingVertical: 10 }}
            >
              <View style={invStyles.handle} />
            </View>

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

                </ScrollView>

                {/* Divider — outside ScrollView so it stays visible */}
                <View style={invStyles.orRow}>
                  <View style={invStyles.orLine} />
                  <Text style={invStyles.orText}>or</Text>
                  <View style={invStyles.orLine} />
                </View>

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
  day, adventureId, stopNumber, isLast, review, onRate, onComment, onConnectRoute, photos, onAddPhoto, onShare,
}: {
  day: AdventureDayRow;
  adventureId: string;
  stopNumber: number;
  isLast: boolean;
  review: Review;
  onRate: (r: number) => void;
  onComment: (c: string) => void;
  onConnectRoute: () => void;
  photos: string[];
  onAddPhoto: () => void;
  onShare: () => void;
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
            <Feather name="navigation" size={13} color={colors.text} />
            <Text style={tileStyles.actionText}>Directions</Text>
          </TouchableOpacity>
          <View style={tileStyles.actionDivider} />
          <TouchableOpacity style={tileStyles.actionBtn} onPress={onConnectRoute}>
            <MaterialCommunityIcons name="routes" size={14} color={colors.text} />
            <Text style={tileStyles.actionText}>Route</Text>
          </TouchableOpacity>
          <View style={tileStyles.actionDivider} />
          <TouchableOpacity style={tileStyles.actionBtn} onPress={onShare}>
            <Feather name="share-2" size={13} color={colors.text} />
            <Text style={tileStyles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Review section */}
        <ReviewSection review={review} onRate={onRate} onComment={onComment} photos={photos} onAddPhoto={onAddPhoto} />
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
        <View style={[tileStyles.circle, { backgroundColor: colors.accent }]}>
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
        <View style={[tileStyles.circle, { backgroundColor: "#E07B39" }]}>
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

function AccommodationPin() {
  return (
    <View style={mapStyles.accomPin}>
      <MaterialCommunityIcons name="home" size={16} color="#FFFFFF" />
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
        onContentSizeChange={(w) => {
          contentW.current = w;
          updateFades(0);
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
  meta: TripMeta;
}) {
  const insets = useSafeAreaInsets();
  const [activeIdx, setActiveIdx] = useState(0);

  const cameraRef = useRef<MapboxGL.Camera>(null);
  const mapRef    = useRef<MapboxGL.MapView>(null);

  const activityStops = days.map((d, i) => ({
    day: d,
    coords: stopCoords(meta, d.dayNumber, days.length),
    index: i,
  }));

  const active = activityStops[activeIdx];

  const allCoords: [number, number][] = [
    ...activityStops.map(s => s.coords),
    ...(meta?.accommodationCoords ? [meta.accommodationCoords] : []),
    ...(meta?.restaurants.map(r => r.coords) ?? []),
  ];
  const bounds = computeBounds(allCoords);

  // GeoJSON sources for canvas-rendered pins (always below PointAnnotation layer)
  const activityGeoJSON = {
    type: "FeatureCollection" as const,
    features: activityStops.map((stop, i) => ({
      type: "Feature" as const,
      id: String(i),
      geometry: { type: "Point" as const, coordinates: stop.coords },
      properties: { dayNumber: stop.day.dayNumber, active: i === activeIdx ? 1 : 0 },
    })),
  };

  const restaurantGeoJSON = meta?.restaurants && meta.restaurants.length > 0 ? {
    type: "FeatureCollection" as const,
    features: meta.restaurants.map((r, i) => ({
      type: "Feature" as const,
      id: String(i),
      geometry: { type: "Point" as const, coordinates: r.coords },
      properties: {},
    })),
  } : null;

  const routeGeoJSON = activityStops.length >= 2
    ? {
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: activityStops.map(s => s.coords) },
        properties: {},
      }
    : null;

  async function zoomIn() {
    const zoom = await mapRef.current?.getZoom();
    if (zoom != null) cameraRef.current?.setCamera({ zoomLevel: zoom + 1, animationDuration: 250 });
  }
  async function zoomOut() {
    const zoom = await mapRef.current?.getZoom();
    if (zoom != null) cameraRef.current?.setCamera({ zoomLevel: Math.max(1, zoom - 1), animationDuration: 250 });
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={{ flex: 1 }}>
        {/* Map */}
        <MapboxGL.MapView ref={mapRef} style={{ flex: 1 }} logoEnabled={false} attributionEnabled={false}>
          <MapboxGL.Camera
            ref={cameraRef}
            animationDuration={0}
            {...(bounds
              ? { bounds: { ne: bounds.ne, sw: bounds.sw, paddingTop: 100, paddingBottom: 340, paddingLeft: 48, paddingRight: 48 } }
              : { centerCoordinate: [0, 0], zoomLevel: 3 }
            )}
          />

          {/* Route line — canvas */}
          {routeGeoJSON && (
            <MapboxGL.ShapeSource id="tripRoute" shape={routeGeoJSON}>
              <MapboxGL.LineLayer id="tripRouteLine" style={{ lineColor: colors.accent, lineWidth: 2, lineDasharray: [2, 2], lineOpacity: 0.8 }} />
            </MapboxGL.ShapeSource>
          )}

          {/* Restaurant dots — canvas (smallest, always below activity & accommodation) */}
          {restaurantGeoJSON && (
            <MapboxGL.ShapeSource id="restaurants" shape={restaurantGeoJSON}>
              <MapboxGL.CircleLayer
                id="restaurantCircles"
                style={{
                  circleRadius: 9,
                  circleColor: "#FFFFFF",
                  circleStrokeWidth: 1.5,
                  circleStrokeColor: colors.border,
                }}
              />
              <MapboxGL.SymbolLayer
                id="restaurantIcons"
                style={{
                  textField: "🍴",
                  textSize: 9,
                  textAllowOverlap: true,
                  textIgnorePlacement: true,
                }}
              />
            </MapboxGL.ShapeSource>
          )}

          {/* Activity circles — canvas (below PointAnnotation layer) */}
          <MapboxGL.ShapeSource
            id="activities"
            shape={activityGeoJSON}
            onPress={e => {
              const idx = Number(e.features[0]?.id);
              if (!isNaN(idx)) setActiveIdx(idx);
            }}
          >
            <MapboxGL.CircleLayer
              id="activityCircles"
              style={{
                circleRadius: ["case", ["==", ["get", "active"], 1], 19, 15] as any,
                circleColor: ["case", ["==", ["get", "active"], 1], colors.accent, colors.text] as any,
                circleStrokeWidth: 2,
                circleStrokeColor: "#FFFFFF",
              }}
            />
            <MapboxGL.SymbolLayer
              id="activityLabels"
              style={{
                textField: ["to-string", ["get", "dayNumber"]] as any,
                textColor: "#FFFFFF",
                textSize: 11,
                textAllowOverlap: true,
                textIgnorePlacement: true,
              }}
            />
          </MapboxGL.ShapeSource>

          {/* Accommodation — PointAnnotation renders as RN view, always above canvas layers */}
          {meta?.accommodationCoords && (
            <MapboxGL.PointAnnotation key="accom" id="accom" coordinate={meta.accommodationCoords}>
              <AccommodationPin />
            </MapboxGL.PointAnnotation>
          )}
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

        {/* Zoom controls */}
        <View style={[mapStyles.zoomControls, { top: insets.top + 60 }]}>
          <TouchableOpacity style={mapStyles.zoomBtn} onPress={zoomIn}>
            <Feather name="plus" size={18} color={colors.text} />
          </TouchableOpacity>
          <View style={mapStyles.zoomDivider} />
          <TouchableOpacity style={mapStyles.zoomBtn} onPress={zoomOut}>
            <Feather name="minus" size={18} color={colors.text} />
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
        onContentSizeChange={(w) => {
          contentW.current = w;
          updateFades(0);
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

// ─── Post creation sheet ─────────────────────────────────────────────────────

function PostCreationSheet({
  visible, adventureId, dayNumber, dayTitle, adventureTitle, onClose,
}: {
  visible: boolean;
  adventureId: string;
  dayNumber: number;
  dayTitle: string;
  adventureTitle: string;
  onClose: () => void;
}) {
  const [caption, setCaption]     = useState("");
  const [photos, setPhotos]       = useState<string[]>([]);
  const [posting, setPosting]     = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [userId, setUserId]       = useState<string | null>(null);
  useEffect(() => {
    if (!visible) { setCaption(""); setPhotos([]); setPostError(null); return; }
    import("../../../lib/supabase").then(({ supabase }) => {
      supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    });
  }, [visible]);

  async function handleAddPhoto() {
    const uri = await pickImage([4, 3]);
    if (!uri || !userId) return;
    const key = `${Date.now()}`;
    const url = await uploadPostPhoto(userId, adventureId, key, uri);
    if (url) setPhotos(prev => [...prev, url]);
  }

  async function handlePost() {
    if (posting) return;
    setPosting(true);
    setPostError(null);
    try {
      await createPost({
        adventure_id: adventureId,
        day_number:   dayNumber,
        caption:      caption.trim() || `Day ${dayNumber} — ${adventureTitle}`,
        media_urls:   photos,
      });
      Alert.alert("Posted!", "Your update was shared to the feed.");
      onClose();
    } catch {
      setPostError("Upload failed — tap to retry");
    } finally {
      setPosting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={postStyles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
        <View style={postStyles.sheet}>
          {/* Handle */}
          <View style={postStyles.handle} />

          <Text style={postStyles.heading}>Share day update</Text>
          <Text style={postStyles.sub}>{dayTitle}</Text>

          {/* Photo row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={postStyles.photoScroll} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.md }}>
            <TouchableOpacity style={postStyles.addPhotoBtn} onPress={handleAddPhoto} activeOpacity={0.8}>
              <Feather name="camera" size={22} color={colors.muted} />
              <Text style={postStyles.addPhotoText}>Add photo</Text>
            </TouchableOpacity>
            {photos.map((uri, i) => (
              <Image key={i} source={{ uri }} style={postStyles.thumb} resizeMode="cover" />
            ))}
          </ScrollView>

          {/* Caption */}
          <TextInput
            style={postStyles.input}
            placeholder="What happened today?"
            placeholderTextColor={colors.muted}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={280}
          />

          {postError && (
            <TouchableOpacity onPress={handlePost} style={postStyles.postError}>
              <Text style={postStyles.postErrorText}>{postError}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[postStyles.postBtn, posting && { opacity: 0.6 }]}
            onPress={handlePost}
            disabled={posting}
            activeOpacity={0.85}
          >
            {posting
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <Text style={postStyles.postBtnText}>Post to feed</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const postStyles = StyleSheet.create({
  overlay:      { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: 40,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center", marginTop: spacing.sm, marginBottom: spacing.md,
  },
  heading:      { fontSize: 17, fontWeight: "700", color: colors.text, paddingHorizontal: spacing.md },
  sub:          { fontSize: fontSize.sm, color: colors.muted, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  photoScroll:  { marginBottom: spacing.md },
  addPhotoBtn: {
    width: 80, height: 80, borderRadius: radius.sm,
    borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", gap: 4,
  },
  addPhotoText: { fontSize: 10, color: colors.muted, fontWeight: "600" },
  thumb:        { width: 80, height: 80, borderRadius: radius.sm },
  input: {
    marginHorizontal: spacing.md,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.sm, color: colors.text, fontSize: fontSize.base,
    minHeight: 80, textAlignVertical: "top", marginBottom: spacing.md,
  },
  postBtn: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: "center",
  },
  postBtnText:  { color: "#FFFFFF", fontWeight: "700", fontSize: fontSize.base },
  postError: {
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    padding: spacing.sm, borderRadius: radius.md,
    backgroundColor: "#FEECEC",
  },
  postErrorText: { fontSize: fontSize.sm, color: "#E03E3E", fontWeight: "600", textAlign: "center" },
});

// ─── Feedback sheet ───────────────────────────────────────────────────────────

function StarRow({
  label, value, onChange,
}: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <View style={fbStyles.starRow}>
      <Text style={fbStyles.starLabel}>{label}</Text>
      <View style={fbStyles.stars}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons
              name={n <= value ? "star" : "star-outline"}
              size={26}
              color={n <= value ? "#F59E0B" : colors.border}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function FeedbackSheet({
  visible, dayNumber, adventureId, onClose,
}: {
  visible: boolean;
  dayNumber: number;
  adventureId: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [routeRating, setRouteRating]         = useState(0);
  const [accommodationRating, setAccommodationRating] = useState(0);
  const [restaurantRating, setRestaurantRating]       = useState(0);
  const [notes, setNotes]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (routeRating === 0 && accommodationRating === 0 && restaurantRating === 0) {
      onClose();
      return;
    }
    setSubmitting(true);
    try {
      await submitDayFeedback(adventureId, {
        dayNumber,
        routeRating:         routeRating         > 0 ? routeRating         : undefined,
        accommodationRating: accommodationRating > 0 ? accommodationRating : undefined,
        restaurantRating:    restaurantRating    > 0 ? restaurantRating    : undefined,
        notes:               notes.trim() || undefined,
      });
      setRouteRating(0); setAccommodationRating(0); setRestaurantRating(0); setNotes("");
      onClose();
    } catch (err) {
      Alert.alert("Save failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={fbStyles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={[fbStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={fbStyles.handle} />
        <Text style={fbStyles.title}>Rate Day {dayNumber}</Text>

        <StarRow label="Route / activity" value={routeRating} onChange={setRouteRating} />
        <StarRow label="Accommodation"    value={accommodationRating} onChange={setAccommodationRating} />
        <StarRow label="Food & dining"    value={restaurantRating}    onChange={setRestaurantRating} />

        <TextInput
          style={fbStyles.notes}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any notes? (optional)"
          placeholderTextColor={colors.subtle}
          multiline
        />

        <TouchableOpacity style={fbStyles.submitBtn} onPress={handleSubmit} disabled={submitting}>
          <Text style={fbStyles.submitText}>{submitting ? "Saving…" : "Save rating"}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const fbStyles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet:      {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: spacing.lg, gap: spacing.md,
  },
  handle:     {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: "center", marginBottom: 4,
  },
  title:      { fontSize: fontSize.lg, fontWeight: "700", color: colors.text, textAlign: "center" },
  starRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  starLabel:  { fontSize: fontSize.sm, color: colors.subtle, flex: 1 },
  stars:      { flexDirection: "row", gap: 4 },
  notes:      {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: spacing.sm, color: colors.text, fontSize: fontSize.sm,
    minHeight: 60, textAlignVertical: "top",
  },
  submitBtn:  {
    backgroundColor: colors.accent, borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2, alignItems: "center",
  },
  submitText: { color: "#FFFFFF", fontSize: fontSize.base, fontWeight: "700" },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const insets   = useSafeAreaInsets();
  const router   = useRouter();

  const [adventure, setAdventure]         = useState<AdventureRow | null>(null);
  const [loadError, setLoadError]         = useState(false);
  const [isOwnAdventure, setIsOwnAdventure] = useState(false);
  const [selectedDay, setSelectedDay]     = useState(1);
  const [mapVisible, setMapVisible]       = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [routeModal, setRouteModal]       = useState(false);
  const [reviews, setReviews]             = useState<Record<number, { rating: number; comment: string }>>({});
  const [coverUrl, setCoverUrl]           = useState<string | null>(null);
  const [reviewPhotos, setReviewPhotos]   = useState<Record<number, string[]>>({});
  const [feedbackDay, setFeedbackDay]     = useState<number | null>(null);
  const [shareDay, setShareDay]           = useState<number | null>(null);
  const [isPublicState, setIsPublicState] = useState(false);
  const [sharing, setSharing]             = useState(false);

  useEffect(() => {
    setSelectedDay(1);
    setLoadError(false);
    async function load() {
      try {
        // Try own adventures first (may fail if not logged in — that's fine)
        let isOwn = false;
        try {
          const list = await getMyAdventures();
          isOwn = list.some(a => a.id === id);
        } catch { /* not logged in or no adventures */ }

        // Always load via getAdventureById so we get isPublic for owners
        const adv = await getAdventureById(id ?? "");
        setIsOwnAdventure(isOwn);
        setIsPublicState(adv.isPublic ?? false);
        setAdventure(adv);
      } catch {
        setLoadError(true);
      }
    }
    load();
  }, [id]);

  if (loadError && !adventure) {
    return (
      <View style={[detailStyles.container, { paddingTop: insets.top, justifyContent: "center", alignItems: "center" }]}>
        <Feather name="alert-circle" size={36} color={colors.muted} />
        <Text style={{ color: colors.muted, marginTop: 12, fontSize: fontSize.base }}>Couldn't load trip details</Text>
        <TouchableOpacity
          style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 99, backgroundColor: colors.accent }}
          onPress={async () => {
            setLoadError(false);
            try {
              let found = null;
              let isOwn = false;
              try { const list = await getMyAdventures(); isOwn = list.some(a => a.id === id); } catch { /* not logged in */ }
              const adv = await getAdventureById(id ?? "");
              setIsOwnAdventure(isOwn); setIsPublicState(adv.isPublic ?? false); setAdventure(adv);
            } catch { setLoadError(true); }
          }}
        >
          <Text style={{ color: colors.inverse, fontWeight: "700" }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!adventure) {
    return (
      <View style={[detailStyles.container, { paddingTop: insets.top, justifyContent: "center", alignItems: "center" }]}>
        <Feather name="loader" size={28} color={colors.muted} />
      </View>
    );
  }

  const sortedDays  = [...(adventure.adventure_days ?? [])].sort((a, b) => a.dayNumber - b.dayNumber);
  const meta        = deriveMetaMeta(adventure);
  const actIconName = (ACTIVITY_ICON[adventure.activityType] ?? "map-marker-outline") as React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  const heroDisplayUrl = coverUrl ?? adventure.coverImageUrl ?? `https://picsum.photos/seed/${adventure.id}/800/600`;
  const currentDay  = sortedDays.find(d => d.dayNumber === selectedDay) ?? sortedDays[0];
  const todayRestaurants = meta.restaurants.filter((r: RestaurantStop) => r.night === selectedDay);
  const isOwner     = isOwnAdventure;

  async function handleShareToExplore() {
    if (!adventure) return;
    setSharing(true);
    try {
      await shareAdventurePublic(adventure.id);
      setIsPublicState(true);
    } catch {
      Alert.alert("Error", "Could not share adventure. Please try again.");
    } finally {
      setSharing(false);
    }
  }

  async function handleChangeCover() {
    const uri = await pickImage([16, 9]);
    if (!uri) return;
    const url = await uploadTripCover(adventure!.id, uri);
    if (url) setCoverUrl(url);
  }

  async function handleAddReviewPhoto(dayNum: number) {
    const uri = await pickImage();
    if (!uri) return;
    const key = `${adventure!.id}-${dayNum}-${Date.now()}`;
    const url = await uploadReviewPhoto(key, uri);
    if (url) setReviewPhotos(prev => ({ ...prev, [dayNum]: [...(prev[dayNum] ?? []), url] }));
  }

  const getReview = (dayNum: number) => reviews[dayNum] ?? { rating: 0, comment: "" };
  const setReview = (dayNum: number, r: { rating: number; comment: string }) =>
    setReviews(prev => ({ ...prev, [dayNum]: r }));

  return (
    <View style={[detailStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={detailStyles.header}>
        <TouchableOpacity style={detailStyles.headerBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={detailStyles.headerTitle}>Itinerary</Text>
        <View style={detailStyles.headerRight}>
          {isOwner && (
            <TouchableOpacity style={detailStyles.headerBtn} onPress={() => setInviteVisible(true)}>
              <Feather name="user-plus" size={20} color={colors.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={detailStyles.headerBtn} onPress={() => setMapVisible(true)}>
            <Feather name="map" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={{ height: HERO_H }}>
          <Image source={{ uri: heroDisplayUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
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
          {isOwner && (
            <TouchableOpacity style={detailStyles.heroEditBtn} onPress={handleChangeCover}>
              <Feather name="camera" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Share / public status banner (own adventures only) */}
        {isOwner && (
          isPublicState ? (
            <View style={detailStyles.publicBadge}>
              <Feather name="globe" size={13} color={colors.accent} />
              <Text style={detailStyles.publicBadgeText}>Public · visible on Explore</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={detailStyles.shareBanner}
              onPress={handleShareToExplore}
              disabled={sharing}
              activeOpacity={0.8}
            >
              {sharing
                ? <ActivityIndicator size="small" color={colors.inverse} />
                : <>
                    <Feather name="globe" size={13} color={colors.inverse} />
                    <Text style={detailStyles.shareBannerText}>Share to Explore</Text>
                    <Feather name="arrow-right" size={13} color={colors.inverse} />
                  </>
              }
            </TouchableOpacity>
          )
        )}

        {/* Day tabs */}
        <ItineraryDayTabs days={sortedDays} selectedDay={selectedDay} onSelect={setSelectedDay} />

        {/* Day content */}
        {currentDay && (
          <View style={detailStyles.dayContent}>
            <View style={detailStyles.dateLabelRow}>
              <Text style={detailStyles.dateLabel}>{formatDayDate(adventure.startDate, currentDay.dayNumber)}</Text>
              {adventure.startDate && (() => {
                const d = new Date(adventure.startDate);
                d.setDate(d.getDate() + currentDay.dayNumber - 1);
                return d < new Date();
              })() && (
                <TouchableOpacity
                  style={detailStyles.rateBtn}
                  onPress={() => setFeedbackDay(currentDay.dayNumber)}
                >
                  <MaterialCommunityIcons name="star-outline" size={14} color={colors.accent} />
                  <Text style={detailStyles.rateBtnText}>Rate</Text>
                </TouchableOpacity>
              )}
            </View>

            <StopCard
              day={currentDay}
              adventureId={adventure.id}
              stopNumber={currentDay.dayNumber}
              isLast={todayRestaurants.length === 0 && !meta}
              review={getReview(currentDay.dayNumber)}
              onRate={r => setReview(currentDay.dayNumber, { ...getReview(currentDay.dayNumber), rating: r })}
              onComment={c => setReview(currentDay.dayNumber, { ...getReview(currentDay.dayNumber), comment: c })}
              onConnectRoute={() => setRouteModal(true)}
              photos={reviewPhotos[currentDay.dayNumber] ?? []}
              onAddPhoto={() => handleAddReviewPhoto(currentDay.dayNumber)}
              onShare={() => setShareDay(currentDay.dayNumber)}
            />

            {/* Restaurants for today */}
            {todayRestaurants.map((r, i) => (
              <RestaurantCard key={i} restaurant={r} adventureId={adventure.id} idx={i} />
            ))}

            {/* Accommodation */}
            {meta.accommodation ? <AccommodationCard meta={meta} adventureId={adventure.id} /> : null}
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
      {feedbackDay != null && (
        <FeedbackSheet
          visible
          dayNumber={feedbackDay}
          adventureId={adventure.id}
          onClose={() => setFeedbackDay(null)}
        />
      )}
      {shareDay != null && (
        <PostCreationSheet
          visible
          adventureId={adventure.id}
          dayNumber={shareDay}
          dayTitle={adventure.adventure_days.find(d => d.dayNumber === shareDay)?.title ?? `Day ${shareDay}`}
          adventureTitle={adventure.title}
          onClose={() => setShareDay(null)}
        />
      )}
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
  dateLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  dateLabel: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  rateBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent },
  rateBtnText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.accent },
  heroEditBtn: {
    position: "absolute", bottom: spacing.md, right: spacing.md,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  shareBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: colors.accent,
    paddingVertical: 10, paddingHorizontal: spacing.md,
  },
  shareBannerText: { color: colors.inverse, fontSize: fontSize.sm, fontWeight: "700" },
  publicBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 8, paddingHorizontal: spacing.md,
    backgroundColor: colors.sheet,
  },
  publicBadgeText: { color: colors.accent, fontSize: fontSize.sm, fontWeight: "600" },
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
  photoStrip: { flexDirection: "row", gap: 8 },
  photoThumb: { width: 60, height: 60, borderRadius: radius.md },
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
  // Accommodation — largest, most prominent, accent fill
  accomPin: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2.5, borderColor: "#FFFFFF",
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  zoomControls: {
    position: "absolute", right: 12,
    backgroundColor: colors.card, borderRadius: 12,
    overflow: "hidden", ...shadow.sm,
  },
  zoomBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  zoomDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: 8 },
});

const invStyles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing.lg, paddingBottom: spacing.md,
    maxHeight: "92%",
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
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
