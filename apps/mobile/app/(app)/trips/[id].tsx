import React, {
  useEffect, useRef, useState,
} from "react";
import {
  ActivityIndicator, Alert, Animated, Dimensions, FlatList, Image, Keyboard, LayoutAnimation,
  Linking, Modal, PanResponder, Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, Vibration, View,
} from "react-native";
import MapboxGL from "@rnmapbox/maps";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { getMyAdventures, getAdventureById, submitDayFeedback, createPost, shareAdventurePublic, updateAdventure, deleteAdventure, moveActivity, updateTileOrder, getCollaborators, inviteCollaborator, updateCollaboratorPermission, removeCollaborator, updateDayCustomItems, createActivityPost, type AdventureRow, type AdventureDayRow, type CustomItem, type Collaborator as ApiCollaborator } from "../../../lib/api";
import { pickImage, uploadTripCover, uploadReviewPhoto, uploadPostPhoto } from "../../../lib/storage";
import { supabase } from "../../../lib/supabase";
import { colors, fontSize, fonts, radius, spacing, shadow } from "../../../lib/theme";

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");

// ─── Local types (replacing mock-trips / mock-users) ──────────────────────────

export interface RestaurantStop {
  name: string;
  cuisine: string;
  priceRange: string;
  night: number;
  coords: [number, number];
  websiteUrl?: string;
  theforkUrl?: string;
  googleMapsUrl?: string;
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
  accommodationUrl?: string;
  pricePerNight: number;
  nights: string;
  restaurants: RestaurantStop[];
  bookings: Booking[];
}

export type Permission = "editor" | "viewer";
export type Collaborator = ApiCollaborator;

type TileId = "route" | "accommodation" | `rest:${number}`;

// Derive TripMeta from real AdventureRow data
function deriveMetaMeta(adventure: AdventureRow): TripMeta {
  const baseCoords: [number, number] = (adventure.meta?.coords as [number, number] | undefined) ?? [10, 48];
  const restaurants: RestaurantStop[] = [];
  const dayCoords: Record<number, [number, number]> = {};
  let accommodation = "";
  let accommodationUrl: string | undefined;
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
        websiteUrl: r.website_url,
        theforkUrl: r.thefork_url,
        googleMapsUrl: r.google_maps_url,
      });
    }

    // First accommodation option encountered
    const accomOpt = alt.accommodationStop?.options?.[0];
    if (accomOpt && !accommodation) {
      accommodation = accomOpt.name ?? "";
      pricePerNight = accomOpt.price_per_night_eur ?? 0;
      accommodationUrl = accomOpt.booking_url;
    }
  }

  return {
    coords: baseCoords,
    dayCoords,
    accommodation,
    accommodationCoords: baseCoords,
    accommodationUrl,
    pricePerNight,
    nights: `${adventure.durationDays - 1} nights`,
    restaurants,
    bookings: [],
  };
}

const SCREEN_W = Dimensions.get("window").width;
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

const PERMISSIONS: Permission[] = ["editor", "viewer"];

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

  return (
    <View style={invStyles.collabRow}>
      <Image
        source={{ uri: collab.user.avatarUrl ?? `https://picsum.photos/seed/${collab.user.id}/80/80` }}
        style={invStyles.collabAvatar}
      />
      <View style={invStyles.collabInfo}>
        <Text style={invStyles.collabName}>{collab.user.displayName}</Text>
        <Text style={invStyles.collabUsername}>@{collab.user.username}</Text>
      </View>
      <>
        <TouchableOpacity style={invStyles.permBtn} onPress={() => setShowPicker(true)}>
          <Text style={invStyles.permBtnText}>{collab.permission}</Text>
          <Feather name="chevron-down" size={12} color={colors.muted} />
        </TouchableOpacity>
        {showPicker && (
          <PermissionPicker
            current={collab.permission}
            onSelect={onChangeRole}
            onRemove={onRemove}
            onClose={() => setShowPicker(false)}
          />
        )}
      </>
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
  const [collabs, setCollabs] = useState<Collaborator[]>([]);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [toast, setToast] = useState("");
  const kbOffset = useRef(new Animated.Value(0)).current;
  const sheetY   = useRef(new Animated.Value(0)).current;

  // Load collaborators when modal opens
  useEffect(() => {
    if (visible) {
      getCollaborators(adventure.id).then(setCollabs).catch(() => {/* non-fatal */});
    }
  }, [visible, adventure.id]);

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

  const canInvite = isValidEmail(searchText);
  const inviteCode = `TRIP-${adventure.id.toUpperCase()}`;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  }

  async function handleInvite() {
    if (!canInvite || inviting) return;
    setInviting(true);
    try {
      await inviteCollaborator(adventure.id, searchText.trim());
      setSearchText("");
      setInviteSent(true);
      const updated = await getCollaborators(adventure.id);
      setCollabs(updated);
    } catch (e: unknown) {
      showToast((e as Error).message ?? "Invite failed");
    } finally {
      setInviting(false);
    }
  }

  async function handleChangeRole(index: number, p: Permission) {
    const collab = collabs[index];
    try {
      await updateCollaboratorPermission(adventure.id, collab.user.id, p);
      setCollabs(prev => prev.map((x, xi) => xi === index ? { ...x, permission: p } : x));
    } catch { /* non-fatal */ }
  }

  async function handleRemove(index: number) {
    const collab = collabs[index];
    try {
      await removeCollaborator(adventure.id, collab.user.id);
      setCollabs(prev => prev.filter((_, xi) => xi !== index));
    } catch { /* non-fatal */ }
  }

  function handleClose() {
    Keyboard.dismiss();
    setShowQR(false);
    setSearchText("");
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
                      <Text style={invStyles.friendsLabel}>
                        Collaborators ({collabs.length})
                      </Text>
                      {collabs.length === 0 ? (
                        <Text style={[invStyles.friendsLabel, { color: colors.subtle, fontWeight: "400", fontSize: fontSize.xs }]}>
                          No collaborators yet. Invite someone by email below.
                        </Text>
                      ) : collabs.map((c, i) => (
                        <CollaboratorRow
                          key={c.id}
                          collab={c}
                          onChangeRole={p => handleChangeRole(i, p)}
                          onRemove={() => handleRemove(i)}
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

                {/* Email invite field */}
                <View style={invStyles.searchWrap}>
                  <Feather name="mail" size={15} color={colors.muted} style={{ marginRight: 6 }} />
                  <TextInput
                    style={invStyles.searchInput}
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Enter email to invite…"
                    placeholderTextColor={colors.subtle}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    onSubmitEditing={handleInvite}
                  />
                </View>

                {/* Pinned invite button */}
                <TouchableOpacity
                  style={[invStyles.inviteBtn, (!canInvite || inviting) && invStyles.inviteBtnDisabled]}
                  onPress={handleInvite}
                  disabled={!canInvite || inviting}
                >
                  <Text style={invStyles.inviteBtnText}>
                    {inviting ? "Inviting…" : inviteSent ? "Invite sent ✓" : "Invite"}
                  </Text>
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
  onMoveUp, onMoveDown, onDraggingChange, onDragMove,
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
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDraggingChange?: (v: boolean) => void;
  onDragMove?: (dy: number) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const cardPan = useRef(new Animated.ValueXY()).current;
  const photoUrl = `https://picsum.photos/seed/${adventureId}-${day.dayNumber}/800/500`;

  const isDraggingRef  = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const THRESHOLD      = 60;
  const LONG_PRESS_MS  = 400;

  const cbStop = useRef({ onMoveUp, onMoveDown, onDraggingChange, onDragMove });
  cbStop.current = { onMoveUp, onMoveDown, onDraggingChange, onDragMove };

  const stopPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => isDraggingRef.current,
    onPanResponderTerminationRequest: () => !isDraggingRef.current,

    onPanResponderGrant: () => {
      longPressTimer.current = setTimeout(() => {
        isDraggingRef.current = true;
        Vibration.vibrate(30);
        setIsDragging(true);
        cbStop.current.onDraggingChange?.(true);
      }, LONG_PRESS_MS);
    },

    onPanResponderMove: (_, g) => {
      if (!isDraggingRef.current) {
        if (Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10) {
          if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
        }
        return;
      }
      // Route tile only moves vertically
      cardPan.setValue({ x: 0, y: g.dy });
      cbStop.current.onDragMove?.(g.dy);
    },

    onPanResponderRelease: (_, g) => {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      cbStop.current.onDraggingChange?.(false);
      if (g.dy < -THRESHOLD) cbStop.current.onMoveUp?.();
      else if (g.dy > THRESHOLD) cbStop.current.onMoveDown?.();
      Animated.spring(cardPan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },

    onPanResponderTerminate: () => {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      cbStop.current.onDraggingChange?.(false);
      Animated.spring(cardPan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },
  })).current;

  return (
    <Animated.View
      {...stopPan.panHandlers}
      style={[
        { transform: cardPan.getTranslateTransform() },
        isDragging && { zIndex: 100 },
      ]}
    >
      <Animated.View style={[
        tileStyles.card,
        { borderColor: colors.sage, shadowColor: colors.sage, shadowOffset: { width: 0, height: 0 }, shadowRadius: 10, shadowOpacity: 0.45 },
        isDragging && { elevation: 24, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } },
      ]}>
        <View style={tileStyles.photoWrap}>
          <Image source={{ uri: photoUrl }} style={tileStyles.photo} resizeMode="cover" />
          {/* Camera button */}
          <TouchableOpacity style={tileStyles.cameraBtn} onPress={onAddPhoto}>
            <Feather name="camera" size={14} color={colors.muted} />
          </TouchableOpacity>
        </View>
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
          <TouchableOpacity style={tileStyles.actionBtn} onPress={onConnectRoute}>
            <MaterialCommunityIcons name="routes" size={14} color={colors.text} />
            <Text style={tileStyles.actionText}>Route</Text>
          </TouchableOpacity>
          <TouchableOpacity style={tileStyles.actionBtn} onPress={onShare}>
            <Feather name="share-2" size={13} color={colors.text} />
            <Text style={tileStyles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Review section */}
        <ReviewSection review={review} onRate={onRate} onComment={onComment} photos={photos} onAddPhoto={onAddPhoto} />
      </Animated.View>
    </Animated.View>
  );
}

// ─── Accommodation tile ───────────────────────────────────────────────────────

function AccommodationCard({ accomOpt, meta, adventureId, dayNumber, totalDays, onMovedToDay, onAddPhoto, onPreviewDay, onMoveUp, onMoveDown, onDraggingChange, onDragMove }: {
  accomOpt: { name: string; price_per_night_eur?: number; booking_url?: string } | null;
  meta: TripMeta;
  adventureId: string;
  dayNumber: number;
  totalDays: number;
  onMovedToDay: (fromDay: number, toDay: number, type: "accommodation", index: number) => void;
  onAddPhoto?: () => void;
  onPreviewDay?: (dir: "left" | "right") => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDraggingChange?: (v: boolean) => void;
  onDragMove?: (dy: number) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const cardPan = useRef(new Animated.ValueXY()).current;
  const photoUrl = `https://picsum.photos/seed/${adventureId}-accom/800/500`;

  const isDraggingRef  = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dayTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewDayRef  = useRef(dayNumber);
  const dayRepeatRef   = useRef(false);
  const lastDirRef     = useRef<"left" | "right" | null>(null);
  const THRESHOLD      = 60;
  const LONG_PRESS_MS  = 400;
  const DAY_SWITCH_MS  = 500;
  const DAY_REPEAT_MS  = 200;
  const EDGE_ZONE      = 80;

  const cbAccom = useRef({
    onDragToDay: (targetDay: number) => onMovedToDay(dayNumber, targetDay, "accommodation", 0),
    onMoveUp, onMoveDown, onDraggingChange, onPreviewDay, onDragMove,
    disabled: totalDays <= 1,
  });
  cbAccom.current = {
    onDragToDay: (targetDay: number) => onMovedToDay(dayNumber, targetDay, "accommodation", 0),
    onMoveUp, onMoveDown, onDraggingChange, onPreviewDay, onDragMove,
    disabled: totalDays <= 1,
  };

  const accomPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !cbAccom.current.disabled,
    onMoveShouldSetPanResponder:  () => isDraggingRef.current,
    onPanResponderTerminationRequest: () => !isDraggingRef.current,

    onPanResponderGrant: () => {
      previewDayRef.current = dayNumber;
      dayRepeatRef.current = false;
      longPressTimer.current = setTimeout(() => {
        isDraggingRef.current = true;
        Vibration.vibrate(30);
        setIsDragging(true);
        cbAccom.current.onDraggingChange?.(true);
      }, LONG_PRESS_MS);
    },

    onPanResponderMove: (_, g) => {
      if (!isDraggingRef.current) {
        if (Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10) {
          if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
        }
        return;
      }
      cardPan.setValue({ x: g.dx, y: g.dy });
      cbAccom.current.onDragMove?.(g.dy);
      const isHoriz = Math.abs(g.dx) >= Math.abs(g.dy);
      const nearLeft  = g.moveX < EDGE_ZONE;
      const nearRight = g.moveX > SCREEN_W - EDGE_ZONE;
      if (isHoriz && (nearLeft || nearRight)) {
        const dir = nearLeft ? "left" : "right";
        if (!dayTimer.current) {
          lastDirRef.current = dir;
          const delay = dayRepeatRef.current ? DAY_REPEAT_MS : DAY_SWITCH_MS;
          dayTimer.current = setTimeout(() => {
            const nextDay = dir === "left"
              ? Math.max(1, previewDayRef.current - 1)
              : Math.min(totalDays, previewDayRef.current + 1);
            if (nextDay !== previewDayRef.current) {
              previewDayRef.current = nextDay;
              dayRepeatRef.current = true;
              cbAccom.current.onPreviewDay?.(dir);
            }
            dayTimer.current = null;
          }, delay);
        }
      } else {
        if (dayTimer.current) { clearTimeout(dayTimer.current); dayTimer.current = null; }
      }
    },

    onPanResponderRelease: (_, g) => {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
      if (dayTimer.current) { clearTimeout(dayTimer.current); dayTimer.current = null; }
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      cbAccom.current.onDraggingChange?.(false);
      if (previewDayRef.current !== dayNumber) {
        cbAccom.current.onDragToDay(previewDayRef.current);
      } else {
        const isHoriz = Math.abs(g.dx) >= Math.abs(g.dy);
        if (!isHoriz) {
          if (g.dy < -THRESHOLD) cbAccom.current.onMoveUp?.();
          else if (g.dy > THRESHOLD) cbAccom.current.onMoveDown?.();
        }
      }
      previewDayRef.current = dayNumber;
      dayRepeatRef.current = false;
      Animated.spring(cardPan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },

    onPanResponderTerminate: () => {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
      if (dayTimer.current) { clearTimeout(dayTimer.current); dayTimer.current = null; }
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      cbAccom.current.onDraggingChange?.(false);
      previewDayRef.current = dayNumber;
      dayRepeatRef.current = false;
      Animated.spring(cardPan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },
  })).current;

  return (
    <Animated.View
      {...accomPan.panHandlers}
      style={[
        { transform: cardPan.getTranslateTransform() },
        isDragging && { zIndex: 100 },
      ]}
    >
      <Animated.View style={[
        tileStyles.card,
        { borderColor: colors.accent, shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 }, shadowRadius: 10, shadowOpacity: 0.45 },
        isDragging && { elevation: 24, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } },
      ]}>
        <View style={tileStyles.photoWrap}>
          <Image source={{ uri: photoUrl }} style={tileStyles.photo} resizeMode="cover" />
          {/* Camera button */}
          {onAddPhoto && (
            <TouchableOpacity style={tileStyles.cameraBtn} onPress={onAddPhoto}>
              <Feather name="camera" size={14} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
        <View style={tileStyles.info}>
          <Text style={tileStyles.title}>{accomOpt?.name ?? meta.accommodation}</Text>
          <View style={tileStyles.infoRow}>
            <Feather name="moon" size={11} color={colors.muted} />
            <Text style={tileStyles.infoText}>{meta.nights}</Text>
          </View>
          {(accomOpt?.price_per_night_eur ?? meta.pricePerNight) > 0 && (
            <View style={tileStyles.infoRow}>
              <Feather name="tag" size={11} color={colors.muted} />
              <Text style={tileStyles.infoText}>From €{accomOpt?.price_per_night_eur ?? meta.pricePerNight}/night</Text>
            </View>
          )}
        </View>
        <View style={tileStyles.actionRow}>
          <TouchableOpacity
            style={tileStyles.actionBtn}
            onPress={() => {
              const url = accomOpt?.booking_url ?? meta.accommodationUrl;
              if (url) Linking.openURL(url);
              else Alert.alert("Not available", "No booking details found.");
            }}
          >
            <Feather name="info" size={13} color={colors.text} />
            <Text style={tileStyles.actionText}>View details</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={tileStyles.actionBtn}
            onPress={() => {
              const url = accomOpt?.booking_url ?? meta.accommodationUrl;
              if (url) Linking.openURL(url);
              else Alert.alert("Not available", "No booking link for this accommodation.");
            }}
          >
            <Feather name="external-link" size={13} color={colors.text} />
            <Text style={tileStyles.actionText}>Book</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Restaurant tile ──────────────────────────────────────────────────────────

function RestaurantCard({ restaurant, adventureId, idx, dayNumber, totalDays, onMovedToDay, isLast, onMoveUp, onMoveDown, onAddPhoto, onPreviewDay, onDraggingChange, onDragMove }: {
  restaurant: RestaurantStop;
  adventureId: string;
  idx: number;
  dayNumber: number;
  totalDays: number;
  onMovedToDay: (fromDay: number, toDay: number, type: "restaurant", index: number) => void;
  isLast?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onAddPhoto?: () => void;
  onPreviewDay?: (dir: "left" | "right") => void;
  onDraggingChange?: (v: boolean) => void;
  onDragMove?: (dy: number) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const cardPan = useRef(new Animated.ValueXY()).current;
  const photoUrl = `https://picsum.photos/seed/${adventureId}-rest${idx}/800/500`;

  const isDraggingRef    = useRef(false);
  const longPressTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dayTimer         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewDayRef    = useRef(dayNumber);
  const dayRepeatRef     = useRef(false);
  const lastDirRef       = useRef<"left" | "right" | null>(null);
  const THRESHOLD        = 60;
  const LONG_PRESS_MS    = 400;
  const DAY_SWITCH_MS    = 500;
  const DAY_REPEAT_MS    = 200;
  const EDGE_ZONE        = 80;

  const cbRest = useRef({
    onMoveUp, onMoveDown,
    onDragToDay: (targetDay: number) => onMovedToDay(dayNumber, targetDay, "restaurant", idx),
    onDraggingChange, onPreviewDay, onDragMove,
    disabled: totalDays <= 1,
  });
  cbRest.current = {
    onMoveUp, onMoveDown,
    onDragToDay: (targetDay: number) => onMovedToDay(dayNumber, targetDay, "restaurant", idx),
    onDraggingChange, onPreviewDay, onDragMove,
    disabled: totalDays <= 1,
  };

  const restPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !cbRest.current.disabled,
    onMoveShouldSetPanResponder:  () => isDraggingRef.current,
    onPanResponderTerminationRequest: () => !isDraggingRef.current,

    onPanResponderGrant: () => {
      previewDayRef.current = dayNumber;
      dayRepeatRef.current = false;
      longPressTimer.current = setTimeout(() => {
        isDraggingRef.current = true;
        Vibration.vibrate(30);
        setIsDragging(true);
        cbRest.current.onDraggingChange?.(true);
      }, LONG_PRESS_MS);
    },

    onPanResponderMove: (_, g) => {
      if (!isDraggingRef.current) {
        if (Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10) {
          if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
        }
        return;
      }
      cardPan.setValue({ x: g.dx, y: g.dy });
      cbRest.current.onDragMove?.(g.dy);
      const isHoriz = Math.abs(g.dx) >= Math.abs(g.dy);
      const nearLeft  = g.moveX < EDGE_ZONE;
      const nearRight = g.moveX > SCREEN_W - EDGE_ZONE;
      if (isHoriz && (nearLeft || nearRight)) {
        const dir = nearLeft ? "left" : "right";
        if (!dayTimer.current) {
          lastDirRef.current = dir;
          const delay = dayRepeatRef.current ? DAY_REPEAT_MS : DAY_SWITCH_MS;
          dayTimer.current = setTimeout(() => {
            const nextDay = dir === "left"
              ? Math.max(1, previewDayRef.current - 1)
              : Math.min(totalDays, previewDayRef.current + 1);
            if (nextDay !== previewDayRef.current) {
              previewDayRef.current = nextDay;
              dayRepeatRef.current = true;
              cbRest.current.onPreviewDay?.(dir);
            }
            dayTimer.current = null;
          }, delay);
        }
      } else {
        if (dayTimer.current) { clearTimeout(dayTimer.current); dayTimer.current = null; }
      }
    },

    onPanResponderRelease: (_, g) => {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
      if (dayTimer.current) { clearTimeout(dayTimer.current); dayTimer.current = null; }
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      cbRest.current.onDraggingChange?.(false);
      if (previewDayRef.current !== dayNumber) {
        cbRest.current.onDragToDay(previewDayRef.current);
      } else {
        const isHoriz = Math.abs(g.dx) >= Math.abs(g.dy);
        if (!isHoriz) {
          if (g.dy < -THRESHOLD) cbRest.current.onMoveUp?.();
          else if (g.dy > THRESHOLD) cbRest.current.onMoveDown?.();
        }
      }
      previewDayRef.current = dayNumber;
      dayRepeatRef.current = false;
      Animated.spring(cardPan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },

    onPanResponderTerminate: () => {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
      if (dayTimer.current) { clearTimeout(dayTimer.current); dayTimer.current = null; }
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      cbRest.current.onDraggingChange?.(false);
      previewDayRef.current = dayNumber;
      dayRepeatRef.current = false;
      Animated.spring(cardPan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },
  })).current;

  return (
    <Animated.View
      {...restPan.panHandlers}
      style={[
        { transform: cardPan.getTranslateTransform() },
        isDragging && { zIndex: 100 },
      ]}
    >
      <Animated.View style={[
        tileStyles.card,
        { borderColor: colors.blend, shadowColor: colors.blend, shadowOffset: { width: 0, height: 0 }, shadowRadius: 10, shadowOpacity: 0.45 },
        isDragging && { elevation: 24, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } },
      ]}>
        <View style={tileStyles.photoWrap}>
          <Image source={{ uri: photoUrl }} style={tileStyles.photo} resizeMode="cover" />
          {/* Camera button */}
          {onAddPhoto && (
            <TouchableOpacity style={tileStyles.cameraBtn} onPress={onAddPhoto}>
              <Feather name="camera" size={14} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
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
          <TouchableOpacity
            style={tileStyles.actionBtn}
            onPress={() => {
              const url = restaurant.websiteUrl ?? restaurant.googleMapsUrl;
              if (url) Linking.openURL(url);
              else Alert.alert("Not available", "No menu link for this restaurant.");
            }}
          >
            <Feather name="info" size={13} color={colors.text} />
            <Text style={tileStyles.actionText}>View menu</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={tileStyles.actionBtn}
            onPress={() => {
              const url = restaurant.theforkUrl ?? restaurant.websiteUrl ?? restaurant.googleMapsUrl;
              if (url) Linking.openURL(url);
              else Alert.alert("Not available", "No reservation link for this restaurant.");
            }}
          >
            <Feather name="external-link" size={13} color={colors.text} />
            <Text style={tileStyles.actionText}>Reserve</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [showRoutes, setShowRoutes]             = useState(true);
  const [showAccommodation, setShowAccommodation] = useState(true);
  const [showRestaurants, setShowRestaurants]   = useState(true);

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
          {routeGeoJSON && showRoutes && (
            <MapboxGL.ShapeSource id="tripRoute" shape={routeGeoJSON}>
              <MapboxGL.LineLayer id="tripRouteLine" style={{ lineColor: colors.accent, lineWidth: 2, lineDasharray: [2, 2], lineOpacity: 0.8 }} />
            </MapboxGL.ShapeSource>
          )}

          {/* Restaurant dots — canvas (smallest, always below activity & accommodation) */}
          {restaurantGeoJSON && showRestaurants && (
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
          {meta?.accommodationCoords && showAccommodation && (
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
          <TouchableOpacity style={mapStyles.iconBtn} onPress={() => setFilterOpen(v => !v)}>
            <Feather name="sliders" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Filter sheet */}
        {filterOpen && (
          <View style={[mapStyles.filterSheet, { top: insets.top + 56 }]}>
            <Text style={mapStyles.filterTitle}>Map layers</Text>
            {([
              { label: "Routes", value: showRoutes, setter: setShowRoutes, color: colors.accent },
              { label: "Accommodation", value: showAccommodation, setter: setShowAccommodation, color: colors.ocean },
              { label: "Restaurants", value: showRestaurants, setter: setShowRestaurants, color: colors.gold },
            ] as Array<{ label: string; value: boolean; setter: (v: boolean) => void; color: string }>).map(row => (
              <TouchableOpacity key={row.label} style={mapStyles.filterRow} onPress={() => row.setter(!row.value)}>
                <View style={[mapStyles.filterDot, { backgroundColor: row.color }]} />
                <Text style={mapStyles.filterLabel}>{row.label}</Text>
                <View style={[mapStyles.filterToggle, row.value && { backgroundColor: colors.accent }]}>
                  <View style={[mapStyles.filterThumb, row.value && { alignSelf: "flex-end" }]} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

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

// ─── Edit trip modal ──────────────────────────────────────────────────────────

function EditTripModal({
  adventure, visible, onClose, onSave, onDelete,
}: {
  adventure: AdventureRow;
  visible: boolean;
  onClose: () => void;
  onSave: (fields: { title: string; startDate: string | null; description: string }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [title, setTitle]           = useState(adventure.title);
  const [startDate, setStartDate]   = useState(adventure.startDate ?? "");
  const [description, setDescription] = useState(adventure.description ?? "");
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle(adventure.title);
      setStartDate(adventure.startDate ?? "");
      setDescription(adventure.description ?? "");
    }
  }, [visible, adventure]);

  function handleDelete() {
    Alert.alert(
      "Delete trip",
      "This will permanently delete your trip. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDelete() },
      ],
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={editStyles.sheet}>
          <View style={editStyles.handle} />
          <View style={editStyles.headerRow}>
            <Text style={editStyles.headerTitle}>Edit Trip</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={editStyles.label}>Title</Text>
          <TextInput
            style={editStyles.input}
            value={title}
            onChangeText={setTitle}
            placeholderTextColor={colors.muted}
          />

          <Text style={editStyles.label}>Start date (YYYY-MM-DD)</Text>
          <TextInput
            style={editStyles.input}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="Leave empty if not set"
            placeholderTextColor={colors.muted}
          />

          <Text style={editStyles.label}>Description</Text>
          <TextInput
            style={[editStyles.input, { height: 80, textAlignVertical: "top" }]}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholderTextColor={colors.muted}
          />

          <TouchableOpacity
            style={[editStyles.saveBtn, saving && { opacity: 0.6 }]}
            disabled={saving}
            onPress={async () => {
              setSaving(true);
              try {
                await onSave({ title, startDate: startDate.trim() || null, description });
                onClose();
              } catch {
                Alert.alert("Error", "Could not save changes. Please try again.");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving
              ? <ActivityIndicator color={colors.inverse} size="small" />
              : <Text style={editStyles.saveBtnText}>Save changes</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={editStyles.deleteBtn} onPress={handleDelete}>
            <Feather name="trash-2" size={15} color="#E53E3E" />
            <Text style={editStyles.deleteBtnText}>Delete trip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const editStyles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.sheet,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: spacing.xxl ?? 40,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: spacing.lg,
  },
  headerTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  label:       { fontSize: fontSize.sm, fontWeight: "600", color: colors.muted, marginBottom: spacing.xs },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    padding: spacing.sm, fontSize: fontSize.base, color: colors.text, marginBottom: spacing.md,
  },
  saveBtn: {
    backgroundColor: colors.text, borderRadius: radius.full,
    paddingVertical: spacing.sm + 2, alignItems: "center", marginBottom: spacing.sm,
  },
  saveBtnText:   { color: colors.inverse, fontWeight: "700", fontSize: fontSize.base },
  deleteBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: spacing.sm },
  deleteBtnText: { color: "#E53E3E", fontWeight: "600", fontSize: fontSize.sm },
});

// ─── Add Item Modal ───────────────────────────────────────────────────────────

type ItemType = "stay" | "restaurant" | "activity";

const ITEM_TYPES: { id: ItemType; label: string; icon: string }[] = [
  { id: "stay",       label: "Stay",       icon: "🏨" },
  { id: "restaurant", label: "Restaurant", icon: "🍽️" },
  { id: "activity",   label: "Activity",   icon: "🏃" },
];

function AddItemModal({
  dayNumber,
  adventureId,
  onSave,
  onClose,
}: {
  dayNumber: number;
  adventureId: string;
  onSave: (item: import("../../../lib/api").CustomItem) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [selectedType, setSelectedType] = useState<ItemType>("activity");
  const [link, setLink]         = useState("");
  const [scraping, setScraping] = useState(false);
  const [name, setName]         = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes]       = useState("");
  const [rating, setRating]     = useState(0);
  const [photos, setPhotos]     = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]     = useState(false);

  async function handleScrape() {
    const url = link.trim();
    if (!url) return;
    setScraping(true);
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
      const json = await res.json() as { contents?: string };
      const html = json.contents ?? "";
      const getOg = (prop: string) => {
        const match = html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, "i"))
          ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, "i"));
        return match?.[1] ?? "";
      };
      const ogTitle = getOg("title");
      const ogDesc  = getOg("description");
      if (ogTitle && !name) setName(ogTitle);
      if (ogDesc  && !notes) setNotes(ogDesc.slice(0, 200));
    } catch {
      /* graceful fallback — user can fill manually */
    } finally {
      setScraping(false);
    }
  }

  async function handleAddPhoto() {
    const uri = await pickImage([4, 3]);
    if (!uri) return;
    setUploading(true);
    const url = await uploadReviewPhoto(`${adventureId}-custom-${Date.now()}`, uri);
    setUploading(false);
    if (url) setPhotos(prev => [...prev, url]);
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert("Name required", "Please enter a name for this item."); return; }
    setSaving(true);
    try {
      onSave({
        id: `custom_${Date.now()}`,
        name: name.trim(),
        type: selectedType,
        location: location.trim() || null,
        photos,
        notes: notes.trim() || null,
        rating: rating > 0 ? rating : null,
        sourceUrl: link.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={addItemStyles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[addItemStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={addItemStyles.handle} />
          <View style={addItemStyles.headerRow}>
            <Text style={addItemStyles.title}>Add to Day {dayNumber}</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Type selector */}
            <View style={addItemStyles.typeRow}>
              {ITEM_TYPES.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[addItemStyles.typeBtn, selectedType === t.id && addItemStyles.typeBtnActive]}
                  onPress={() => setSelectedType(t.id)}
                  activeOpacity={0.75}
                >
                  <Text style={addItemStyles.typeIcon}>{t.icon}</Text>
                  <Text style={[addItemStyles.typeLabel, selectedType === t.id && addItemStyles.typeLabelActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* URL scraper */}
            <Text style={addItemStyles.label}>Link (optional)</Text>
            <View style={addItemStyles.linkRow}>
              <TextInput
                style={[addItemStyles.input, { flex: 1 }]}
                value={link}
                onChangeText={setLink}
                placeholder="Paste a URL to auto-fill…"
                placeholderTextColor={colors.subtle}
                autoCapitalize="none"
                keyboardType="url"
              />
              <TouchableOpacity
                style={[addItemStyles.fetchBtn, scraping && { opacity: 0.5 }]}
                onPress={handleScrape}
                disabled={scraping}
              >
                {scraping
                  ? <ActivityIndicator size="small" color={colors.inverse} />
                  : <Text style={addItemStyles.fetchText}>Fetch</Text>
                }
              </TouchableOpacity>
            </View>

            {/* Name */}
            <Text style={addItemStyles.label}>Name *</Text>
            <TextInput
              style={addItemStyles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Rifugio Auronzo"
              placeholderTextColor={colors.subtle}
            />

            {/* Location */}
            <Text style={addItemStyles.label}>Location</Text>
            <TextInput
              style={addItemStyles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="e.g. Cortina d'Ampezzo"
              placeholderTextColor={colors.subtle}
            />

            {/* Photo picker */}
            <Text style={addItemStyles.label}>Photos</Text>
            <View style={addItemStyles.photoRow}>
              {photos.map((url, i) => (
                <Image key={i} source={{ uri: url }} style={addItemStyles.photoThumb} />
              ))}
              <TouchableOpacity
                style={[addItemStyles.addPhotoBtn, uploading && { opacity: 0.5 }]}
                onPress={handleAddPhoto}
                disabled={uploading}
              >
                {uploading
                  ? <ActivityIndicator size="small" color={colors.muted} />
                  : <Feather name="camera" size={20} color={colors.muted} />
                }
              </TouchableOpacity>
            </View>

            {/* Notes */}
            <Text style={addItemStyles.label}>Notes</Text>
            <TextInput
              style={[addItemStyles.input, { minHeight: 70, textAlignVertical: "top" }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any notes or tips…"
              placeholderTextColor={colors.subtle}
              multiline
            />

            {/* Star rating */}
            <Text style={addItemStyles.label}>Rating</Text>
            <View style={addItemStyles.starRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setRating(n)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialCommunityIcons
                    name={n <= rating ? "star" : "star-outline"}
                    size={28}
                    color={n <= rating ? "#F59E0B" : colors.border}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={addItemStyles.actionRow}>
            <TouchableOpacity style={addItemStyles.cancelBtn} onPress={onClose}>
              <Text style={addItemStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[addItemStyles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={colors.inverse} size="small" />
                : <Text style={addItemStyles.saveText}>Add to Day {dayNumber}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const addItemStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.md, maxHeight: "90%",
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.md },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  typeRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  typeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 10, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg,
  },
  typeBtnActive: { backgroundColor: colors.text, borderColor: colors.text },
  typeIcon: { fontSize: 16 },
  typeLabel: { fontSize: fontSize.sm, fontWeight: "600", color: colors.muted },
  typeLabelActive: { color: colors.inverse },
  label: { fontSize: fontSize.xs, fontWeight: "600", color: colors.muted, marginBottom: 4, marginTop: spacing.sm, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.sm, paddingVertical: 10,
    fontSize: fontSize.base, color: colors.text, marginBottom: 2,
  },
  linkRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  fetchBtn: {
    backgroundColor: colors.text, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  fetchText: { color: colors.inverse, fontWeight: "700", fontSize: fontSize.sm },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: 2 },
  photoThumb: { width: 64, height: 64, borderRadius: radius.md },
  addPhotoBtn: {
    width: 64, height: 64, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
  },
  starRow: { flexDirection: "row", gap: 4, marginBottom: spacing.sm },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border, alignItems: "center",
  },
  cancelText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text },
  saveBtn: {
    flex: 2, paddingVertical: 14, borderRadius: radius.full,
    backgroundColor: colors.accent, alignItems: "center",
  },
  saveText: { color: colors.inverse, fontWeight: "700", fontSize: fontSize.sm },
});

// ─── Custom item card ─────────────────────────────────────────────────────────

const CUSTOM_STRIPE: Record<ItemType, string> = {
  stay: colors.coral,
  restaurant: colors.coral,
  activity: colors.sky,
};

function CustomItemCard({ item }: { item: import("../../../lib/api").CustomItem }) {
  const stripeColor = CUSTOM_STRIPE[item.type] ?? colors.muted;
  return (
    <View style={[tileStyles.card, { overflow: "hidden" }]}>
      {item.photos && item.photos.length > 0 && (
        <View style={tileStyles.photoWrap}>
          <Image source={{ uri: item.photos[0] }} style={tileStyles.photo} resizeMode="cover" />
        </View>
      )}
      <View style={tileStyles.info}>
        <Text style={tileStyles.title}>{item.name}</Text>
        {item.location ? (
          <View style={tileStyles.infoRow}>
            <Feather name="map-pin" size={11} color={colors.muted} />
            <Text style={tileStyles.infoText}>{item.location}</Text>
          </View>
        ) : null}
        {item.rating ? (
          <View style={tileStyles.infoRow}>
            <MaterialCommunityIcons name="star" size={11} color="#F59E0B" />
            <Text style={tileStyles.infoText}>{item.rating}/5</Text>
          </View>
        ) : null}
        {item.notes ? (
          <Text style={[tileStyles.infoText, { marginTop: 2 }]}>{item.notes}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TripDetailScreen() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const insets   = useSafeAreaInsets();
  const router   = useRouter();

  const [adventure, setAdventure]         = useState<AdventureRow | null>(null);
  const [allAdventures, setAllAdventures] = useState<AdventureRow[]>([]);
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
  const [editVisible, setEditVisible]     = useState(false);
  const [addItemDay, setAddItemDay]       = useState<number | null>(null);
  const [swipeEnabled, setSwipeEnabled]   = useState(true);
  const [localTileOrder, setLocalTileOrder] = useState<Record<number, TileId[]>>({});
  const dayListRef      = useRef<FlatList<AdventureDayRow>>(null);
  const heroCarouselRef = useRef<FlatList<AdventureRow>>(null);
  const swipeCooldown   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipScrollRef   = useRef(false);
  const heroOffset      = useRef(new Animated.Value(0)).current;
  // Hover-push drag tracking
  const tileHeightsRef    = useRef<Record<string, number>>({});
  const dragBaseOrderRef  = useRef<Record<number, TileId[]>>({});
  const lastHoverSlotRef  = useRef<Record<number, number>>({});

  // Must be before any early return — Rules of Hooks
  const sortedDays = React.useMemo(
    () => [...(adventure?.adventure_days ?? [])].sort((a, b) => a.dayNumber - b.dayNumber),
    [adventure],
  );

  // Sync FlatList position when selectedDay changes via chip tap
  useEffect(() => {
    if (skipScrollRef.current) { skipScrollRef.current = false; return; }
    const idx = sortedDays.findIndex(d => d.dayNumber === selectedDay);
    if (idx >= 0) dayListRef.current?.scrollToIndex({ index: idx, animated: true });
  }, [selectedDay, sortedDays]);

  useEffect(() => {
    setAdventure(null);      // clear stale content immediately → shows spinner
    setSelectedDay(1);
    heroOffset.setValue(0);
    setLoadError(false);
    async function load() {
      try {
        // Try own adventures first (may fail if not logged in — that's fine)
        let isOwn = false;
        let myAdventures: AdventureRow[] = [];
        try {
          myAdventures = await getMyAdventures();
          isOwn = myAdventures.some(a => a.id === id);
        } catch { /* not logged in or no adventures */ }

        // Sort: current → upcoming → past (same order as My Trips screen)
        const sorted = [...myAdventures].sort((a, b) => {
          const sa = a.startDate ? (new Date(a.startDate) <= new Date() ? 0 : 1) : 1;
          const sb = b.startDate ? (new Date(b.startDate) <= new Date() ? 0 : 1) : 1;
          return sa - sb || (a.startDate ?? "").localeCompare(b.startDate ?? "");
        });
        setAllAdventures(sorted);

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

  const meta        = deriveMetaMeta(adventure);
  const actIconName = (ACTIVITY_ICON[adventure.activityType] ?? "map-marker-outline") as React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  const heroDisplayUrl = coverUrl ?? adventure.coverImageUrl ?? `https://picsum.photos/seed/${adventure.id}/800/600`;
  const isOwner     = isOwnAdventure;
  const today       = new Date().toISOString().split("T")[0];
  const isActive    = !!(adventure.startDate && adventure.endDate && today >= adventure.startDate && today <= adventure.endDate);

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

  async function handleSaveTrip(fields: { title: string; startDate: string | null; description: string }) {
    if (!adventure) return;
    await updateAdventure(adventure.id, fields);
    setAdventure(prev => prev ? { ...prev, ...fields } : prev);
  }

  async function handleDeleteTrip() {
    if (!adventure) return;
    await deleteAdventure(adventure.id);
    router.back();
  }

  async function handleActivityMovedToDay(
    fromDay: number,
    toDay: number,
    type: "restaurant" | "accommodation",
    index: number,
  ) {
    if (!adventure) return;
    const snapshot = adventure;

    // Optimistic update — reflect the move immediately in local state
    const newDays = adventure.adventure_days.map(d => {
      if (d.dayNumber === fromDay) {
        const alts = { ...(d.alternatives ?? {}) };
        if (type === "restaurant") {
          type RestRow = NonNullable<NonNullable<AdventureDayRow["alternatives"]>["restaurants"]>[number];
          const rests = [...((alts.restaurants as RestRow[] | undefined) ?? [])];
          rests.splice(index, 1);
          alts.restaurants = rests;
          const to = alts.tileOrder as string[] | undefined;
          if (to) {
            alts.tileOrder = to
              .filter(t => t !== `rest:${index}`)
              .map(t => {
                if (!t.startsWith("rest:")) return t;
                const n = parseInt(t.slice(5), 10);
                return n > index ? `rest:${n - 1}` : t;
              });
          }
        } else {
          type OptRow = NonNullable<NonNullable<NonNullable<AdventureDayRow["alternatives"]>["accommodationStop"]>["options"]>[number];
          const accom = alts.accommodationStop as { options?: OptRow[] } | null;
          const opts: OptRow[] = [...(accom?.options ?? [])];
          opts.splice(index, 1);
          alts.accommodationStop = { ...(accom ?? {}), options: opts };
          const to = alts.tileOrder as string[] | undefined;
          if (to && opts.length === 0) alts.tileOrder = to.filter(t => t !== "accommodation");
        }
        return { ...d, alternatives: alts };
      }
      if (d.dayNumber === toDay) {
        const alts = { ...(d.alternatives ?? {}) };
        if (type === "restaurant") {
          type RestRow = NonNullable<NonNullable<AdventureDayRow["alternatives"]>["restaurants"]>[number];
          const moved = snapshot.adventure_days
            .find(sd => sd.dayNumber === fromDay)
            ?.alternatives?.restaurants?.[index] as RestRow | undefined;
          if (moved) {
            const rests: RestRow[] = [...((alts.restaurants as RestRow[] | undefined) ?? []), moved];
            alts.restaurants = rests;
            const to = alts.tileOrder as string[] | undefined;
            if (to) alts.tileOrder = [...to, `rest:${rests.length - 1}`];
          }
        } else {
          type OptRow = NonNullable<NonNullable<NonNullable<AdventureDayRow["alternatives"]>["accommodationStop"]>["options"]>[number];
          const srcAccom = snapshot.adventure_days
            .find(sd => sd.dayNumber === fromDay)
            ?.alternatives?.accommodationStop as { options?: OptRow[] } | null;
          const moved = srcAccom?.options?.[index];
          if (moved) {
            const accom = alts.accommodationStop as { options?: OptRow[] } | null;
            alts.accommodationStop = {
              ...(accom ?? {}),
              options: [moved, ...(accom?.options ?? [])],
            };
            const to = alts.tileOrder as string[] | undefined;
            if (to && !to.includes("accommodation")) alts.tileOrder = ["accommodation", ...to];
          }
        }
        return { ...d, alternatives: alts };
      }
      return d;
    });

    setAdventure(prev => prev ? { ...prev, adventure_days: newDays } : prev);
    setLocalTileOrder(prev => {
      const next = { ...prev };
      delete next[fromDay];
      delete next[toDay];
      return next;
    });

    try {
      await moveActivity(adventure.id, fromDay, toDay, type, index);
    } catch {
      // Rollback on API failure
      setAdventure(snapshot);
    }
  }

  async function handleAddItem(dayNumber: number, item: CustomItem) {
    if (!adventure) return;
    const day = adventure.adventure_days.find(d => d.dayNumber === dayNumber);
    if (!day) return;
    const existing: CustomItem[] = (day.alternatives?.customItems ?? []) as CustomItem[];
    const updated = [...existing, item];
    await updateDayCustomItems(adventure.id, dayNumber, updated);
    // Update local state so the new tile appears instantly
    setAdventure(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        adventure_days: prev.adventure_days.map(d =>
          d.dayNumber === dayNumber
            ? { ...d, alternatives: { ...(d.alternatives ?? {}), customItems: updated } }
            : d,
        ),
      };
    });
    setAddItemDay(null);
  }

  function defaultTileOrder(dayNum: number, restaurants: RestaurantStop[]): TileId[] {
    const order: TileId[] = [];
    const dayRow = adventure?.adventure_days.find(d => d.dayNumber === dayNum);
    const hasAccom = !!((dayRow?.alternatives as { accommodationStop?: { options?: unknown[] } } | null)
      ?.accommodationStop?.options?.length);
    if (hasAccom) order.push("accommodation");
    restaurants.forEach((_, i) => order.push(`rest:${i}` as TileId));
    order.push("route");
    return order;
  }

  function handleTileDragMove(dayNum: number, dragTileId: TileId, dy: number) {
    if (!adventure) return;
    // Use the order captured when dragging started so fromSlot stays stable
    const base = dragBaseOrderRef.current[dayNum];
    if (!base) return;
    const fromSlot = base.indexOf(dragTileId);
    if (fromSlot < 0) return;
    const draggedH = tileHeightsRef.current[`${dayNum}:${dragTileId}`] ?? 120;
    const slotDelta = Math.round(dy / draggedH);
    const hoverSlot = Math.max(0, Math.min(base.length - 1, fromSlot + slotDelta));
    if (hoverSlot === lastHoverSlotRef.current[dayNum]) return;
    lastHoverSlotRef.current[dayNum] = hoverSlot;
    const newOrder = [...base];
    newOrder.splice(fromSlot, 1);
    newOrder.splice(hoverSlot, 0, dragTileId);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLocalTileOrder(prev => ({ ...prev, [dayNum]: newOrder }));
  }

  function moveTile(dayNum: number, tileId: TileId, direction: "up" | "down") {
    if (!adventure) return;
    const restaurants = meta.restaurants.filter(r => r.night === dayNum);
    const stored = (adventure.adventure_days.find(d => d.dayNumber === dayNum)
      ?.alternatives as { tileOrder?: TileId[] } | null)?.tileOrder;
    const current: TileId[] = localTileOrder[dayNum] ?? stored ?? defaultTileOrder(dayNum, restaurants);
    const idx = current.indexOf(tileId);
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || targetIdx < 0 || targetIdx >= current.length) return;
    const next = [...current];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setLocalTileOrder(prev => ({ ...prev, [dayNum]: next }));
    updateTileOrder(adventure.id, dayNum, next);
  }

  function handlePreviewDay(dir: "left" | "right") {
    const idx = sortedDays.findIndex(d => d.dayNumber === selectedDay);
    const targetIdx = dir === "left" ? idx - 1 : idx + 1;
    if (targetIdx >= 0 && targetIdx < sortedDays.length) {
      skipScrollRef.current = true;   // suppress useEffect double-scroll
      dayListRef.current?.scrollToIndex({ index: targetIdx, animated: true });
      setSelectedDay(sortedDays[targetIdx].dayNumber);
    }
  }

  async function handleAddActivityPhoto(
    dayNum: number,
    key: string,
    itemType?: "route" | "accommodation" | "restaurant",
    itemName?: string,
  ) {
    const uri = await pickImage([4, 3]);
    if (!uri) return;
    const url = await uploadReviewPhoto(`${adventure!.id}-${key}-${Date.now()}`, uri);
    if (!url) return;
    setReviewPhotos(prev => ({ ...prev, [dayNum]: [...(prev[dayNum] ?? []), url] }));
    // Vacation feed push: if trip is active and user is the owner, create an ActivityPost
    if (isActive && isOwner && itemType && itemName) {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;
      if (email) {
        createActivityPost({
          adventure_id: adventure!.id,
          user_email: email,
          item_name: itemName,
          item_type: itemType,
          day_number: dayNum,
          photos: [url],
        }).catch(() => {/* non-fatal */});
      }
    }
  }

  async function handleShareToFeed() {
    const allPhotos = Object.values(reviewPhotos).flat();
    if (allPhotos.length === 0) {
      Alert.alert("No photos yet", "Add photos to your activities first using the camera icon on each tile.");
      return;
    }
    Alert.alert(
      "Share to Feed",
      `Share ${allPhotos.length} photo${allPhotos.length !== 1 ? "s" : ""} from this trip to your feed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Share",
          onPress: async () => {
            try {
              await createPost({
                adventure_id: adventure!.id,
                caption: adventure!.title,
                media_urls: allPhotos,
              });
              Alert.alert("Shared!", "Your trip photos have been posted to the feed.");
            } catch {
              Alert.alert("Error", "Could not share to feed. Please try again.");
            }
          },
        },
      ],
    );
  }

  function handleDaySwipe(idx: number) {
    const day = sortedDays[idx];
    if (!day) return;
    skipScrollRef.current = true;   // suppress useEffect double-scroll after user swipe
    setSelectedDay(day.dayNumber);
    setSwipeEnabled(false);
    if (swipeCooldown.current) clearTimeout(swipeCooldown.current);
    swipeCooldown.current = setTimeout(() => setSwipeEnabled(true), 500);
  }

  return (
    <View style={[detailStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={detailStyles.header}>
        <TouchableOpacity style={detailStyles.headerBtn} onPress={() => router.navigate("/(app)/trips")}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={detailStyles.headerTitle}>Itinerary</Text>
        <View style={detailStyles.headerRight}>
          {isOwner && (
            <>
              <TouchableOpacity style={detailStyles.headerBtn} onPress={() => setEditVisible(true)}>
                <Feather name="edit-2" size={19} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={detailStyles.headerBtn} onPress={() => setInviteVisible(true)}>
                <Feather name="user-plus" size={20} color={colors.text} />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={detailStyles.headerBtn} onPress={() => setMapVisible(true)}>
            <Feather name="map" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hero — collapsible, driven by inner ScrollView scroll */}
      <Animated.View style={{
        height: heroOffset.interpolate({ inputRange: [0, HERO_H], outputRange: [HERO_H, 0], extrapolate: "clamp" }),
        overflow: "hidden",
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
        backgroundColor: colors.bg,
      }}>
        <View style={detailStyles.heroImageWrap}>
          {/* Trip photo carousel — swipe left/right to switch trips */}
          {allAdventures.length > 0 ? (
            <FlatList
              ref={heroCarouselRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              data={allAdventures}
              initialScrollIndex={Math.max(0, allAdventures.findIndex(a => a.id === id))}
              getItemLayout={(_, i) => ({ length: SCREEN_W - spacing.md * 2, offset: (SCREEN_W - spacing.md * 2) * i, index: i })}
              keyExtractor={a => a.id}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item.coverImageUrl ?? `https://picsum.photos/seed/${item.id}/800/600` }}
                  style={{ width: SCREEN_W - spacing.md * 2, height: HERO_H - spacing.sm }}
                  resizeMode="cover"
                />
              )}
              onMomentumScrollEnd={e => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - spacing.md * 2));
                const target = allAdventures[idx];
                if (target && target.id !== id) router.replace(`/(app)/trips/${target.id}` as never);
              }}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <Image source={{ uri: heroDisplayUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}
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
      </Animated.View>

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

      {/* Day chips — fixed */}
      <ItineraryDayTabs days={sortedDays} selectedDay={selectedDay} onSelect={setSelectedDay} />

      {/* Dot indicators */}
      {sortedDays.length > 1 && (
        <View style={detailStyles.dotRow}>
          {sortedDays.map(d => (
            <View key={d.dayNumber} style={[detailStyles.dot, selectedDay === d.dayNumber && detailStyles.dotActive]} />
          ))}
        </View>
      )}

      {/* Day pager — horizontal FlatList */}
      <FlatList
        ref={dayListRef}
        data={sortedDays}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={d => String(d.dayNumber)}
        getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
        scrollEnabled={swipeEnabled}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          handleDaySwipe(idx);
        }}
        style={{ flex: 1 }}
        renderItem={({ item: day }) => {
          const dayRestaurants = meta.restaurants.filter(r => r.night === day.dayNumber);
          const stored = (day.alternatives as { tileOrder?: TileId[] } | null)?.tileOrder;
          const tileOrder: TileId[] = localTileOrder[day.dayNumber] ?? stored ?? defaultTileOrder(day.dayNumber, dayRestaurants);
          const review = getReview(day.dayNumber);
          const isPast = adventure.startDate
            ? (() => { const d = new Date(adventure.startDate); d.setDate(d.getDate() + day.dayNumber - 1); return d < new Date(); })()
            : false;
          return (
            <ScrollView
              style={{ width: SCREEN_W }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[detailStyles.dayContent, { overflow: "visible" }]}
              scrollEventThrottle={16}
              onScroll={e => {
                if (day.dayNumber === selectedDay) {
                  heroOffset.setValue(e.nativeEvent.contentOffset.y);
                }
              }}
            >
              <View style={detailStyles.dateLabelRow}>
                <Text style={detailStyles.dateLabel}>{formatDayDate(adventure.startDate, day.dayNumber)}</Text>
                {isPast && (
                  <TouchableOpacity style={detailStyles.rateBtn} onPress={() => setFeedbackDay(day.dayNumber)}>
                    <MaterialCommunityIcons name="star-outline" size={14} color={colors.accent} />
                    <Text style={detailStyles.rateBtnText}>Rate</Text>
                  </TouchableOpacity>
                )}
              </View>

              {tileOrder.map((tileId, orderIdx) => {
                const canUp   = orderIdx > 0;
                const canDown = orderIdx < tileOrder.length - 1;
                const isLast  = orderIdx === tileOrder.length - 1;
                const tileKey = `${day.dayNumber}:${tileId}`;

                // Shared onDraggingChange: disable swipe + capture base order for hover-push
                const handleDraggingChange = (active: boolean) => {
                  setSwipeEnabled(!active);
                  if (active) {
                    dragBaseOrderRef.current[day.dayNumber] = [...tileOrder];
                    lastHoverSlotRef.current[day.dayNumber] = orderIdx;
                  } else {
                    delete dragBaseOrderRef.current[day.dayNumber];
                    delete lastHoverSlotRef.current[day.dayNumber];
                  }
                };

                if (tileId === "route") {
                  return (
                    <View
                      key="route"
                      onLayout={e => { tileHeightsRef.current[tileKey] = e.nativeEvent.layout.height; }}
                    >
                      <StopCard
                        day={day}
                        adventureId={adventure.id}
                        stopNumber={day.dayNumber}
                        isLast={isLast}
                        review={review}
                        onRate={r => setReview(day.dayNumber, { ...review, rating: r })}
                        onComment={c => setReview(day.dayNumber, { ...review, comment: c })}
                        onConnectRoute={() => setRouteModal(true)}
                        photos={reviewPhotos[day.dayNumber] ?? []}
                        onAddPhoto={() => handleAddActivityPhoto(day.dayNumber, `route${day.dayNumber}`, "route", day.title)}
                        onShare={() => setShareDay(day.dayNumber)}
                        onMoveUp={canUp ? () => moveTile(day.dayNumber, "route", "up") : undefined}
                        onMoveDown={canDown ? () => moveTile(day.dayNumber, "route", "down") : undefined}
                        onDraggingChange={handleDraggingChange}
                        onDragMove={dy => handleTileDragMove(day.dayNumber, "route", dy)}
                      />
                    </View>
                  );
                }

                if (tileId === "accommodation") {
                  const dayAccomOpt = (day.alternatives as { accommodationStop?: { options?: Array<{ name: string; price_per_night_eur?: number; booking_url?: string }> } } | null)
                    ?.accommodationStop?.options?.[0] ?? null;
                  if (!dayAccomOpt) return null;
                  return (
                    <View
                      key="accommodation"
                      onLayout={e => { tileHeightsRef.current[tileKey] = e.nativeEvent.layout.height; }}
                    >
                      <AccommodationCard
                        accomOpt={dayAccomOpt}
                        meta={meta}
                        adventureId={adventure.id}
                        dayNumber={day.dayNumber}
                        totalDays={sortedDays.length}
                        onMovedToDay={handleActivityMovedToDay}
                        onPreviewDay={handlePreviewDay}
                        onAddPhoto={() => handleAddActivityPhoto(day.dayNumber, "accom", "accommodation", dayAccomOpt.name)}
                        onMoveUp={canUp ? () => moveTile(day.dayNumber, "accommodation", "up") : undefined}
                        onMoveDown={canDown ? () => moveTile(day.dayNumber, "accommodation", "down") : undefined}
                        onDraggingChange={handleDraggingChange}
                        onDragMove={dy => handleTileDragMove(day.dayNumber, "accommodation", dy)}
                      />
                    </View>
                  );
                }

                if (tileId.startsWith("rest:")) {
                  const restIdx = parseInt(tileId.slice(5), 10);
                  const r = dayRestaurants[restIdx];
                  if (!r) return null;
                  return (
                    <View
                      key={tileId}
                      onLayout={e => { tileHeightsRef.current[tileKey] = e.nativeEvent.layout.height; }}
                    >
                      <RestaurantCard
                        restaurant={r}
                        adventureId={adventure.id}
                        idx={restIdx}
                        dayNumber={day.dayNumber}
                        totalDays={sortedDays.length}
                        isLast={isLast}
                        onMovedToDay={handleActivityMovedToDay}
                        onPreviewDay={handlePreviewDay}
                        onAddPhoto={() => handleAddActivityPhoto(day.dayNumber, `rest${restIdx}`, "restaurant", r.name)}
                        onMoveUp={canUp ? () => moveTile(day.dayNumber, tileId, "up") : undefined}
                        onMoveDown={canDown ? () => moveTile(day.dayNumber, tileId, "down") : undefined}
                        onDraggingChange={handleDraggingChange}
                        onDragMove={dy => handleTileDragMove(day.dayNumber, tileId, dy)}
                      />
                    </View>
                  );
                }

                return null;
              })}

              {/* Custom items added via the "+" button */}
              {((day.alternatives?.customItems ?? []) as CustomItem[]).map(item => (
                <CustomItemCard key={item.id} item={item} />
              ))}

              {/* Add item button — owners only */}
              {isOwner && (
                <TouchableOpacity
                  style={detailStyles.addItemBtn}
                  onPress={() => setAddItemDay(day.dayNumber)}
                  activeOpacity={0.7}
                >
                  <Feather name="plus" size={16} color={colors.muted} />
                  <Text style={detailStyles.addItemBtnText}>Add activity</Text>
                </TouchableOpacity>
              )}

              {meta.bookings.length > 0 && (
                <View style={{ marginBottom: spacing.md }}>
                  <BookingsSection bookings={meta.bookings} />
                </View>
              )}

              <View style={{ height: 100 }} />
            </ScrollView>
          );
        }}
      />

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
      <EditTripModal
        adventure={adventure}
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        onSave={handleSaveTrip}
        onDelete={handleDeleteTrip}
      />

      {addItemDay !== null && (
        <AddItemModal
          dayNumber={addItemDay}
          adventureId={adventure.id}
          onSave={(item) => handleAddItem(addItemDay, item)}
          onClose={() => setAddItemDay(null)}
        />
      )}

      {/* Floating Share to Feed button — only for owner with photos */}
      {isOwner && Object.values(reviewPhotos).flat().length > 0 && (
        <TouchableOpacity
          style={[detailStyles.shareFeedBtn, { bottom: insets.bottom + 16 }]}
          onPress={handleShareToFeed}
          activeOpacity={0.85}
        >
          <Feather name="share-2" size={15} color="#fff" />
          <Text style={detailStyles.shareFeedText}>Share to Feed</Text>
        </TouchableOpacity>
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
  headerTitle: { fontSize: fontSize.xl, fontFamily: fonts.display, color: colors.text },
  heroImageWrap: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.border,
  },
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
  dayTabActive: { backgroundColor: "#0A7AFF", borderColor: "#0A7AFF" },
  dayTabText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.muted },
  dayTabTextActive: { color: "#FFFFFF" },
  tabFadeLeft: { position: "absolute", left: 0, top: 0, bottom: 0, width: 36, pointerEvents: "none" } as any,
  tabFadeRight: { position: "absolute", right: 0, top: 0, bottom: 0, width: 36, pointerEvents: "none" } as any,
  dotRow: { flexDirection: "row", justifyContent: "center", gap: 5, paddingVertical: 6, backgroundColor: colors.card },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.text, width: 14, borderRadius: 3 },
  dayContent: { padding: spacing.md, gap: spacing.md },
  dateLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  dateLabel: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  rateBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent },
  rateBtnText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.accent },
  shareFeedBtn: {
    position: "absolute", right: 20,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: radius.full,
    ...shadow.md,
  },
  shareFeedText: { color: "#fff", fontWeight: "700", fontSize: fontSize.sm },
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
  addItemBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.xs, paddingVertical: 14,
    borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed",
    borderRadius: radius.lg, marginBottom: spacing.md,
  },
  addItemBtnText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.muted },
});

const tileStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm, overflow: "visible" },
  timeline: { alignItems: "center", width: 36 },
  circle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.text, alignItems: "center", justifyContent: "center", zIndex: 1,
  },
  circleNum: { fontFamily: fonts.sansBold, color: colors.inverse, fontSize: fontSize.sm },
  line: {
    flex: 1, width: 2, borderLeftWidth: 2, borderLeftColor: colors.border,
    borderStyle: "dashed", marginTop: 4, marginBottom: 4, minHeight: 40,
  },
  card: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.lg,
    overflow: "hidden", ...shadow.sm, marginBottom: spacing.md,
    borderWidth: 2,
  },
  photoWrap: { margin: 8, borderRadius: 12, overflow: "hidden", backgroundColor: colors.border },
  photo: { width: "100%", height: 160 },
  info: { padding: spacing.md, gap: 6 },
  title: { fontFamily: fonts.display, fontSize: fontSize.base, color: colors.text, lineHeight: 20, letterSpacing: -0.2 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
  infoText: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted, flex: 1, lineHeight: 16 },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginTop: 2 },
  statChip: {
    backgroundColor: colors.sheet, borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  statText: { fontFamily: fonts.sansMedium, fontSize: fontSize.xs, color: colors.text },
  actionRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
    gap: spacing.xs,
  },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 5,
    paddingVertical: 11,
    backgroundColor: colors.sheet,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.xs, color: colors.text },
  cameraBtn: { position: "absolute", top: 8, right: 8, padding: 6, backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 16, zIndex: 2 },
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
  dayPillActive: { backgroundColor: "#0A7AFF", borderColor: "#0A7AFF" },
  dayPillText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.muted },
  dayPillTextActive: { color: "#FFFFFF" },
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
  filterSheet: {
    position: "absolute", top: 0, right: 0,
    backgroundColor: colors.card, borderBottomLeftRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    minWidth: 210, ...shadow.md, zIndex: 20,
  },
  filterTitle: {
    fontSize: fontSize.sm, fontWeight: "700", color: colors.muted,
    textTransform: "uppercase", letterSpacing: 0.6,
    paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  filterRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingVertical: 10,
  },
  filterDot: { width: 10, height: 10, borderRadius: 5 },
  filterLabel: { flex: 1, fontSize: fontSize.base, color: colors.text, fontWeight: "500" },
  filterToggle: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: colors.border, padding: 3,
    justifyContent: "center",
  },
  filterThumb: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.card, ...shadow.sm,
  },
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
