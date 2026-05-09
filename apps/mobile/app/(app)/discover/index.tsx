import {
  ActivityIndicator, FlatList, Image, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, fontSize, radius, spacing, shadow } from "../../../lib/theme";
import { supabase } from "../../../lib/supabase";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

async function discoveryHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Chip {
  id: string;
  name: string;
  type: string;
  parent_region: string | null;
  country: string | null;
  save_count: number;
  description: string | null;
}

interface DestinationTile {
  name: string;
  type: string;
  country: string | null;
  region: string;
  hero_images: string[];
  description: string;
  why_it_fits: string[];
  source_entry_ids: string[];
}

interface AccomStop {
  destination: string;
  nights: number;
  night_numbers: number[];
}

interface SkeletonDay {
  day_number: number;
  destination: string;
  title: string;
}

interface Skeleton {
  title: string;
  description: string;
  activity_type: string;
  duration_days: number;
  accommodation_stops: AccomStop[];
  days: SkeletonDay[];
}

const BUDGET_OPTIONS = [
  { key: "low",   label: "Budget"  },
  { key: "mid",   label: "Mid"     },
  { key: "high",  label: "Luxury"  },
] as const;

const TYPE_OPTIONS = [
  { key: "relaxing", label: "Relaxing" },
  { key: "active",   label: "Active"   },
  { key: "mixed",    label: "Mixed"    },
] as const;

const PREFERENCE_OPTIONS = ["Beach", "Culture", "Food", "Nature", "Nightlife", "Wellness", "Sport", "Hiking"];

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1 — Search
  const [query, setQuery] = useState("");
  const [chips, setChips] = useState<Chip[]>([]);
  const [chipsLoading, setChipsLoading] = useState(false);
  const [selectedChip, setSelectedChip] = useState<Chip | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2 — Filters
  const [duration, setDuration] = useState(7);
  const [budget, setBudget] = useState<"low" | "mid" | "high">("mid");
  const [travelers, setTravelers] = useState(2);
  const [vacationType, setVacationType] = useState<"relaxing" | "active" | "mixed">("mixed");
  const [preferences, setPreferences] = useState<string[]>([]);

  // Step 3 — Destinations
  const [destinations, setDestinations] = useState<DestinationTile[]>([]);
  const [destinationsLoading, setDestinationsLoading] = useState(false);
  const [destinationsError, setDestinationsError] = useState<string | null>(null);
  const [selectedDestNames, setSelectedDestNames] = useState<Set<string>>(new Set());
  const [expandedTile, setExpandedTile] = useState<string | null>(null);

  // Step 4 — Skeleton
  const [skeleton, setSkeleton] = useState<Skeleton | null>(null);
  const [skeletonLoading, setSkeletonLoading] = useState(false);
  const [nightAllocations, setNightAllocations] = useState<{ destination: string; nights: number }[]>([]);

  // Step 5 — Saving
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  // ─── Chip fetch (debounced 200ms) ───────────────────────────────────────────

  const fetchChips = useCallback(async (q: string) => {
    setChipsLoading(true);
    try {
      const res = await fetch(`${BASE}/api/discovery/chips?q=${encodeURIComponent(q)}&limit=8`);
      const json = await res.json() as { chips?: Chip[] };
      setChips(json.chips ?? []);
    } catch {
      setChips([]);
    } finally {
      setChipsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchChips(query), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchChips]);

  // ─── Step transitions ────────────────────────────────────────────────────────

  async function goToStep3() {
    setDestinationsLoading(true);
    setDestinationsError(null);
    setStep(3);
    try {
      const input = selectedChip
        ? { name: selectedChip.name, type: selectedChip.type }
        : { name: query.trim(), type: "region" };
      const res = await fetch(`${BASE}/api/discovery/destinations`, {
        method: "POST",
        headers: await discoveryHeaders(),
        body: JSON.stringify({
          input,
          filters: { duration_days: duration, budget, travelers, vacation_type: vacationType, preferences },
        }),
      });
      const json = await res.json() as { destinations?: DestinationTile[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setDestinations(json.destinations ?? []);
    } catch (e) {
      setDestinationsError(e instanceof Error ? e.message : "Could not load destinations");
    } finally {
      setDestinationsLoading(false);
    }
  }

  async function goToStep4() {
    setSkeletonLoading(true);
    setStep(4);
    try {
      const selectedDests = destinations.filter(d => selectedDestNames.has(d.name));
      const res = await fetch(`${BASE}/api/discovery/itinerary-skeleton`, {
        method: "POST",
        headers: await discoveryHeaders(),
        body: JSON.stringify({
          destinations: selectedDests.map(d => ({ name: d.name, type: d.type })),
          duration_days: duration,
          filters: { budget, vacation_type: vacationType },
        }),
      });
      const json = await res.json() as { skeleton?: Skeleton; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed");
      const sk = json.skeleton!;
      setSkeleton(sk);
      setNightAllocations(sk.accommodation_stops.map(s => ({ destination: s.destination, nights: s.nights })));
    } catch {
      // Fallback: equal distribution
      const dests = [...selectedDestNames];
      const perDest = Math.floor(duration / dests.length);
      const rem = duration - perDest * dests.length;
      setSkeleton(null);
      setNightAllocations(dests.map((d, i) => ({ destination: d, nights: perDest + (i === 0 ? rem : 0) })));
    } finally {
      setSkeletonLoading(false);
    }
  }

  async function saveTrip() {
    setSaving(true);
    try {
      const selectedDests = destinations.filter(d => selectedDestNames.has(d.name));
      const sourceIds = selectedDests.flatMap(d => d.source_entry_ids);
      const totalNights = nightAllocations.reduce((s, a) => s + a.nights, 0);

      // Rebuild skeleton with adjusted nights
      let sk = skeleton;
      if (sk) {
        const stops: AccomStop[] = [];
        let night = 1;
        for (const alloc of nightAllocations) {
          const nightNums = Array.from({ length: alloc.nights }, (_, i) => night + i);
          stops.push({ destination: alloc.destination, nights: alloc.nights, night_numbers: nightNums });
          night += alloc.nights;
        }
        const days: SkeletonDay[] = Array.from({ length: totalNights }, (_, i) => {
          const dayNum = i + 1;
          const stop = stops.find(s => s.night_numbers.includes(dayNum));
          const isFirstForStop = stop?.night_numbers[0] === dayNum;
          return {
            day_number: dayNum,
            destination: stop?.destination ?? nightAllocations[0]?.destination ?? "",
            title: isFirstForStop && dayNum > 1 ? `Arrival in ${stop!.destination}` : stop?.destination ?? `Day ${dayNum}`,
          };
        });
        sk = { ...sk, accommodation_stops: stops, days, duration_days: totalNights };
      }

      const region = selectedChip?.name ?? query.trim();
      const res = await fetch(`${BASE}/api/discovery/save-skeleton`, {
        method: "POST",
        headers: await discoveryHeaders(),
        body: JSON.stringify({ skeleton: sk, region, source_entry_ids: sourceIds }),
      });
      const json = await res.json() as { adventureId?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setSavedId(json.adventureId ?? null);
      setStep(5);
    } catch {
      setSaving(false);
    }
  }

  function resetWizard() {
    setStep(1);
    setQuery("");
    setSelectedChip(null);
    setSelectedDestNames(new Set());
    setSkeleton(null);
    setNightAllocations([]);
    setSavedId(null);
    setSaving(false);
    setDestinations([]);
    setDestinationsError(null);
  }

  const totalNights = nightAllocations.reduce((s, a) => s + a.nights, 0);
  const nightsMatch = totalNights === duration;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Step 1 — Search */}
      {step === 1 && (
        <View style={styles.flex}>
          <View style={styles.wizardHeader}>
            <Text style={styles.wizardTitle}>Where to?</Text>
          </View>

          <View style={styles.searchBox}>
            <Feather name="search" size={18} color={colors.muted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search destinations..."
              placeholderTextColor={colors.subtle}
              value={query}
              onChangeText={text => { setQuery(text); setSelectedChip(null); }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(""); setSelectedChip(null); }}>
                <Feather name="x" size={16} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          {chipsLoading ? (
            <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.accent} />
          ) : (
            <FlatList
              data={chips}
              keyExtractor={c => c.id}
              style={styles.chipList}
              contentContainerStyle={styles.chipListContent}
              renderItem={({ item }) => {
                const selected = selectedChip?.id === item.id;
                const regionLabel = [item.parent_region, item.country].filter(Boolean).join(" / ");
                return (
                  <TouchableOpacity
                    style={[styles.chipRow, selected && styles.chipRowSelected]}
                    onPress={() => setSelectedChip(selected ? null : item)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.chipRowLeft}>
                      <Text style={[styles.chipName, selected && styles.chipNameSelected]}>{item.name}</Text>
                      {regionLabel ? (
                        <Text style={[styles.chipDesc, selected && { color: colors.inverse + "99" }]} numberOfLines={1}>{regionLabel}</Text>
                      ) : item.description ? (
                        <Text style={styles.chipDesc} numberOfLines={1}>{item.description}</Text>
                      ) : null}
                    </View>
                    <View style={styles.chipMeta}>
                      <Text style={[styles.chipType, selected && { color: colors.inverse + "99" }]}>{item.type}</Text>
                      {selected && <Feather name="check" size={14} color={colors.inverse} style={{ marginLeft: 4 }} />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                query.trim().length >= 3 ? (
                  <TouchableOpacity
                    style={styles.fallbackChip}
                    onPress={() => {
                      const freeChip: Chip = {
                        id: `free:${query.trim()}`,
                        name: query.trim(),
                        type: "region",
                        parent_region: null,
                        country: null,
                        save_count: 0,
                        description: null,
                      };
                      setSelectedChip(freeChip);
                      // Fire background Scout for this unknown destination
                      fetch(`${BASE}/api/discovery/scout-region`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ region: query.trim() }),
                      }).catch(() => {});
                      setStep(2);
                    }}
                    activeOpacity={0.75}
                  >
                    <Feather name="plus" size={14} color={colors.accent} />
                    <Text style={styles.fallbackChipText}>"{query.trim()}"</Text>
                    <Text style={styles.fallbackChipSub}>Search this destination</Text>
                  </TouchableOpacity>
                ) : query.length > 0 ? (
                  <Text style={styles.emptyText}>Keep typing to search…</Text>
                ) : null
              }
            />
          )}

          <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.md }]}>
            <TouchableOpacity
              style={[styles.ctaBtn, !(selectedChip || query.trim().length > 1) && styles.ctaBtnDisabled]}
              disabled={!(selectedChip || query.trim().length > 1)}
              onPress={() => setStep(2)}
            >
              <Text style={styles.ctaBtnText}>Next</Text>
              <Feather name="arrow-right" size={16} color={colors.inverse} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Step 2 — Filters */}
      {step === 2 && (
        <View style={styles.flex}>
          <View style={styles.wizardHeader}>
            <TouchableOpacity onPress={() => setStep(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="arrow-left" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.wizardTitle}>Trip details</Text>
            <View style={{ width: 20 }} />
          </View>

          <ScrollView style={styles.flex} contentContainerStyle={styles.filtersContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.filterLabel}>Duration</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setDuration(d => Math.max(1, d - 1))}>
                <Feather name="minus" size={16} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.stepValue}>{duration} days</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setDuration(d => Math.min(28, d + 1))}>
                <Feather name="plus" size={16} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>Budget</Text>
            <View style={styles.pillRow}>
              {BUDGET_OPTIONS.map(o => (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.pill, budget === o.key && styles.pillActive]}
                  onPress={() => setBudget(o.key)}
                >
                  <Text style={[styles.pillText, budget === o.key && styles.pillTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Travelers</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setTravelers(t => Math.max(1, t - 1))}>
                <Feather name="minus" size={16} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.stepValue}>{travelers}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setTravelers(t => Math.min(20, t + 1))}>
                <Feather name="plus" size={16} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>Trip type</Text>
            <View style={styles.pillRow}>
              {TYPE_OPTIONS.map(o => (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.pill, vacationType === o.key && styles.pillActive]}
                  onPress={() => setVacationType(o.key)}
                >
                  <Text style={[styles.pillText, vacationType === o.key && styles.pillTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>I love</Text>
            <View style={styles.pillRow}>
              {PREFERENCE_OPTIONS.map(p => {
                const active = preferences.includes(p);
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setPreferences(prev => active ? prev.filter(x => x !== p) : [...prev, p])}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.md }]}>
            <TouchableOpacity style={styles.ctaBtn} onPress={goToStep3}>
              <Text style={styles.ctaBtnText}>Generate destinations</Text>
              <Feather name="arrow-right" size={16} color={colors.inverse} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Step 3 — Destination tiles */}
      {step === 3 && (
        <View style={styles.flex}>
          <View style={styles.wizardHeader}>
            <TouchableOpacity onPress={() => setStep(2)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="arrow-left" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.wizardTitle}>Choose destinations</Text>
            <View style={{ width: 20 }} />
          </View>

          {destinationsLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.loadingText}>Finding the best destinations...</Text>
            </View>
          ) : destinationsError ? (
            <View style={styles.centered}>
              <Feather name="alert-circle" size={40} color={colors.muted} />
              <Text style={styles.errorText}>{destinationsError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={goToStep3}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={destinations}
              keyExtractor={d => d.name}
              contentContainerStyle={{ padding: spacing.md, paddingBottom: 120, gap: spacing.md }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: dest }) => {
                const selected = selectedDestNames.has(dest.name);
                const expanded = expandedTile === dest.name;
                const heroUri = dest.hero_images[0] || `https://picsum.photos/seed/${encodeURIComponent(dest.name)}/400/200`;
                return (
                  <TouchableOpacity
                    style={[styles.destTile, selected && styles.destTileSelected]}
                    onPress={() => setSelectedDestNames(prev => {
                      const next = new Set(prev);
                      if (next.has(dest.name)) next.delete(dest.name); else next.add(dest.name);
                      return next;
                    })}
                    activeOpacity={0.85}
                  >
                    <View style={styles.destImageBox}>
                      <Image source={{ uri: heroUri }} style={styles.destImage} />
                      <View style={[styles.destCheckbox, selected && styles.destCheckboxSelected]}>
                        {selected && <Feather name="check" size={13} color="#fff" />}
                      </View>
                    </View>
                    <View style={styles.destBody}>
                      <Text style={styles.destName}>{dest.name}</Text>
                      <Text style={styles.destCountry}>{dest.country ?? dest.region}</Text>
                      <Text style={styles.destDesc} numberOfLines={expanded ? undefined : 2}>{dest.description}</Text>
                      {dest.why_it_fits.length > 0 && (
                        <TouchableOpacity
                          style={styles.expandBtn}
                          onPress={() => setExpandedTile(expanded ? null : dest.name)}
                        >
                          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.accent} />
                          <Text style={styles.expandBtnText}>
                            {expanded ? "Less" : `Why it fits (${dest.why_it_fits.length})`}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {expanded && dest.why_it_fits.map((reason, i) => (
                        <View key={i} style={styles.reasonRow}>
                          <Text style={styles.reasonBullet}>•</Text>
                          <Text style={styles.reasonText}>{reason}</Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {!destinationsLoading && !destinationsError && (
            <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.md }]}>
              <TouchableOpacity
                style={[styles.ctaBtn, selectedDestNames.size === 0 && styles.ctaBtnDisabled]}
                disabled={selectedDestNames.size === 0}
                onPress={goToStep4}
              >
                <Text style={styles.ctaBtnText}>
                  Continue with {selectedDestNames.size} {selectedDestNames.size === 1 ? "destination" : "destinations"}
                </Text>
                <Feather name="arrow-right" size={16} color={colors.inverse} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Step 4 — Night allocation */}
      {step === 4 && (
        <View style={styles.flex}>
          <View style={styles.wizardHeader}>
            <TouchableOpacity onPress={() => setStep(3)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="arrow-left" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.wizardTitle}>Your itinerary</Text>
            <View style={{ width: 20 }} />
          </View>

          {skeletonLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.loadingText}>Building your skeleton...</Text>
            </View>
          ) : (
            <ScrollView style={styles.flex} contentContainerStyle={styles.skeletonContent}>
              {skeleton?.title ? (
                <Text style={styles.skeletonTitle}>{skeleton.title}</Text>
              ) : null}

              {nightAllocations.map(alloc => (
                <View key={alloc.destination} style={styles.allocRow}>
                  <Text style={styles.allocDest} numberOfLines={1}>{alloc.destination}</Text>
                  <View style={styles.allocControls}>
                    <TouchableOpacity
                      style={styles.allocBtn}
                      onPress={() => setNightAllocations(prev =>
                        prev.map(a => a.destination === alloc.destination
                          ? { ...a, nights: Math.max(0, a.nights - 1) } : a)
                      )}
                    >
                      <Feather name="minus" size={16} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.allocNights}>{alloc.nights} {alloc.nights === 1 ? "night" : "nights"}</Text>
                    <TouchableOpacity
                      style={styles.allocBtn}
                      onPress={() => setNightAllocations(prev =>
                        prev.map(a => a.destination === alloc.destination
                          ? { ...a, nights: a.nights + 1 } : a)
                      )}
                    >
                      <Feather name="plus" size={16} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={[styles.totalValue, nightsMatch && styles.totalValueOk]}>
                  {totalNights} / {duration} days {nightsMatch ? "✓" : ""}
                </Text>
              </View>
              {!nightsMatch && (
                <Text style={styles.totalHint}>
                  Adjust nights so the total equals {duration} days.
                </Text>
              )}
            </ScrollView>
          )}

          {!skeletonLoading && (
            <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.md }]}>
              <TouchableOpacity
                style={[styles.ctaBtn, (!nightsMatch || saving) && styles.ctaBtnDisabled]}
                disabled={!nightsMatch || saving}
                onPress={saveTrip}
              >
                {saving
                  ? <ActivityIndicator color={colors.inverse} />
                  : <>
                    <Text style={styles.ctaBtnText}>Save Trip</Text>
                    <Feather name="check" size={16} color={colors.inverse} />
                  </>
                }
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Step 5 — Confirmation */}
      {step === 5 && (
        <View style={[styles.flex, styles.centered]}>
          <View style={styles.successIcon}>
            <Feather name="check" size={36} color={colors.inverse} />
          </View>
          <Text style={styles.successTitle}>{skeleton?.title ?? "Trip saved!"}</Text>
          <Text style={styles.successSub}>Saved to My Trips · {duration} days</Text>

          <TouchableOpacity
            style={[styles.ctaBtn, { marginTop: spacing.xl, width: "80%" }]}
            onPress={() => router.push("/(app)/trips")}
          >
            <Text style={styles.ctaBtnText}>View My Trips</Text>
            <Feather name="arrow-right" size={16} color={colors.inverse} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={resetWizard}>
            <Text style={styles.secondaryBtnText}>Plan another trip</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.bg },
  flex:        { flex: 1 },
  centered:    { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },

  wizardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  wizardTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.text, letterSpacing: -0.4 },

  // Search
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.sheet,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  searchIcon:  { flexShrink: 0 },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: fontSize.base,
    color: colors.text,
    padding: 0,
  },
  chipList:        { flex: 1 },
  chipListContent: { paddingHorizontal: spacing.md, gap: spacing.xs },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipRowSelected: { backgroundColor: colors.text, borderColor: colors.text },
  chipRowLeft:     { flex: 1, gap: 2 },
  chipName:        { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.text },
  chipNameSelected:{ color: colors.inverse },
  chipDesc:        { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted },
  chipMeta:        { flexDirection: "row", alignItems: "center" },
  chipType:        { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted, textTransform: "capitalize" },
  emptyText:       { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.muted, textAlign: "center", padding: spacing.xl },
  fallbackChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderStyle: "dashed",
  },
  fallbackChipText:{ fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.accent, flex: 1 },
  fallbackChipSub: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted },

  // CTA bar
  ctaBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
  },
  ctaBtnDisabled: { opacity: 0.4 },
  ctaBtnText:     { fontFamily: fonts.sansBold, fontSize: fontSize.sm, color: colors.inverse },

  // Filters
  filtersContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  filterLabel:    { fontFamily: fonts.sansBold, fontSize: fontSize.xs, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  stepperRow:     { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  stepBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  stepValue:      { fontFamily: fonts.sansSemiBold, fontSize: fontSize.base, color: colors.text, minWidth: 60, textAlign: "center" },
  pillRow:        { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pillActive:     { backgroundColor: colors.text, borderColor: colors.text },
  pillText:       { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.muted },
  pillTextActive: { color: colors.inverse },

  // Destination tiles
  destTile: {
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadow.md,
  },
  destTileSelected: { borderColor: colors.text },
  destImageBox:     { height: 160, backgroundColor: colors.sheet },
  destImage:        { ...StyleSheet.absoluteFillObject, resizeMode: "cover" },
  destCheckbox: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 28, height: 28,
    borderRadius: 14,
    borderWidth: 2, borderColor: "#fff",
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  destCheckboxSelected: { backgroundColor: colors.text, borderColor: colors.text },
  destBody:   { padding: spacing.md, gap: spacing.xs },
  destName:   { fontFamily: fonts.display, fontSize: fontSize.lg, color: colors.text, letterSpacing: -0.3 },
  destCountry:{ fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted },
  destDesc:   { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.muted, lineHeight: 19 },
  expandBtn:  { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.xs },
  expandBtnText: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.xs, color: colors.accent },
  reasonRow:  { flexDirection: "row", gap: spacing.xs, paddingTop: 4 },
  reasonBullet: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.accent, width: 10 },
  reasonText: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted, flex: 1, lineHeight: 18 },

  // Skeleton
  skeletonContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  skeletonTitle:   { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.text, letterSpacing: -0.4 },
  allocRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  allocDest:     { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.text, flex: 1 },
  allocControls: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  allocBtn: {
    width: 32, height: 32, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  allocNights:   { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.text, minWidth: 64, textAlign: "center" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  totalLabel:    { fontFamily: fonts.sansBold, fontSize: fontSize.sm, color: colors.muted },
  totalValue:    { fontFamily: fonts.sansBold, fontSize: fontSize.sm, color: colors.muted },
  totalValueOk:  { color: colors.text },
  totalHint:     { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted, textAlign: "center" },

  // Success
  successIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.text,
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.md,
  },
  successTitle:   { fontFamily: fonts.display, fontSize: fontSize.xxl, color: colors.text, textAlign: "center", letterSpacing: -0.5 },
  successSub:     { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.muted },
  secondaryBtn:   { marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
  secondaryBtnText: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.muted },

  // Shared
  loadingText: { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.muted, textAlign: "center" },
  errorText:   { fontFamily: fonts.sans, fontSize: fontSize.base, color: colors.muted, textAlign: "center" },
  retryBtn:    { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border },
  retryText:   { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.text },
});
