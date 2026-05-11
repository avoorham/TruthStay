import {
  ActivityIndicator, Animated, FlatList, Image, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useRef } from "react";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, fontSize, radius, spacing } from "../../../lib/theme";
import { BudgetRangeSlider } from "../../../components/BudgetRangeSlider";
import { supabase } from "../../../lib/supabase";
import { InlineCalendar, diffDays } from "../../../components/InlineCalendar";
import { formatTravelTime, warningThresholdSeconds, fetchDestinationTimes } from "../../../lib/distance";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

async function discoveryHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegionTile {
  name: string;
  country: string;
  hero_images: string[];
  description: string;
  matched_style_tags: string[];
}

interface DestinationTile {
  name: string;
  type: string;
  country: string | null;
  region: string;
  hero_images: string[];
  description: string;
  why_it_fits: string[];
  matched_style_tags: string[];
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

// ─── Vacation style data ──────────────────────────────────────────────────────


const VACATION_STYLE_GROUPS = [
  {
    key: "pace",
    label: "Pace",
    tags: ["Relaxed mornings", "Pack the day", "Slow-and-quiet"],
  },
  {
    key: "setting",
    label: "Setting",
    tags: ["Big-city buzz", "Local town", "Off-grid / remote", "Coastal village", "Mountain / countryside", "Walkable old town"],
  },
  {
    key: "vibe",
    label: "Vibe",
    tags: ["Romantic", "Family-friendly", "Solo-friendly", "Group / friends trip", "Sporty"],
  },
  {
    key: "atmosphere",
    label: "Atmosphere",
    tags: ["Lively / nightlife", "Quiet evenings", "Local cafes & markets", "Tourist-light"],
  },
  {
    key: "activities",
    label: "What you want to do",
    tags: ["Eat your way through it", "Cultural deep-dive", "Beach & swim", "Outdoor / active", "Wellness focus", "Just lie around"],
  },
] as const;

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Step 1 — Vacation style
  const [vacationStyle, setVacationStyle] = useState<string[]>([]);

  // Step 2 — Practical details
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate]     = useState<Date | null>(null);
  const [adults, setAdults]       = useState(2);
  const [children, setChildren]   = useState(0);
  const [budgetMin, setBudgetMin] = useState(1500);
  const [budgetMax, setBudgetMax] = useState(3500);
  const [minInput, setMinInput]   = useState("1500");
  const [maxInput, setMaxInput]   = useState("3500");

  // Derived from date selection (0 when dates not yet chosen)
  const duration = startDate && endDate ? diffDays(startDate, endDate) : 0;

  // Step 3 — Regions
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [regions, setRegions]               = useState<RegionTile[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [regionsError, setRegionsError]     = useState<string | null>(null);
  const [regionSearch, setRegionSearch]     = useState("");

  // Step 4 — Destinations + travel times
  const [destinations, setDestinations]               = useState<DestinationTile[]>([]);
  const [destTimes, setDestTimes]                     = useState<Record<string, number | null>>({});
  const [destinationsLoading, setDestinationsLoading] = useState(false);
  const [destinationsError, setDestinationsError]     = useState<string | null>(null);
  const [selectedDestNames, setSelectedDestNames]     = useState<Set<string>>(new Set());
  const [expandedTile, setExpandedTile]               = useState<string | null>(null);

  // Step 5 — Skeleton / night allocation
  const [skeleton, setSkeleton]                 = useState<Skeleton | null>(null);
  const [skeletonLoading, setSkeletonLoading]   = useState(false);
  const [nightAllocations, setNightAllocations] = useState<{ destination: string; nights: number }[]>([]);

  // Step 6 — Saving
  const [saving, setSaving]   = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Tag scale animations (one Animated.Value per tag, lazy)
  const tagScaleMap = useRef<Map<string, Animated.Value>>(new Map());
  function getTagScale(tag: string): Animated.Value {
    if (!tagScaleMap.current.has(tag)) tagScaleMap.current.set(tag, new Animated.Value(1));
    return tagScaleMap.current.get(tag)!;
  }
  function animateTag(tag: string) {
    const anim = getTagScale(tag);
    Animated.sequence([
      Animated.timing(anim, { toValue: 0.88, duration: 70, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }
  function toggleVacationStyle(tag: string) {
    animateTag(tag);
    setVacationStyle(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  // ─── Step transitions ────────────────────────────────────────────────────────

  async function loadRegions() {
    setRegionsLoading(true);
    setRegionsError(null);
    setRegions([]);
    setStep(3);
    try {
      const res = await fetch(`${BASE}/api/discovery/regions`, {
        method: "POST",
        headers: await discoveryHeaders(),
        body: JSON.stringify({
          filters: { vacation_style: vacationStyle, duration_days: duration, budget: { min: budgetMin, max: budgetMax }, adults, children },
        }),
      });
      const json = await res.json() as { regions?: RegionTile[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setRegions(json.regions ?? []);
    } catch (e) {
      setRegionsError(e instanceof Error ? e.message : "Could not load regions");
    } finally {
      setRegionsLoading(false);
    }
  }

  async function loadDestinationTimes(originName: string, dests: DestinationTile[]) {
    if (!originName || dests.length === 0) return;
    try {
      const destNames = dests.map(d => [d.name, d.country].filter(Boolean).join(", "));
      const result = await fetchDestinationTimes(BASE, originName, destNames, await discoveryHeaders());
      const times: Record<string, number | null> = {};
      for (const dest of dests) {
        const key = [dest.name, dest.country].filter(Boolean).join(", ");
        times[dest.name] = result.results[key]?.travel_seconds ?? null;
      }
      setDestTimes(times);
    } catch {
      // Non-critical — tiles show "—" if destTimes is empty
    }
  }

  async function loadDestinations(regionOverride?: string) {
    const region = regionOverride ?? selectedRegion;
    if (regionOverride !== undefined) setSelectedRegion(regionOverride);
    setDestinationsLoading(true);
    setDestinationsError(null);
    setDestTimes({});
    setStep(4);
    try {
      const res = await fetch(`${BASE}/api/discovery/destinations`, {
        method: "POST",
        headers: await discoveryHeaders(),
        body: JSON.stringify({
          ...(region ? { input: { name: region, type: "region" } } : {}),
          filters: { duration_days: duration, budget: { min: budgetMin, max: budgetMax }, adults, children, vacation_style: vacationStyle },
        }),
      });
      const json = await res.json() as { destinations?: DestinationTile[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed");
      const dests = json.destinations ?? [];
      setDestinations(dests);
      // Fire travel-time lookup in background — doesn't block the tile render
      if (region) loadDestinationTimes(region, dests);
    } catch (e) {
      setDestinationsError(e instanceof Error ? e.message : "Could not load destinations");
    } finally {
      setDestinationsLoading(false);
    }
  }

  async function loadSkeleton() {
    setSkeletonLoading(true);
    setStep(5);
    try {
      const selectedDests = destinations.filter(d => selectedDestNames.has(d.name));
      const res = await fetch(`${BASE}/api/discovery/itinerary-skeleton`, {
        method: "POST",
        headers: await discoveryHeaders(),
        body: JSON.stringify({
          destinations: selectedDests.map(d => ({ name: d.name, type: d.type })),
          duration_days: duration,
          filters: { budget: { min: budgetMin, max: budgetMax }, adults, children, vacation_style: vacationStyle },
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

      const region = selectedRegion
        ?? (selectedDests.length > 0 ? selectedDests.map(d => d.name).join(", ") : "Trip");
      const res = await fetch(`${BASE}/api/discovery/save-skeleton`, {
        method: "POST",
        headers: await discoveryHeaders(),
        body: JSON.stringify({
          skeleton: sk,
          region,
          source_entry_ids: sourceIds,
          start_date: startDate ? startDate.toISOString().split("T")[0] : null,
          end_date:   endDate   ? endDate.toISOString().split("T")[0]   : null,
          adults,
          children,
          budget_min: budgetMin,
          budget_max: budgetMax,
        }),
      });
      const json = await res.json() as { adventureId?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setSavedId(json.adventureId ?? null);
      setStep(6);
    } catch {
      setSaving(false);
    }
  }

  function moveAlloc(dest: string, direction: -1 | 1) {
    setNightAllocations(prev => {
      const idx = prev.findIndex(a => a.destination === dest);
      if (idx < 0) return prev;
      const next = idx + direction;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  }

  function resetWizard() {
    setStep(1);
    setVacationStyle([]);
    setStartDate(null);
    setEndDate(null);
    setAdults(2);
    setChildren(0);
    setBudgetMin(1500);
    setBudgetMax(3500);
    setMinInput("1500");
    setMaxInput("3500");
    setSelectedRegion(null);
    setRegions([]);
    setRegionsError(null);
    setRegionSearch("");
    setDestTimes({});
    setSelectedDestNames(new Set());
    setSkeleton(null);
    setNightAllocations([]);
    setSavedId(null);
    setSaving(false);
    setDestinations([]);
    setDestinationsError(null);
  }

  const totalNights = nightAllocations.reduce((s, a) => s + a.nights, 0);
  const nightsMatch = duration > 0 && totalNights === duration;
  const datesValid  = !!startDate && !!endDate && duration > 0;

  // Running total travel time for selected destinations
  const selectedTravelSeconds = [...selectedDestNames].reduce((sum, name) => {
    const t = destTimes[name];
    return (t !== null && t !== undefined) ? sum + t : sum;
  }, 0);
  const travelWarning = selectedDestNames.size > 0
    && Object.keys(destTimes).length > 0
    && selectedTravelSeconds > warningThresholdSeconds(duration);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Step 1 — Vacation style ──────────────────────────────────────────── */}
      {step === 1 && (
        <View style={styles.flex}>
          <View style={styles.wizardHeader}>
            <View style={{ width: 20 }} />
            <Text style={styles.wizardTitle}>Vacation style</Text>
            <View style={{ width: 20 }} />
          </View>

          <ScrollView style={styles.flex} contentContainerStyle={styles.styleContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.styleHeadline}>What kind of vacation?</Text>
            <Text style={styles.styleSubhead}>Pick whatever fits — we'll find places that match.</Text>

            {VACATION_STYLE_GROUPS.map(group => (
              <View key={group.key}>
                <Text style={styles.styleGroupLabel}>{group.label}</Text>
                <View style={styles.pillRow}>
                  {group.tags.map(tag => {
                    const active = vacationStyle.includes(tag);
                    const scale = getTagScale(tag);
                    return (
                      <Animated.View key={tag} style={{ transform: [{ scale }] }}>
                        <TouchableOpacity
                          style={[styles.pill, active && styles.styleTagActive]}
                          onPress={() => toggleVacationStyle(tag)}
                          activeOpacity={0.9}
                        >
                          <Text style={[styles.pillText, active && styles.styleTagTextActive]}>{tag}</Text>
                        </TouchableOpacity>
                      </Animated.View>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.md }]}>
            <TouchableOpacity
              style={[styles.ctaBtn, vacationStyle.length < 3 && styles.ctaBtnDisabled]}
              disabled={vacationStyle.length < 3}
              onPress={() => setStep(2)}
            >
              <Text style={styles.ctaBtnText}>Continue</Text>
              <Feather name="arrow-right" size={16} color={colors.inverse} />
            </TouchableOpacity>
            {vacationStyle.length < 3 && (
              <Text style={styles.styleMinHint}>Pick at least 3 to continue</Text>
            )}
          </View>
        </View>
      )}

      {/* ── Step 2 — Practical details ───────────────────────────────────────── */}
      {step === 2 && (
        <View style={styles.flex}>
          <View style={styles.wizardHeader}>
            <TouchableOpacity onPress={() => setStep(1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="arrow-left" size={20} color={colors.accent} />
            </TouchableOpacity>
            <Text style={styles.wizardTitle}>Practical details</Text>
            <View style={{ width: 20 }} />
          </View>

          <ScrollView style={styles.flex} contentContainerStyle={styles.filtersContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.filterLabel}>When</Text>
            <InlineCalendar
              startDate={startDate}
              endDate={endDate}
              onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
            />

            <Text style={styles.filterLabel}>Total Budget</Text>
            <View style={styles.budgetInputRow}>
              <View style={styles.budgetInputWrap}>
                <Text style={styles.budgetCurrency}>€</Text>
                <TextInput
                  style={styles.budgetInput}
                  value={minInput}
                  keyboardType="numeric"
                  placeholder="Min"
                  placeholderTextColor={colors.muted}
                  onChangeText={text => {
                    setMinInput(text);
                    const v = parseInt(text, 10);
                    if (!isNaN(v) && v >= 0 && v < budgetMax) setBudgetMin(v);
                  }}
                  onBlur={() => {
                    const v = parseInt(minInput, 10);
                    const snapped = !isNaN(v) && v >= 0
                      ? Math.max(0, Math.min(Math.round(v / 50) * 50, budgetMax - 50))
                      : budgetMin;
                    setBudgetMin(snapped);
                    setMinInput(String(snapped));
                  }}
                />
              </View>
              <Text style={styles.budgetSep}>–</Text>
              <View style={styles.budgetInputWrap}>
                <Text style={styles.budgetCurrency}>€</Text>
                <TextInput
                  style={styles.budgetInput}
                  value={maxInput}
                  keyboardType="numeric"
                  placeholder="Max"
                  placeholderTextColor={colors.muted}
                  onChangeText={text => {
                    setMaxInput(text);
                    const v = parseInt(text, 10);
                    if (!isNaN(v) && v > budgetMin) setBudgetMax(v);
                  }}
                  onBlur={() => {
                    const v = parseInt(maxInput, 10);
                    const snapped = !isNaN(v) && v > budgetMin
                      ? Math.max(budgetMin + 50, Math.round(v / 50) * 50)
                      : budgetMax;
                    setBudgetMax(snapped);
                    setMaxInput(String(snapped));
                  }}
                />
              </View>
            </View>
            {budgetMax > 10_000 && (
              <Text style={styles.budgetOverRange}>→ Above slider range — set via input</Text>
            )}
            <BudgetRangeSlider
              min={budgetMin}
              max={budgetMax}
              onMinChange={v => { setBudgetMin(v); setMinInput(String(v)); }}
              onMaxChange={v => { setBudgetMax(v); setMaxInput(String(v)); }}
            />
            <View style={styles.budgetScaleRow}>
              <Text style={styles.budgetScaleLabel}>€0</Text>
              <Text style={styles.budgetScaleLabel}>€10,000</Text>
            </View>
            {duration > 0 && (() => {
              const mid = (budgetMin + budgetMax) / 2;
              const ppn = mid / duration / Math.max(adults, 1);
              return (
                <Text style={styles.budgetPerNight}>
                  ≈ €{Math.round(ppn * 0.9)}–€{Math.round(ppn * 1.1)} per night per adult
                </Text>
              );
            })()}

            <Text style={styles.filterLabel}>Adults</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setAdults(a => Math.max(1, a - 1))}>
                <Feather name="minus" size={16} color={colors.accent} />
              </TouchableOpacity>
              <Text style={styles.stepValue}>{adults}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setAdults(a => Math.min(20, a + 1))}>
                <Feather name="plus" size={16} color={colors.accent} />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterLabel}>Children</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setChildren(c => Math.max(0, c - 1))}>
                <Feather name="minus" size={16} color={colors.accent} />
              </TouchableOpacity>
              <Text style={styles.stepValue}>{children}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setChildren(c => Math.min(20, c + 1))}>
                <Feather name="plus" size={16} color={colors.accent} />
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.md }]}>
            <TouchableOpacity
              style={[styles.ctaBtn, !datesValid && styles.ctaBtnDisabled]}
              disabled={!datesValid}
              onPress={loadRegions}
            >
              <Text style={styles.ctaBtnText}>Find regions</Text>
              <Feather name="arrow-right" size={16} color={colors.inverse} />
            </TouchableOpacity>
            {!datesValid && (
              <Text style={styles.styleMinHint}>Select a date range to continue</Text>
            )}
          </View>
        </View>
      )}

      {/* ── Step 3 — Suggested regions ───────────────────────────────────────── */}
      {step === 3 && (
        <View style={styles.flex}>
          <View style={styles.wizardHeader}>
            <TouchableOpacity onPress={() => setStep(2)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="arrow-left" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.wizardTitle}>Where to?</Text>
            <View style={{ width: 20 }} />
          </View>

          {/* Search override */}
          <View style={styles.searchBox}>
            <Feather name="search" size={18} color={colors.muted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Or type a specific region…"
              placeholderTextColor={colors.muted}
              value={regionSearch}
              onChangeText={setRegionSearch}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {regionSearch.length > 0 && (
              <TouchableOpacity onPress={() => setRegionSearch("")}>
                <Feather name="x" size={16} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Custom region submit row */}
          {regionSearch.trim().length >= 2 && (
            <TouchableOpacity
              style={styles.searchOverrideRow}
              onPress={() => { const q = regionSearch.trim(); setRegionSearch(""); loadDestinations(q); }}
              activeOpacity={0.75}
            >
              <Feather name="search" size={14} color={colors.accent} />
              <Text style={styles.searchOverrideText}>Search "{regionSearch.trim()}"</Text>
              <Feather name="arrow-right" size={14} color={colors.accent} />
            </TouchableOpacity>
          )}

          {regionsLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.loadingText}>Finding regions for you…</Text>
            </View>
          ) : regionsError ? (
            <View style={styles.centered}>
              <Feather name="alert-circle" size={40} color={colors.muted} />
              <Text style={styles.errorText}>{regionsError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={loadRegions}>
                <Text style={styles.retryText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={regions}
              keyExtractor={r => r.name}
              contentContainerStyle={{ padding: spacing.md, paddingBottom: 40, gap: spacing.sm }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: reg }) => {
                const heroUri = reg.hero_images[0]
                  || `https://picsum.photos/seed/${encodeURIComponent(reg.name)}/400/180`;
                const isSelected = selectedRegion === reg.name;
                return (
                  <TouchableOpacity
                    style={[styles.regionTile, isSelected && styles.regionTileSelected]}
                    onPress={() => setSelectedRegion(prev => prev === reg.name ? null : reg.name)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.regionImageBox}>
                      <Image source={{ uri: heroUri }} style={styles.regionImage} />
                      <View style={styles.regionOverlay}>
                        <Text style={styles.regionName}>{reg.name}</Text>
                        <Text style={styles.regionCountry}>{reg.country}</Text>
                      </View>
                      <View style={[styles.destCheckbox, isSelected && styles.destCheckboxSelected]}>
                        {isSelected && <Feather name="check" size={13} color="#fff" />}
                      </View>
                    </View>
                    {reg.matched_style_tags?.length > 0 && (
                      <View style={styles.regionTagRow}>
                        {reg.matched_style_tags.map(tag => (
                          <View key={tag} style={styles.matchedTagChip}>
                            <Text style={styles.matchedTagText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <Text style={styles.regionDesc} numberOfLines={2}>{reg.description}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {!regionsLoading && !regionsError && (
            <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.md }]}>
              <TouchableOpacity
                style={[styles.ctaBtn, !selectedRegion && styles.ctaBtnDisabled]}
                disabled={!selectedRegion}
                onPress={() => { if (selectedRegion) loadDestinations(selectedRegion); }}
              >
                <Text style={styles.ctaBtnText}>Continue</Text>
                <Feather name="arrow-right" size={16} color={colors.inverse} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── Step 4 — Destination tiles ───────────────────────────────────────── */}
      {step === 4 && (
        <View style={styles.flex}>
          <View style={styles.wizardHeader}>
            <TouchableOpacity onPress={() => setStep(3)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
              <TouchableOpacity style={styles.retryBtn} onPress={() => loadDestinations()}>
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
                      <View style={styles.destMeta}>
                        <Text style={styles.destCountry}>{dest.country ?? dest.region}</Text>
                        {destTimes[dest.name] !== undefined && (
                          <View style={styles.destTimeChip}>
                            <Feather name="navigation" size={10} color={colors.muted} />
                            <Text style={styles.destTimeText}>
                              {destTimes[dest.name] !== null
                                ? `${formatTravelTime(destTimes[dest.name]!)} drive`
                                : "—"}
                            </Text>
                          </View>
                        )}
                      </View>
                      {dest.matched_style_tags?.length > 0 && (
                        <View style={styles.matchedTagRow}>
                          {dest.matched_style_tags.map(tag => (
                            <View key={tag} style={styles.matchedTagChip}>
                              <Text style={styles.matchedTagText}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      )}
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
              {selectedDestNames.size > 0 && Object.keys(destTimes).length > 0 && (
                <View style={[styles.travelBanner, travelWarning && styles.travelBannerWarn]}>
                  <Feather
                    name="clock"
                    size={12}
                    color={travelWarning ? colors.gold : colors.muted}
                  />
                  <Text style={[styles.travelBannerText, travelWarning && styles.travelBannerTextWarn]}>
                    {selectedTravelSeconds > 0
                      ? `~${formatTravelTime(selectedTravelSeconds)} total driving`
                      : "Travel time unavailable for some destinations"}
                    {travelWarning ? " · heavy transit for this trip length" : ""}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.ctaBtn, selectedDestNames.size === 0 && styles.ctaBtnDisabled]}
                disabled={selectedDestNames.size === 0}
                onPress={loadSkeleton}
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

      {/* ── Step 5 — Night allocation ────────────────────────────────────────── */}
      {step === 5 && (
        <View style={styles.flex}>
          <View style={styles.wizardHeader}>
            <TouchableOpacity onPress={() => setStep(4)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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

              {nightAllocations.map((alloc, idx) => (
                <View key={alloc.destination} style={styles.allocRow}>
                  <View style={styles.allocReorder}>
                    <TouchableOpacity
                      onPress={() => moveAlloc(alloc.destination, -1)}
                      disabled={idx === 0}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    >
                      <Feather name="chevron-up" size={18} color={idx === 0 ? colors.border : colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveAlloc(alloc.destination, 1)}
                      disabled={idx === nightAllocations.length - 1}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    >
                      <Feather name="chevron-down" size={18} color={idx === nightAllocations.length - 1 ? colors.border : colors.text} />
                    </TouchableOpacity>
                  </View>
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
                  {totalNights} / {duration} nights {nightsMatch ? "✓" : ""}
                </Text>
              </View>
              {!nightsMatch && (
                <Text style={styles.totalHint}>
                  Adjust nights so the total equals {duration}.
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

      {/* ── Step 6 — Confirmation ────────────────────────────────────────────── */}
      {/* ── Step 6 — Save success ───────────────────────────────────────────── */}
      {step === 6 && (
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
  container: { flex: 1, backgroundColor: colors.bg },
  flex:      { flex: 1 },
  centered:  { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },

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

  // ── CTA bar ──────────────────────────────────────────────────────────────────
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
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
  },
  ctaBtnDisabled: { opacity: 0.4 },
  ctaBtnText:     { fontFamily: fonts.sansBold, fontSize: fontSize.sm, color: colors.inverse },

  // ── Vacation style step ───────────────────────────────────────────────────────
  styleContent: { padding: spacing.lg, paddingBottom: 120 },
  styleHeadline: {
    fontFamily: fonts.display,
    fontSize: fontSize.xxl,
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  styleSubhead: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  styleGroupLabel: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize.xs,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  styleTagActive:     { backgroundColor: colors.accent, borderColor: colors.accent },
  styleTagTextActive: { color: colors.inverse },
  styleMinHint: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    color: colors.muted,
    textAlign: "center",
    marginTop: 6,
  },

  // ── Practical details ─────────────────────────────────────────────────────────
  filtersContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: 120 },
  filterLabel: { fontFamily: fonts.sansBold, fontSize: fontSize.xs, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  stepperRow:  { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  stepBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  stepValue: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.base, color: colors.text, minWidth: 60, textAlign: "center" },
  pillRow:   { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pillText: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.muted },

  // Budget slider
  budgetInputRow:  { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  budgetInputWrap: {
    flex: 1, flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.sm, paddingVertical: 8, gap: 4,
  },
  budgetCurrency:  { fontFamily: fonts.sansSemiBold, fontSize: fontSize.base, color: colors.text },
  budgetInput:     { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: fontSize.base, color: colors.text, padding: 0 },
  budgetSep:       { fontFamily: fonts.sans, fontSize: fontSize.base, color: colors.muted },
  budgetOverRange: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.accent, fontStyle: "italic" },
  budgetScaleRow:  { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  budgetScaleLabel:{ fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted },
  budgetPerNight:  { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.muted, textAlign: "center", marginTop: 2 },

  // ── Regions step ──────────────────────────────────────────────────────────────
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    margin: spacing.md,
    marginBottom: spacing.xs,
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
  searchOverrideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.accentLight,
    borderRadius: radius.md,
  },
  searchOverrideText: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.accent, flex: 1 },

  regionTile: {
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: "hidden",
  },
  regionTileSelected: { borderColor: colors.accent, borderWidth: 2 },
  regionImageBox: { height: 140, backgroundColor: colors.sheet, position: "relative" },
  regionImage:    { ...StyleSheet.absoluteFillObject, resizeMode: "cover" },
  regionOverlay: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  regionName:    { fontFamily: fonts.display, fontSize: fontSize.base, color: "#fff", letterSpacing: -0.3 },
  regionCountry: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: "rgba(255,255,255,0.8)" },
  regionTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  regionDesc:   { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted, lineHeight: 18, padding: spacing.sm, paddingTop: spacing.xs },

  // ── Destination tiles ─────────────────────────────────────────────────────────
  destTile: {
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: "hidden",
  },
  destTileSelected: { borderColor: colors.accent, borderWidth: 2 },
  destImageBox:     { height: 160, backgroundColor: colors.sheet },
  destImage:        { ...StyleSheet.absoluteFillObject, resizeMode: "cover" },
  destCheckbox: {
    position: "absolute",
    top: spacing.sm, right: spacing.sm,
    width: 28, height: 28,
    borderRadius: 14,
    borderWidth: 2, borderColor: "#fff",
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  destCheckboxSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  destBody:    { padding: spacing.md, gap: spacing.xs },
  destName:    { fontFamily: fonts.display, fontSize: fontSize.lg, color: colors.text, letterSpacing: -0.3 },
  destMeta:    { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  destCountry: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted },
  destTimeChip: { flexDirection: "row", alignItems: "center", gap: 3 },
  destTimeText: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted },
  destDesc:    { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.muted, lineHeight: 19 },

  travelBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.sheet,
    borderRadius: radius.md,
  },
  travelBannerWarn:     { backgroundColor: "#FEF3C7" },
  travelBannerText:     { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted, flex: 1, lineHeight: 16 },
  travelBannerTextWarn: { color: "#92400E" } as object,
  expandBtn:   { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.xs },
  expandBtnText: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.xs, color: colors.accent },
  reasonRow:    { flexDirection: "row", gap: spacing.xs, paddingTop: 4 },
  reasonBullet: { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.accent, width: 10 },
  reasonText:   { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted, flex: 1, lineHeight: 18 },

  matchedTagRow:  { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2, marginBottom: 2 },
  matchedTagChip: { backgroundColor: colors.accentLight, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  matchedTagText: { fontFamily: fonts.sansSemiBold, fontSize: 10, color: colors.accent },

  // ── Night allocation (skeleton) ───────────────────────────────────────────────
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
  allocReorder:  { gap: 2, marginRight: spacing.xs },
  allocDest:     { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.text, flex: 1 },
  allocControls: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  allocBtn: {
    width: 32, height: 32, borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  allocNights: { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.text, minWidth: 64, textAlign: "center" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  totalLabel:   { fontFamily: fonts.sansBold, fontSize: fontSize.sm, color: colors.muted },
  totalValue:   { fontFamily: fonts.sansBold, fontSize: fontSize.sm, color: colors.muted },
  totalValueOk: { color: colors.text },
  totalHint:    { fontFamily: fonts.sans, fontSize: fontSize.xs, color: colors.muted, textAlign: "center" },

  // ── Confirmation ──────────────────────────────────────────────────────────────
  successIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.accent,
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.md,
  },
  successTitle:     { fontFamily: fonts.display, fontSize: fontSize.xxl, color: colors.text, textAlign: "center", letterSpacing: -0.5 },
  successSub:       { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.muted },
  secondaryBtn:     { marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
  secondaryBtnText: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.muted },

  // ── Shared ────────────────────────────────────────────────────────────────────
  loadingText: { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.muted, textAlign: "center" },
  errorText:   { fontFamily: fonts.sans, fontSize: fontSize.base, color: colors.muted, textAlign: "center" },
  retryBtn:    { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.border },
  retryText:   { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.text },
});
