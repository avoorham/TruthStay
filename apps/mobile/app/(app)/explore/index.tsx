import React, { useRef, useState, useCallback, useMemo, useEffect } from "react";
import {
  ActivityIndicator, Alert, Animated, Dimensions, FlatList, Image, Modal, PanResponder,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Mapbox, {
  MapView, Camera, PointAnnotation, FillLayer, SymbolLayer,
} from "@rnmapbox/maps";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, fontSize, radius, spacing, ACTIVITY_COLOR } from "../../../lib/theme";
import {
  getPublicAdventures, getPublicRestaurants, getPublicActivities,
  bookmarkAdventure, unbookmarkAdventure, forkAdventure,
  type PublicAdventureRow,
} from "../../../lib/api";
import { ALL_LOCATIONS } from "../../../lib/locationData";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");

// ─── Mapbox geocoding helper ──────────────────────────────────────────────────

async function fetchMapboxGeoData(
  lng: number, lat: number, token: string,
): Promise<{ neighbourhoods: string[]; landmarks: string[] }> {
  if (!token) return { neighbourhoods: [], landmarks: [] };
  try {
    // Step 1: reverse-geocode to get city bbox
    const placeRes = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place&limit=1&access_token=${token}`
    );
    if (!placeRes.ok) return { neighbourhoods: [], landmarks: [] };
    const placeData = await placeRes.json();
    const cityFeature = placeData.features?.[0];
    const bbox: number[] | undefined = cityFeature?.bbox;
    const bboxParam = bbox
      ? `bbox=${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`
      : `proximity=${lng},${lat}`;

    // Step 2: neighbourhoods + POIs in parallel
    const [nbRes, poiRes] = await Promise.all([
      fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/a.json?types=neighborhood&${bboxParam}&limit=25&access_token=${token}`),
      fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/a.json?types=poi&proximity=${lng},${lat}&limit=15&access_token=${token}`),
    ]);
    const [nbData, poiData] = await Promise.all([nbRes.json(), poiRes.json()]);

    const neighbourhoods: string[] = (nbData.features ?? []).map((f: any) => f.text as string);
    const landmarks: string[]      = (poiData.features ?? []).map((f: any) => f.text as string);
    return { neighbourhoods, landmarks };
  } catch {
    return { neighbourhoods: [], landmarks: [] };
  }
}

const SCREEN_H      = Dimensions.get("window").height;
const SCREEN_W      = Dimensions.get("window").width;
const PRICE_MIN              = 0;
const PRICE_MAX              = 3000;
const ACCOMMODATION_PRICE_MAX = 500;
const MEAL_PRICE_MAX          = 150;
const DURATION_MIN            = 1;
const DURATION_MAX            = 30;
// Maps adventure budget category to a representative price for range filtering
const BUDGET_PRICE: Record<string, number> = { budget: 250, mid: 1000, luxury: 2500 };
const SNAP_PEEK     = SCREEN_H - 90;
const SNAP_HALF     = SCREEN_H * 0.45;
const SNAP_EXPANDED = SCREEN_H * 0.12;
const CARD_W        = SCREEN_W - 32;
const IMAGE_H       = 240;
const CARD_H        = IMAGE_H + 96; // image + text area below

// ─── Types ────────────────────────────────────────────────────────────────────

interface Adventure {
  id: string;
  title: string;
  activityTypes: string[];
  region: string;
  country: string;
  days: number;
  avgDistanceKm: number | null;
  avgElevationM: number | null;
  description: string;
  budget: "budget" | "mid" | "luxury";
  level: "beginner" | "intermediate" | "advanced";
  rating: number;
  coords: [number, number];
  uploadedBy: string | null;
  photos: string[];
}

interface FilterState {
  filterCategory: FilterCategory;

  // Vacations
  activities:          string[];
  subActivities:       string[];
  focuses:             string[];
  focusSubActivities:  string[];
  durationMin:         number;
  durationMax:         number;
  minBudget:           number;
  maxBudget:           number;
  level:               string | null;
  rating:              number | null;
  region:              string | null;

  // Stays
  propertyTypes:       string[];
  bedrooms:            number;
  bathrooms:           number;
  facilities:          string[];
  roomFacilities:      string[];
  stayMeals:           string[];
  propertyRating:      number | null;
  reviewScore:         number | null;
  bedPreference:       string | null;
  maxPricePerNight:    number;
  reservationPolicy:   string[];
  travelGroup:         string[];
  funThingsToDo:       string[];
  neighbourhoods:      string[];
  landmarks:           string[];
  highlyRated:         string[];
  onlinePayment:       boolean;
  sustainabilityBadge: boolean;

  // Activities
  activityTypes:       string[];
  activityVibes:       string[];
  activitySubItems:    string[];

  // Restaurants
  mealTypes:           string[];
  cuisines:            string[];
  restaurantVibes:     string[];
  maxPricePerMeal:     number;
}

interface POIPin {
  id:             string;
  title:          string;
  category:       string;
  coords:         [number, number];
  subtitle?:      string;
  region?:        string;
  adventureTitle?:string;
}

type FilterCategory = "vacations" | "accommodations" | "activities" | "restaurants";
type ActivityCategory =
  | "restaurants" | "bars" | "cafes"
  | "hiking" | "cycling" | "trail_running"
  | "climbing" | "kayaking" | "skiing";

const DEFAULT_FILTERS: FilterState = {
  filterCategory: "vacations",
  activities: [], subActivities: [], focuses: [], focusSubActivities: [],
  durationMin: DURATION_MIN, durationMax: DURATION_MAX, minBudget: PRICE_MIN, maxBudget: PRICE_MAX, level: null, rating: null, region: null,
  propertyTypes: [], bedrooms: 0, bathrooms: 0, facilities: [], roomFacilities: [],
  stayMeals: [], propertyRating: null, reviewScore: null, bedPreference: null,
  maxPricePerNight: ACCOMMODATION_PRICE_MAX, reservationPolicy: [], travelGroup: [],
  funThingsToDo: [], neighbourhoods: [], landmarks: [], highlyRated: [],
  onlinePayment: false, sustainabilityBadge: false,
  activityTypes: [], activityVibes: [], activitySubItems: [],
  mealTypes: [], cuisines: [], restaurantVibes: [], maxPricePerMeal: MEAL_PRICE_MAX,
};


// ─── Constants ────────────────────────────────────────────────────────────────

const SETTING_OPTIONS = [
  { key: "beach_coast",   label: "Beach & Coast" },
  { key: "mountains",     label: "Mountains & Highlands" },
  { key: "countryside",   label: "Countryside & Rural" },
  { key: "city_culture",  label: "City & Culture" },
  { key: "lakes_rivers",  label: "Lakes & Rivers" },
  { key: "forest_nature", label: "Forest & Nature" },
  { key: "islands",       label: "Islands" },
  { key: "desert",        label: "Desert & Arid" },
  { key: "snow_ice",      label: "Snow & Ice" },
  { key: "jungle",        label: "Jungle & Tropics" },
];

const SETTING_ACTIVITY_MAP: Record<string, string[]> = {
  beach_coast:   ["kayaking", "other"],
  mountains:     ["hiking", "trail_running", "climbing", "skiing"],
  countryside:   ["cycling", "hiking"],
  city_culture:  ["other"],
  lakes_rivers:  ["kayaking", "cycling"],
  forest_nature: ["hiking", "trail_running"],
  islands:       ["kayaking", "other"],
  desert:        ["other"],
  snow_ice:      ["skiing", "snowboarding"],
  jungle:        ["other"],
};

const SETTING_SUB_ACTIVITIES: Record<string, string[]> = {
  beach_coast:   ["Surfing", "Snorkeling", "Scuba diving", "Swimming", "Sailing", "Kitesurfing", "Stand-up paddleboarding", "Beach volleyball", "Sunset cruise", "Sea kayaking"],
  mountains:     ["Hiking", "Rock climbing", "Trail running", "Mountain biking", "Via ferrata", "Paragliding", "Ski touring", "Snowshoeing", "Mountaineering", "Photography walks"],
  countryside:   ["Cycling", "Walking", "Horse riding", "Wine tasting", "Farm stays", "Foraging", "Bird watching", "Picnicking", "Yoga", "Cooking classes"],
  city_culture:  ["Walking tours", "Museum visits", "Food tours", "Architecture walks", "Street art", "Shopping", "Live music", "Cooking classes", "Rooftop bars", "Theatre"],
  lakes_rivers:  ["Kayaking", "Swimming", "Fishing", "Stand-up paddleboarding", "Sailing", "Wild camping", "Trail running", "Cycling", "Photography", "Wellness retreats"],
  forest_nature: ["Hiking", "Mountain biking", "Wild camping", "Bird watching", "Photography", "Foraging", "Trail running", "Yoga", "Stargazing", "Mindfulness walks"],
  islands:       ["Snorkeling", "Sailing", "Scuba diving", "Fishing", "Hiking", "Beach walks", "Kayaking", "Surfing", "Cultural tours", "Yoga retreat"],
  desert:        ["Camel trekking", "Stargazing", "Photography", "Dune surfing", "Off-road driving", "Guided desert hikes", "Wild camping", "Cultural visits", "Quad biking", "Hot air balloon"],
  snow_ice:      ["Skiing", "Snowboarding", "Snowshoeing", "Ice skating", "Dog sledding", "Snowmobile", "Winter photography", "Husky safari", "Ski touring", "Ice fishing"],
  jungle:        ["Wildlife spotting", "Guided jungle treks", "Zip-lining", "River kayaking", "Bird watching", "Night safari", "Waterfall swimming", "Cultural village visits", "Photography", "Yoga"],
};

// Maps specific activity names to DB activityType values
const SUB_ACTIVITY_TYPE_MAP: Record<string, string> = {
  "Hiking": "hiking", "Walking": "hiking", "Mountaineering": "hiking",
  "Guided desert hikes": "hiking", "Guided jungle treks": "hiking",
  "Photography walks": "hiking", "Mindfulness walks": "hiking", "Beach walks": "hiking",
  "Nature trails": "hiking",
  "Cycling": "cycling", "Mountain biking": "cycling",
  "Trail running": "trail_running",
  "Rock climbing": "climbing", "Via ferrata": "climbing",
  "Skiing": "skiing", "Ski touring": "skiing", "Snowshoeing": "skiing",
  "Snowboarding": "snowboarding",
  "Kayaking": "kayaking", "Sea kayaking": "kayaking", "River kayaking": "kayaking",
  "White water rafting": "kayaking",
};

const FOCUS_OPTIONS = [
  "Relax & Unwind", "Sport & Active", "Family Fun", "Sightseeing & Culture",
  "Food & Gastronomy", "Adventure & Thrills", "Wellness & Spa",
  "Nightlife & Social", "Wildlife & Nature", "Digital Detox",
];

const FOCUS_SUB_ACTIVITIES: Record<string, string[]> = {
  "Relax & Unwind":        ["Sunbathing", "Yoga", "Meditation", "Reading", "Hot spring bathing", "Hammam & spa", "Slow scenic walks", "Massage therapy", "Napping on beach", "Journaling"],
  "Sport & Active":        ["Cycling", "Trail running", "Hiking", "Swimming", "Rock climbing", "Kayaking", "Open-water swimming", "Triathlon training", "Crossfit", "Stretching & mobility"],
  "Family Fun":            ["Nature trails", "Sand castle building", "Cycling", "Swimming", "Wildlife parks", "Boat trips", "Mini golf", "Theme parks", "Treasure hunts", "Ice cream tours"],
  "Sightseeing & Culture": ["Guided tours", "Museums", "Historical sites", "Architecture walks", "Viewpoints", "Photography", "Boat tours", "City walks", "Landmarks", "Local markets"],
  "Food & Gastronomy":     ["Food tours", "Cooking classes", "Wine tasting", "Market visits", "Restaurant hopping", "Farm visits", "Cheese tastings", "Foraging", "Olive oil tastings", "Craft brewery tours"],
  "Adventure & Thrills":   ["Bungee jumping", "Paragliding", "White water rafting", "Rock climbing", "Skydiving", "Cave exploration", "Zip-lining", "Surfing", "Mountain biking", "Mountaineering"],
  "Wellness & Spa":        ["Yoga", "Meditation", "Spa treatments", "Pilates", "Sound healing", "Breathwork", "Massage therapy", "Detox programme", "Forest bathing", "Silent retreat"],
  "Nightlife & Social":    ["Bar hopping", "Club nights", "Live music", "Comedy shows", "Night markets", "Rooftop bars", "Cocktail masterclasses", "Street food tours", "Jazz bars", "Festival attendance"],
  "Wildlife & Nature":     ["Safari", "Bird watching", "Whale watching", "Turtle nesting tours", "Snorkeling", "Marine diving", "Nature walks", "Wildlife photography", "Guided conservation tours", "Marine reserve visits"],
  "Digital Detox":         ["Hiking", "Reading", "Yoga", "Swimming", "Journaling", "Watercolour painting", "Pottery", "Bread baking", "Foraging", "Stargazing"],
};

const FOCUS_ACTIVITY_MAP: Record<string, string[]> = {
  "Relax & Unwind":        ["other"],
  "Sport & Active":        ["cycling", "hiking", "trail_running", "climbing", "kayaking", "skiing", "snowboarding"],
  "Family Fun":            ["hiking", "cycling", "other"],
  "Sightseeing & Culture": ["other"],
  "Food & Gastronomy":     ["other"],
  "Adventure & Thrills":   ["hiking", "climbing", "cycling", "trail_running", "other"],
  "Wellness & Spa":        ["other"],
  "Nightlife & Social":    ["other"],
  "Wildlife & Nature":     ["other"],
  "Digital Detox":         ["hiking", "other"],
};

const ACTIVITY_SHORT: Record<string, string> = {
  cycling: "ROAD", mtb: "MTB", hiking: "HIKE",
  trail_running: "TRAIL", climbing: "CLIMB", skiing: "SKI", other: "ADV",
};

const ACTIVITY_ICON: Record<string, string> = {
  cycling:       "bike",
  road_cycling:  "bike-fast",
  mtb:           "bike-fast",
  hiking:        "hiking",
  trail_running: "run",
  climbing:      "carabiner",
  skiing:        "ski",
  kayaking:      "kayaking",
  gravel:        "bike",
  bikepacking:   "bike",
  other:         "map-marker-outline",
};


const DURATION_OPTIONS = [
  { key: "1-3", label: "1–3 days" },
  { key: "4-7", label: "4–7 days" },
  { key: "8-14", label: "1–2 weeks" },
  { key: "14+", label: "2+ weeks" },
];

const LEVEL_OPTIONS = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

const RATING_OPTIONS = Array.from({ length: 10 }, (_, i) => {
  const v = parseFloat(((i + 1) * 0.5).toFixed(1));
  return { key: v, label: `${v.toFixed(1)}+` };
});

// ─── Filter category constants ─────────────────────────────────────────────────

const FILTER_CATEGORIES: { key: FilterCategory; label: string }[] = [
  { key: "vacations",      label: "Vacations" },
  { key: "accommodations", label: "Accommodations" },
  { key: "activities",     label: "Activities" },
  { key: "restaurants",    label: "Restaurants" },
];

const PROPERTY_TYPES = [
  { key: "hotel",        label: "Hotels" },
  { key: "apartment",    label: "Apartments" },
  { key: "villa",        label: "Villas" },
  { key: "bnb",          label: "Bed & breakfasts" },
  { key: "guesthouse",   label: "Guest houses" },
  { key: "hostel",       label: "Hostels" },
  { key: "boat",         label: "Boats" },
  { key: "entire_home",  label: "Entire homes" },
];

const STAY_FACILITIES = [
  "Parking", "Swimming pool", "Spa & wellness", "Hot tub / Jacuzzi",
  "Free WiFi", "Fitness centre", "Airport shuttle", "Restaurant",
  "24-hour front desk", "EV charging station", "Non-smoking rooms",
  "Wheelchair accessible", "Room service",
];

const ROOM_FACILITIES = [
  "Private bathroom", "Balcony", "Air conditioning", "Kitchen / kitchenette",
  "Sea view", "Bath", "Hot tub", "View", "Terrace", "Linen & towels",
  "Washing machine", "Dishwasher", "Fireplace", "Electric kettle",
  "Coffee machine", "Flat-screen TV", "Heating",
];

const REVIEW_SCORE_OPTIONS = [
  { key: 9, label: "Superb: 9+" },
  { key: 8, label: "Very good: 8+" },
  { key: 7, label: "Good: 7+" },
  { key: 6, label: "Pleasant: 6+" },
];

const STAY_MEALS = [
  { key: "breakfast",    label: "Breakfast included" },
  { key: "half_board",   label: "Breakfast & dinner" },
  { key: "self_catering",label: "Self catering" },
];

const BED_PREFERENCES = [
  { key: "twin",   label: "Twin beds" },
  { key: "double", label: "Double bed" },
];

const RESERVATION_POLICIES = [
  { key: "free_cancellation", label: "Free cancellation" },
];

const TRAVEL_GROUP_OPTIONS = [
  { key: "pets",        label: "Pets allowed" },
  { key: "adults_only", label: "Adults only" },
  { key: "lgbtq",       label: "Travel Proud (LGBTQ+ friendly)" },
];

const FUN_THINGS_OPTIONS = [
  "Fitness", "Cycling", "Bicycle rental", "Walking tours",
];

const HIGHLY_RATED_OPTIONS = [
  "Very good breakfast",
];

const MEAL_TYPES = [
  { key: "breakfast", label: "Breakfast" },
  { key: "brunch",    label: "Brunch" },
  { key: "lunch",     label: "Lunch" },
  { key: "dinner",    label: "Dinner" },
  { key: "cafe",      label: "Café" },
  { key: "bar",       label: "Bar" },
];

const CUISINE_TYPES = [
  "Italian", "French", "Mediterranean", "Spanish", "Japanese",
  "Thai", "Indian", "Greek", "Chinese", "Mexican",
  "Lebanese", "Turkish", "Seafood", "Steakhouse", "International",
];

const RESTAURANT_VIBES = [
  "Casual", "Fine dining", "Family-friendly", "Romantic",
  "Lively", "Trendy", "Traditional", "Outdoor terrace",
];

const ACTIVITY_VIBES = [
  "Relax & Unwind", "Sport & Active", "Family Fun", "Sightseeing & Culture",
  "Food & Gastronomy", "Adventure & Thrills", "Wellness & Spa",
  "Nightlife & Social", "Wildlife & Nature", "Digital Detox",
];

const ACTIVITY_VIBE_SUBS: Record<string, string[]> = {
  "Relax & Unwind":        ["Sunbathing", "Yoga", "Meditation", "Reading", "Hot spring bathing", "Hammam & spa", "Slow scenic walks", "Massage therapy", "Napping on beach", "Journaling"],
  "Sport & Active":        ["Cycling", "Trail running", "Hiking", "Swimming", "Rock climbing", "Kayaking", "Open-water swimming", "Triathlon training", "Crossfit", "Stretching & mobility"],
  "Family Fun":            ["Nature trails", "Sand castle building", "Cycling", "Swimming", "Wildlife parks", "Boat trips", "Mini golf", "Theme parks", "Treasure hunts", "Ice cream tours"],
  "Sightseeing & Culture": ["Guided tours", "Museums", "Historical sites", "Architecture walks", "Viewpoints", "Photography", "Boat tours", "City walks", "Landmarks", "Local markets"],
  "Food & Gastronomy":     ["Food tours", "Cooking classes", "Wine tasting", "Market visits", "Restaurant hopping", "Farm visits", "Cheese tastings", "Foraging", "Olive oil tastings", "Craft brewery tours"],
  "Adventure & Thrills":   ["Bungee jumping", "Paragliding", "White water rafting", "Rock climbing", "Skydiving", "Cave exploration", "Zip-lining", "Surfing", "Mountain biking", "Mountaineering"],
  "Wellness & Spa":        ["Yoga", "Meditation", "Spa treatments", "Pilates", "Sound healing", "Breathwork", "Massage therapy", "Detox programme", "Forest bathing", "Silent retreat"],
  "Nightlife & Social":    ["Bar hopping", "Club nights", "Live music", "Comedy shows", "Night markets", "Rooftop bars", "Cocktail masterclasses", "Street food tours", "Jazz bars", "Festival attendance"],
  "Wildlife & Nature":     ["Safari", "Bird watching", "Whale watching", "Turtle nesting tours", "Snorkeling", "Marine diving", "Nature walks", "Wildlife photography", "Guided conservation tours", "Marine reserve visits"],
  "Digital Detox":         ["Hiking", "Reading", "Yoga", "Swimming", "Journaling", "Watercolour painting", "Pottery", "Bread baking", "Foraging", "Stargazing"],
};

const ACTIVITY_TYPE_OPTIONS = [
  { key: "hiking",        label: "Hiking" },
  { key: "cycling",       label: "Cycling" },
  { key: "trail_running", label: "Trail Running" },
  { key: "climbing",      label: "Climbing" },
  { key: "kayaking",      label: "Kayaking" },
  { key: "skiing",        label: "Skiing" },
  { key: "snowboarding",  label: "Snowboarding" },
  { key: "other",         label: "Other" },
];

// REGIONS is now derived dynamically from loaded adventures in the main component

// ─── Search constants ─────────────────────────────────────────────────────────

const ACTIVITY_CATEGORIES: {
  key:   ActivityCategory;
  label: string;
  icon:  string;
  color: string;
}[] = [
  { key: "restaurants",  label: "Restaurants",   icon: "silverware-fork-knife", color: "#EF4444" },
  { key: "bars",         label: "Bars",           icon: "glass-cocktail",        color: "#7C3AED" },
  { key: "cafes",        label: "Cafés",          icon: "coffee",                color: "#92400E" },
  { key: "hiking",       label: "Hiking",         icon: "hiking",                color: "#059669" },
  { key: "cycling",      label: "Cycling",        icon: "bike",                  color: "#2563EB" },
  { key: "trail_running",label: "Trail Running",  icon: "run",                   color: "#0891B2" },
  { key: "climbing",     label: "Climbing",       icon: "carabiner",             color: "#B91C1C" },
  { key: "kayaking",     label: "Kayaking",       icon: "kayaking",              color: "#0369A1" },
  { key: "skiing",       label: "Skiing",         icon: "ski",                   color: "#4F46E5" },
];

const CUISINE_SUGGESTIONS = [
  "Italian restaurant", "French restaurant", "Mediterranean restaurant",
  "Spanish restaurant", "Japanese restaurant", "Thai restaurant",
  "Indian restaurant", "Greek restaurant", "Chinese restaurant",
  "Mexican restaurant", "Lebanese restaurant", "Turkish restaurant",
  "Seafood restaurant", "Steakhouse", "Wine bar", "Tapas bar",
  "Café", "Bar", "Gastropub", "Bistro", "Brasserie", "Sushi",
];

type SuggestionKind = "country" | "city" | "activity" | "cuisine";

interface Suggestion {
  kind:          SuggestionKind;
  label:         string;
  sublabel?:     string;
  coords?:       [number, number];
  activityKey?:  string;
  cuisineQuery?: string;
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

function matchesDuration(days: number, min: number, max: number): boolean {
  return days >= min && days <= max;
}

function applyFilters(adventures: Adventure[], filters: FilterState): Adventure[] {
  return adventures.filter(a => {
    const cat = filters.filterCategory;

    if (cat === "activities") {
      // Filter by selected activity types
      if (filters.activityTypes.length > 0) {
        if (!a.activityTypes.some(t => filters.activityTypes.includes(t))) return false;
      }
      if (filters.level && a.level !== filters.level) return false;
      if (filters.region && a.region !== filters.region) return false;
      return true;
    }

    if (cat === "accommodations" || cat === "restaurants") {
      // No adventure-level filtering for these categories; pins handle it
      return true;
    }

    // ── Vacations (default) ─────────────────────────────────────────────────
    let settingTypes: string[] | null = null;
    if (filters.activities.length > 0) {
      settingTypes = filters.subActivities.length > 0
        ? filters.subActivities.map(sa => SUB_ACTIVITY_TYPE_MAP[sa] ?? "other")
        : filters.activities.flatMap(s => SETTING_ACTIVITY_MAP[s] ?? []);
    }
    let focusTypes: string[] | null = null;
    if (filters.focuses.length > 0) {
      focusTypes = filters.focusSubActivities.length > 0
        ? filters.focusSubActivities.map(sa => SUB_ACTIVITY_TYPE_MAP[sa] ?? "other")
        : filters.focuses.flatMap(f => FOCUS_ACTIVITY_MAP[f] ?? []);
    }
    if (settingTypes && focusTypes) {
      const focusSet = new Set(focusTypes);
      const combined = settingTypes.filter(t => focusSet.has(t));
      if (!a.activityTypes.some(t => combined.includes(t))) return false;
    } else if (settingTypes) {
      if (!a.activityTypes.some(t => settingTypes!.includes(t))) return false;
    } else if (focusTypes) {
      if (!a.activityTypes.some(t => focusTypes!.includes(t))) return false;
    }
    if (!matchesDuration(a.days, filters.durationMin, filters.durationMax)) return false;
    if (filters.minBudget > PRICE_MIN || filters.maxBudget < PRICE_MAX) {
      const price = BUDGET_PRICE[a.budget] ?? 250;
      if (price < filters.minBudget || price > filters.maxBudget) return false;
    }
    if (filters.level && a.level !== filters.level) return false;
    if (filters.rating !== null && a.rating < filters.rating) return false;
    if (filters.region && a.region !== filters.region) return false;
    return true;
  });
}

function countActiveFilters(filters: FilterState): number {
  let n = 0;
  const cat = filters.filterCategory;
  if (cat === "vacations") {
    n = filters.activities.length + filters.subActivities.length
      + filters.focuses.length + filters.focusSubActivities.length;
    if (filters.durationMin > DURATION_MIN || filters.durationMax < DURATION_MAX) n++;
    if (filters.minBudget > PRICE_MIN || filters.maxBudget < PRICE_MAX) n++;
    if (filters.level) n++;
    if (filters.rating !== null) n++;
    if (filters.region) n++;
  } else if (cat === "accommodations") {
    n = filters.propertyTypes.length + filters.facilities.length + filters.roomFacilities.length
      + filters.stayMeals.length + filters.reservationPolicy.length + filters.travelGroup.length
      + filters.funThingsToDo.length + filters.neighbourhoods.length + filters.landmarks.length
      + filters.highlyRated.length + filters.bedrooms + filters.bathrooms;
    if (filters.reviewScore !== null) n++;
    if (filters.propertyRating !== null) n++;
    if (filters.bedPreference !== null) n++;
    if (filters.maxPricePerNight < ACCOMMODATION_PRICE_MAX) n++;
    if (filters.onlinePayment) n++;
    if (filters.sustainabilityBadge) n++;
  } else if (cat === "activities") {
    n = filters.activityTypes.length + filters.activityVibes.length + filters.activitySubItems.length;
    if (filters.level) n++;
  } else if (cat === "restaurants") {
    n = filters.mealTypes.length + filters.cuisines.length + filters.restaurantVibes.length;
    if (filters.maxPricePerMeal < MEAL_PRICE_MAX) n++;
  }
  return n;
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatDuration(days: number): string {
  if (days < 7) return `${days} days`;
  const weeks = Math.round(days / 7);
  if (days < 28) return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  const months = Math.round(days / 30);
  if (days < 365) return `${months} ${months === 1 ? "month" : "months"}`;
  const years = Math.round(days / 365);
  return `${years} ${years === 1 ? "year" : "years"}`;
}

function formatBudget(budget: string): string {
  const map: Record<string, string> = { budget: "$", mid: "$$", luxury: "$$$" };
  return map[budget] ?? "$";
}

// ─── Budget slider ────────────────────────────────────────────────────────────

function RangeSlider({
  high, onChange, min = PRICE_MIN, max = PRICE_MAX, step = 100, labelFn,
}: {
  high: number;
  onChange: (high: number) => void;
  min?: number;
  max?: number;
  step?: number;
  labelFn?: (v: number, isMax: boolean) => string;
}) {
  const trackWidthRef = useRef(1);
  const highRef       = useRef(high);
  highRef.current     = high;
  const startHigh     = useRef(high);

  const toPercent = (v: number) => (v - min) / (max - min);
  const toValue   = (p: number) =>
    Math.round(Math.max(min, Math.min(max, p * (max - min) + min)) / step) * step;

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { startHigh.current = highRef.current; },
    onPanResponderMove: (_, g) => {
      const delta   = g.dx / trackWidthRef.current;
      const newHigh = toValue(toPercent(startHigh.current) + delta);
      onChange(Math.max(newHigh, min + step));
    },
  }), [onChange]);

  const highPct = toPercent(high) * 100;
  const HANDLE  = 22;
  const isMax   = high >= max;
  const label   = labelFn ? labelFn(high, isMax) : isMax ? "Any" : `Up to €${high.toLocaleString()}`;

  return (
    <View style={rangeStyles.wrapper}>
      <Text style={rangeStyles.priceLabel}>{label}</Text>
      <View
        style={[rangeStyles.trackContainer, { marginTop: 14 }]}
        onLayout={e => { trackWidthRef.current = e.nativeEvent.layout.width; }}
      >
        <View style={rangeStyles.track} />
        <View style={[rangeStyles.selectedRange, { left: 0, width: `${highPct}%` as any }]} />
        <View
          style={[rangeStyles.handle, {
            left: `${highPct}%` as any,
            transform: [{ translateX: -(HANDLE / 2) }],
          }]}
          {...pan.panHandlers}
        />
      </View>
    </View>
  );
}

// ─── Dual range slider (two handles + text inputs) ────────────────────────────

function DualRangeSlider({
  low, high, min, max, step, unit, onChange,
}: {
  low: number; high: number;
  min: number; max: number;
  step: number; unit?: string;
  onChange: (low: number, high: number) => void;
}) {
  const trackWidthRef = useRef(1);
  const lowRef        = useRef(low);
  const highRef       = useRef(high);
  lowRef.current      = low;
  highRef.current     = high;
  const startLow      = useRef(low);
  const startHigh     = useRef(high);
  const [lowInput,  setLowInput]  = useState(String(low));
  const [highInput, setHighInput] = useState(String(high));

  useEffect(() => { setLowInput(String(low)); },  [low]);
  useEffect(() => { setHighInput(String(high)); }, [high]);

  const toPercent = (v: number) => (v - min) / (max - min);
  const toValue   = (p: number) =>
    Math.round(Math.max(min, Math.min(max, p * (max - min) + min)) / step) * step;

  const lowPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { startLow.current = lowRef.current; },
    onPanResponderMove: (_, g) => {
      const newLow = toValue(toPercent(startLow.current) + g.dx / trackWidthRef.current);
      onChange(Math.min(newLow, highRef.current - step), highRef.current);
    },
  }), [onChange]);

  const highPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { startHigh.current = highRef.current; },
    onPanResponderMove: (_, g) => {
      const newHigh = toValue(toPercent(startHigh.current) + g.dx / trackWidthRef.current);
      onChange(lowRef.current, Math.max(newHigh, lowRef.current + step));
    },
  }), [onChange]);

  const lowPct  = toPercent(low)  * 100;
  const highPct = toPercent(high) * 100;
  const HANDLE  = 22;

  const commitLow = () => {
    const v = Math.round(parseFloat(lowInput) / step) * step;
    if (!isNaN(v)) {
      onChange(Math.max(min, Math.min(v, highRef.current - step)), highRef.current);
    } else {
      setLowInput(String(low));
    }
  };
  const commitHigh = () => {
    const v = Math.round(parseFloat(highInput) / step) * step;
    if (!isNaN(v)) {
      onChange(lowRef.current, Math.min(max, Math.max(v, lowRef.current + step)));
    } else {
      setHighInput(String(high));
    }
  };

  return (
    <View style={dualRangeStyles.wrapper}>
      <View
        style={[rangeStyles.trackContainer, { marginTop: 14 }]}
        onLayout={e => { trackWidthRef.current = e.nativeEvent.layout.width; }}
      >
        <View style={rangeStyles.track} />
        <View style={[rangeStyles.selectedRange, {
          left: `${lowPct}%` as any,
          width: `${highPct - lowPct}%` as any,
        }]} />
        <View
          style={[rangeStyles.handle, { left: `${lowPct}%` as any, transform: [{ translateX: -(HANDLE / 2) }] }]}
          {...lowPan.panHandlers}
        />
        <View
          style={[rangeStyles.handle, { left: `${highPct}%` as any, transform: [{ translateX: -(HANDLE / 2) }] }]}
          {...highPan.panHandlers}
        />
      </View>
      <View style={dualRangeStyles.inputRow}>
        <View style={dualRangeStyles.inputBox}>
          <Text style={dualRangeStyles.inputLabel}>Min</Text>
          <View style={dualRangeStyles.inputInner}>
            <TextInput
              style={dualRangeStyles.input}
              keyboardType="numeric"
              value={lowInput}
              onChangeText={setLowInput}
              onBlur={commitLow}
              onSubmitEditing={commitLow}
            />
            {unit ? <Text style={dualRangeStyles.inputUnit}>{unit}</Text> : null}
          </View>
        </View>
        <View style={dualRangeStyles.inputSep} />
        <View style={dualRangeStyles.inputBox}>
          <Text style={dualRangeStyles.inputLabel}>Max</Text>
          <View style={dualRangeStyles.inputInner}>
            <TextInput
              style={dualRangeStyles.input}
              keyboardType="numeric"
              value={highInput}
              onChangeText={setHighInput}
              onBlur={commitHigh}
              onSubmitEditing={commitHigh}
            />
            {unit ? <Text style={dualRangeStyles.inputUnit}>{unit}</Text> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Location text input with autocomplete ────────────────────────────────────

function LocationInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery]   = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => { setQuery(value); }, [value]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return ALL_LOCATIONS.filter(l => l.toLowerCase().includes(q)).slice(0, 6);
  }, [query]);

  const showSuggestions = focused && suggestions.length > 0;

  function commit(text: string) {
    setQuery(text);
    onChange(text.trim());
    setFocused(false);
  }

  return (
    <View>
      <View style={filterStyles.locationInputRow}>
        <Feather name="map-pin" size={15} color={colors.muted} style={{ marginRight: 6 }} />
        <TextInput
          style={filterStyles.locationInput}
          placeholder="Country, region, city or town…"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={t => { setQuery(t); onChange(t.trim()); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => commit(query)}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => commit("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={15} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>
      {showSuggestions && (
        <View style={filterStyles.locationSuggestions}>
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={s}
              style={[filterStyles.locationSuggestionRow, i === suggestions.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => commit(s)}
              activeOpacity={0.7}
            >
              <Feather name="map-pin" size={13} color={colors.muted} />
              <Text style={filterStyles.locationSuggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Filter sheet ─────────────────────────────────────────────────────────────

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={filterStyles.section}>
      <Text style={filterStyles.sectionTitle}>{title}</Text>
      <View style={filterStyles.optionRow}>{children}</View>
    </View>
  );
}

function FilterChip({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[filterStyles.chip, active && filterStyles.chipActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[filterStyles.chipText, active && filterStyles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FilterSheet({
  visible, filters, onChange, onClose, onReset,
  neighbourhoodOptions, landmarkOptions, loadingGeoData,
}: {
  visible: boolean;
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onClose: () => void;
  onReset: () => void;
  neighbourhoodOptions: string[];
  landmarkOptions: string[];
  loadingGeoData: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const toggleExpand = (key: string) =>
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  if (!visible) return null;

  const cat = filters.filterCategory;

  // ── Vacation helpers ──────────────────────────────────────────────────────────
  const availableSubActivities = [...new Set(
    filters.activities.flatMap(s => SETTING_SUB_ACTIVITIES[s] ?? [])
  )];
  const showLevel = filters.activities.some(k =>
    (SETTING_ACTIVITY_MAP[k] ?? []).some(t => t !== "other")
  );
  const toggleSetting = (key: string) => {
    const removing = filters.activities.includes(key);
    const acts = removing
      ? filters.activities.filter(a => a !== key)
      : [...filters.activities, key];
    let subs = filters.subActivities;
    if (removing) {
      const still = new Set(acts.flatMap(s => SETTING_SUB_ACTIVITIES[s] ?? []));
      subs = subs.filter(sa => still.has(sa));
    }
    onChange({ ...filters, activities: acts, subActivities: subs });
  };

  // ── Activity helpers ──────────────────────────────────────────────────────────
  const availableActivitySubs = [...new Set(
    filters.activityVibes.flatMap(v => ACTIVITY_VIBE_SUBS[v] ?? [])
  )];
  const toggleActivityVibe = (vibe: string) => {
    const removing = filters.activityVibes.includes(vibe);
    const next = removing
      ? filters.activityVibes.filter(v => v !== vibe)
      : [...filters.activityVibes, vibe];
    let subs = filters.activitySubItems;
    if (removing) {
      const still = new Set(next.flatMap(v => ACTIVITY_VIBE_SUBS[v] ?? []));
      subs = subs.filter(s => still.has(s));
    }
    onChange({ ...filters, activityVibes: next, activitySubItems: subs });
  };

  const toggle = <T extends string>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

  return (
    <View style={filterStyles.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />
      <View style={[filterStyles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>

        {/* Header */}
        <View style={filterStyles.header}>
          <Text style={filterStyles.headerTitle}>Filter</Text>
          <View style={filterStyles.headerActions}>
            <TouchableOpacity onPress={onReset}>
              <Text style={filterStyles.resetText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={filterStyles.closeBtn}>
              <Feather name="x" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Category tabs */}
        <View style={filterStyles.catScrollWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={filterStyles.catScrollContent}
          >
            {FILTER_CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.key}
                style={[filterStyles.catTab, cat === c.key && filterStyles.catTabActive]}
                onPress={() => onChange({ ...filters, filterCategory: c.key })}
                activeOpacity={0.8}
              >
                <Text
                  numberOfLines={1}
                  style={[filterStyles.catTabText, cat === c.key && filterStyles.catTabTextActive]}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={filterStyles.body}>

          {/* ── VACATIONS ────────────────────────────────────────────────────── */}
          {cat === "vacations" && <>
            <View style={filterStyles.section}>
              <Text style={filterStyles.sectionTitle}>Duration</Text>
              <DualRangeSlider
                low={filters.durationMin}
                high={filters.durationMax}
                min={DURATION_MIN} max={DURATION_MAX} step={1} unit="days"
                onChange={(lo, hi) => onChange({ ...filters, durationMin: lo, durationMax: hi })}
              />
            </View>

            <View style={filterStyles.section}>
              <Text style={filterStyles.sectionTitle}>Budget</Text>
              <DualRangeSlider
                low={filters.minBudget}
                high={filters.maxBudget}
                min={PRICE_MIN} max={PRICE_MAX} step={100} unit="€"
                onChange={(lo, hi) => onChange({ ...filters, minBudget: lo, maxBudget: hi })}
              />
            </View>

            <FilterSection title="Rating">
              {RATING_OPTIONS.map(o => (
                <FilterChip key={o.key} label={o.label}
                  active={filters.rating === o.key}
                  onPress={() => onChange({ ...filters, rating: filters.rating === o.key ? null : o.key as number })}
                />
              ))}
            </FilterSection>

            <View style={filterStyles.section}>
              <Text style={filterStyles.sectionTitle}>Location</Text>
              <LocationInput
                value={filters.region ?? ""}
                onChange={v => onChange({ ...filters, region: v || null })}
              />
            </View>

            <FilterSection title="Vacation type">
              {FOCUS_OPTIONS.map(f => (
                <FilterChip key={f} label={f}
                  active={filters.focuses.includes(f)}
                  onPress={() => {
                    const removing = filters.focuses.includes(f);
                    const next = removing ? filters.focuses.filter(x => x !== f) : [...filters.focuses, f];
                    let subs = filters.focusSubActivities;
                    if (removing) {
                      const still = new Set(next.flatMap(fo => FOCUS_SUB_ACTIVITIES[fo] ?? []));
                      subs = subs.filter(sa => still.has(sa));
                    }
                    onChange({ ...filters, focuses: next, focusSubActivities: subs });
                  }}
                />
              ))}
            </FilterSection>

            {filters.focuses.length > 0 && (
              <FilterSection title="Experiences">
                {[...new Set(filters.focuses.flatMap(f => FOCUS_SUB_ACTIVITIES[f] ?? []))].map(act => (
                  <FilterChip key={act} label={act}
                    active={filters.focusSubActivities.includes(act)}
                    onPress={() => onChange({ ...filters, focusSubActivities: toggle(filters.focusSubActivities, act) })}
                  />
                ))}
              </FilterSection>
            )}

            <FilterSection title="Setting">
              {SETTING_OPTIONS.map(o => (
                <FilterChip key={o.key} label={o.label}
                  active={filters.activities.includes(o.key)}
                  onPress={() => toggleSetting(o.key)}
                />
              ))}
            </FilterSection>

            {showLevel && (
              <FilterSection title="Experience level">
                {LEVEL_OPTIONS.map(o => (
                  <FilterChip key={o.key} label={o.label}
                    active={filters.level === o.key}
                    onPress={() => onChange({ ...filters, level: filters.level === o.key ? null : o.key })}
                  />
                ))}
              </FilterSection>
            )}

            {availableSubActivities.length > 0 && (
              <FilterSection title="Activities">
                {availableSubActivities.map(act => (
                  <FilterChip key={act} label={act}
                    active={filters.subActivities.includes(act)}
                    onPress={() => onChange({ ...filters, subActivities: toggle(filters.subActivities, act) })}
                  />
                ))}
              </FilterSection>
            )}
          </>}

          {/* ── STAYS ────────────────────────────────────────────────────────── */}
          {cat === "accommodations" && <>

            {/* Property type */}
            <FilterSection title="Property type">
              {PROPERTY_TYPES.map(o => (
                <FilterChip key={o.key} label={o.label}
                  active={filters.propertyTypes.includes(o.key)}
                  onPress={() => onChange({ ...filters, propertyTypes: toggle(filters.propertyTypes, o.key) })}
                />
              ))}
            </FilterSection>

            {/* Bedrooms & bathrooms */}
            <View style={filterStyles.section}>
              <Text style={filterStyles.sectionTitle}>Bedrooms & bathrooms</Text>
              {(["bedrooms", "bathrooms"] as const).map(field => (
                <View key={field} style={filterStyles.counterRow}>
                  <Text style={filterStyles.counterLabel}>
                    {field === "bedrooms" ? "Bedrooms" : "Bathrooms"}
                  </Text>
                  <View style={filterStyles.counter}>
                    <TouchableOpacity
                      style={filterStyles.counterBtn}
                      onPress={() => onChange({ ...filters, [field]: Math.max(0, filters[field] - 1) })}
                    >
                      <Feather name="minus" size={14} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={filterStyles.counterValue}>
                      {filters[field] === 0 ? "Any" : filters[field] >= 4 ? "4+" : String(filters[field])}
                    </Text>
                    <TouchableOpacity
                      style={filterStyles.counterBtn}
                      onPress={() => onChange({ ...filters, [field]: Math.min(4, filters[field] + 1) })}
                    >
                      <Feather name="plus" size={14} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            {/* Price per night */}
            <View style={filterStyles.section}>
              <Text style={filterStyles.sectionTitle}>Price per night</Text>
              <RangeSlider
                high={filters.maxPricePerNight} max={ACCOMMODATION_PRICE_MAX} step={10}
                labelFn={(v, isMax) => isMax ? "Any price" : `Up to €${v}/night`}
                onChange={hi => onChange({ ...filters, maxPricePerNight: hi })}
              />
            </View>

            {/* Review score */}
            <FilterSection title="Review score">
              {REVIEW_SCORE_OPTIONS.map(o => (
                <FilterChip key={o.key} label={o.label}
                  active={filters.reviewScore === o.key}
                  onPress={() => onChange({ ...filters, reviewScore: filters.reviewScore === o.key ? null : o.key })}
                />
              ))}
            </FilterSection>

            {/* Property rating */}
            <View style={filterStyles.section}>
              <Text style={filterStyles.sectionTitle}>Property rating</Text>
              <View style={filterStyles.starRow}>
                {[1, 2, 3, 4, 5].map(n => (
                  <TouchableOpacity
                    key={n}
                    style={[filterStyles.starChip, filters.propertyRating === n && filterStyles.starChipActive]}
                    onPress={() => onChange({ ...filters, propertyRating: filters.propertyRating === n ? null : n })}
                    activeOpacity={0.75}
                  >
                    <Text style={[filterStyles.starText, filters.propertyRating === n && filterStyles.starTextActive]}>
                      {"★".repeat(n)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Meals */}
            <FilterSection title="Meals">
              {STAY_MEALS.map(o => (
                <FilterChip key={o.key} label={o.label}
                  active={filters.stayMeals.includes(o.key)}
                  onPress={() => onChange({ ...filters, stayMeals: toggle(filters.stayMeals, o.key) })}
                />
              ))}
            </FilterSection>

            {/* Facilities */}
            <FilterSection title="Facilities">
              {(expandedSections.has("fac") ? STAY_FACILITIES : STAY_FACILITIES.slice(0, 6)).map(f => (
                <FilterChip key={f} label={f}
                  active={filters.facilities.includes(f)}
                  onPress={() => onChange({ ...filters, facilities: toggle(filters.facilities, f) })}
                />
              ))}
              <TouchableOpacity onPress={() => toggleExpand("fac")} style={filterStyles.showMoreBtn}>
                <Text style={filterStyles.showMoreText}>
                  {expandedSections.has("fac") ? "Show less" : `Show ${STAY_FACILITIES.length - 6} more`}
                </Text>
              </TouchableOpacity>
            </FilterSection>

            {/* Room facilities */}
            <FilterSection title="Room facilities">
              {(expandedSections.has("rfac") ? ROOM_FACILITIES : ROOM_FACILITIES.slice(0, 6)).map(f => (
                <FilterChip key={f} label={f}
                  active={filters.roomFacilities.includes(f)}
                  onPress={() => onChange({ ...filters, roomFacilities: toggle(filters.roomFacilities, f) })}
                />
              ))}
              <TouchableOpacity onPress={() => toggleExpand("rfac")} style={filterStyles.showMoreBtn}>
                <Text style={filterStyles.showMoreText}>
                  {expandedSections.has("rfac") ? "Show less" : `Show ${ROOM_FACILITIES.length - 6} more`}
                </Text>
              </TouchableOpacity>
            </FilterSection>

            {/* Neighbourhood — dynamic from Mapbox */}
            <View style={filterStyles.section}>
              <Text style={filterStyles.sectionTitle}>Neighbourhood</Text>
              {loadingGeoData ? (
                <Text style={filterStyles.geoLoading}>Detecting area…</Text>
              ) : neighbourhoodOptions.length === 0 ? (
                <Text style={filterStyles.geoLoading}>No neighbourhoods found for this area</Text>
              ) : (
                <View style={filterStyles.optionRow}>
                  {(expandedSections.has("nb")
                    ? neighbourhoodOptions
                    : neighbourhoodOptions.slice(0, 8)
                  ).map(nb => (
                    <FilterChip key={nb} label={nb}
                      active={filters.neighbourhoods.includes(nb)}
                      onPress={() => onChange({ ...filters, neighbourhoods: toggle(filters.neighbourhoods, nb) })}
                    />
                  ))}
                  {neighbourhoodOptions.length > 8 && (
                    <TouchableOpacity onPress={() => toggleExpand("nb")} style={filterStyles.showMoreBtn}>
                      <Text style={filterStyles.showMoreText}>
                        {expandedSections.has("nb") ? "Show less" : `Show ${neighbourhoodOptions.length - 8} more`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Bed preference */}
            <FilterSection title="Bed preference">
              {BED_PREFERENCES.map(o => (
                <FilterChip key={o.key} label={o.label}
                  active={filters.bedPreference === o.key}
                  onPress={() => onChange({ ...filters, bedPreference: filters.bedPreference === o.key ? null : o.key })}
                />
              ))}
            </FilterSection>

            {/* Reservation policy */}
            <FilterSection title="Reservation policy">
              {RESERVATION_POLICIES.map(o => (
                <FilterChip key={o.key} label={o.label}
                  active={filters.reservationPolicy.includes(o.key)}
                  onPress={() => onChange({ ...filters, reservationPolicy: toggle(filters.reservationPolicy, o.key) })}
                />
              ))}
            </FilterSection>

            {/* Travel group */}
            <FilterSection title="Travel group">
              {TRAVEL_GROUP_OPTIONS.map(o => (
                <FilterChip key={o.key} label={o.label}
                  active={filters.travelGroup.includes(o.key)}
                  onPress={() => onChange({ ...filters, travelGroup: toggle(filters.travelGroup, o.key) })}
                />
              ))}
            </FilterSection>

            {/* Fun things to do */}
            <FilterSection title="Fun things to do">
              {FUN_THINGS_OPTIONS.map(f => (
                <FilterChip key={f} label={f}
                  active={filters.funThingsToDo.includes(f)}
                  onPress={() => onChange({ ...filters, funThingsToDo: toggle(filters.funThingsToDo, f) })}
                />
              ))}
            </FilterSection>

            {/* Landmarks — dynamic from Mapbox */}
            {landmarkOptions.length > 0 && !loadingGeoData && (
              <View style={filterStyles.section}>
                <Text style={filterStyles.sectionTitle}>Landmarks</Text>
                <View style={filterStyles.optionRow}>
                  {(expandedSections.has("lm") ? landmarkOptions : landmarkOptions.slice(0, 6)).map(lm => (
                    <FilterChip key={lm} label={lm}
                      active={filters.landmarks.includes(lm)}
                      onPress={() => onChange({ ...filters, landmarks: toggle(filters.landmarks, lm) })}
                    />
                  ))}
                  {landmarkOptions.length > 6 && (
                    <TouchableOpacity onPress={() => toggleExpand("lm")} style={filterStyles.showMoreBtn}>
                      <Text style={filterStyles.showMoreText}>
                        {expandedSections.has("lm") ? "Show less" : `Show ${landmarkOptions.length - 6} more`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Highly rated */}
            <FilterSection title="Highly rated features">
              {HIGHLY_RATED_OPTIONS.map(f => (
                <FilterChip key={f} label={f}
                  active={filters.highlyRated.includes(f)}
                  onPress={() => onChange({ ...filters, highlyRated: toggle(filters.highlyRated, f) })}
                />
              ))}
            </FilterSection>

            {/* Toggles */}
            <View style={filterStyles.section}>
              {([
                { field: "onlinePayment" as const,       label: "Online payment",           sub: "Accepts online payments" },
                { field: "sustainabilityBadge" as const, label: "Sustainability certified",  sub: "Has sustainability certification" },
              ]).map(({ field, label, sub }) => (
                <View key={field} style={filterStyles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={filterStyles.toggleLabel}>{label}</Text>
                    <Text style={filterStyles.toggleSub}>{sub}</Text>
                  </View>
                  <TouchableOpacity
                    style={[filterStyles.toggle, filters[field] && filterStyles.toggleOn]}
                    onPress={() => onChange({ ...filters, [field]: !filters[field] })}
                    activeOpacity={0.8}
                  >
                    <View style={[filterStyles.toggleThumb, filters[field] && filterStyles.toggleThumbOn]} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

          </>}

          {/* ── ACTIVITIES ───────────────────────────────────────────────────── */}
          {cat === "activities" && <>
            <FilterSection title="Activity type">
              {ACTIVITY_TYPE_OPTIONS.map(o => (
                <FilterChip key={o.key} label={o.label}
                  active={filters.activityTypes.includes(o.key)}
                  onPress={() => onChange({ ...filters, activityTypes: toggle(filters.activityTypes, o.key) })}
                />
              ))}
            </FilterSection>

            <FilterSection title="What would you like to do?">
              {ACTIVITY_VIBES.map(v => (
                <FilterChip key={v} label={v}
                  active={filters.activityVibes.includes(v)}
                  onPress={() => toggleActivityVibe(v)}
                />
              ))}
            </FilterSection>

            {availableActivitySubs.length > 0 && (
              <FilterSection title="Which activities interest you?">
                {availableActivitySubs.map(act => (
                  <FilterChip key={act} label={act}
                    active={filters.activitySubItems.includes(act)}
                    onPress={() => onChange({ ...filters, activitySubItems: toggle(filters.activitySubItems, act) })}
                  />
                ))}
              </FilterSection>
            )}

            <FilterSection title="Experience level">
              {LEVEL_OPTIONS.map(o => (
                <FilterChip key={o.key} label={o.label}
                  active={filters.level === o.key}
                  onPress={() => onChange({ ...filters, level: filters.level === o.key ? null : o.key })}
                />
              ))}
            </FilterSection>
          </>}

          {/* ── RESTAURANTS ──────────────────────────────────────────────────── */}
          {cat === "restaurants" && <>
            <FilterSection title="Meal">
              {MEAL_TYPES.map(o => (
                <FilterChip key={o.key} label={o.label}
                  active={filters.mealTypes.includes(o.key)}
                  onPress={() => onChange({ ...filters, mealTypes: toggle(filters.mealTypes, o.key) })}
                />
              ))}
            </FilterSection>

            <FilterSection title="Cuisine">
              {CUISINE_TYPES.map(c => (
                <FilterChip key={c} label={c}
                  active={filters.cuisines.includes(c)}
                  onPress={() => onChange({ ...filters, cuisines: toggle(filters.cuisines, c) })}
                />
              ))}
            </FilterSection>

            <FilterSection title="Vibe">
              {RESTAURANT_VIBES.map(v => (
                <FilterChip key={v} label={v}
                  active={filters.restaurantVibes.includes(v)}
                  onPress={() => onChange({ ...filters, restaurantVibes: toggle(filters.restaurantVibes, v) })}
                />
              ))}
            </FilterSection>

            <View style={filterStyles.section}>
              <Text style={filterStyles.sectionTitle}>Price per person</Text>
              <RangeSlider
                high={filters.maxPricePerMeal} max={MEAL_PRICE_MAX} step={5}
                labelFn={(v, isMax) => isMax ? "Any price" : `Up to €${v}/person`}
                onChange={hi => onChange({ ...filters, maxPricePerMeal: hi })}
              />
            </View>
          </>}

        </ScrollView>
      </View>
    </View>
  );
}

// ─── Adventure bottom sheet ───────────────────────────────────────────────────

const SHEET_HEIGHT = 290;

function AdventureSheet({
  adventure, translateY, onClose, onPlan,
}: {
  adventure: Adventure | null;
  translateY: Animated.Value;
  onClose: () => void;
  onPlan: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!adventure) return null;
  const pinColor = ACTIVITY_COLOR[adventure.activityTypes[0]] ?? colors.accent;

  return (
    <Animated.View style={[
      styles.sheet,
      { transform: [{ translateY }], paddingBottom: insets.bottom + spacing.sm },
    ]}>
      <View style={styles.handle} />
      <View style={styles.sheetContent}>
        <View style={styles.sheetTopRow}>
          <View style={[styles.activityChip, { backgroundColor: pinColor + "22" }]}>
            <Text style={[styles.activityChipText, { color: pinColor }]}>
              {ACTIVITY_SHORT[adventure.activityTypes[0]] ?? "ADV"}
            </Text>
          </View>
          <Text style={styles.regionText}>{adventure.region}, {adventure.country}</Text>
          <Text style={styles.ratingText}>★ {adventure.rating}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Feather name="x" size={16} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sheetTitle}>{adventure.title}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statText}>{adventure.days} days</Text>
          </View>
          {adventure.avgDistanceKm && (
            <View style={styles.statChip}>
              <Text style={styles.statText}>{adventure.avgDistanceKm} km/day</Text>
            </View>
          )}
          {adventure.avgElevationM && (
            <View style={styles.statChip}>
              <Text style={styles.statText}>{adventure.avgElevationM} m ↑/day</Text>
            </View>
          )}
          <View style={styles.statChip}>
            <Text style={styles.statText}>{adventure.level}</Text>
          </View>
        </View>

        <Text style={styles.sheetDesc} numberOfLines={2}>{adventure.description}</Text>

        <TouchableOpacity style={styles.ctaBtn} onPress={onPlan} activeOpacity={0.85}>
          <Text style={styles.ctaText}>Explore this adventure</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Adventure pin ────────────────────────────────────────────────────────────

function AdventurePin() {
  return (
    <View style={pillStyles.adventurePin}>
      <MaterialCommunityIcons name="bag-suitcase" size={18} color="#FFFFFF" />
    </View>
  );
}

function MapPin({ category }: { category: string }) {
  const cat  = ACTIVITY_CATEGORIES.find(c => c.key === category);
  const icon = (cat?.icon ?? "map-marker-outline") as React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  const bg   = cat?.color ?? colors.accent;
  return (
    <View style={[pillStyles.activityPin, { backgroundColor: bg }]}>
      <MaterialCommunityIcons name={icon} size={15} color="#FFFFFF" />
    </View>
  );
}

// ─── Adventure card (impressions tile) ────────────────────────────────────────

function AdventureCard({
  adventure, isSaved, onToggleSaved, onPress,
}: {
  adventure: Adventure;
  isSaved: boolean;
  onToggleSaved: () => void;
  onPress: () => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);

  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.95}>
      {/* Image section — rounded, inset from card edge */}
      <View style={cardStyles.imageWrap}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_W - 16));
            setPhotoIndex(idx);
          }}
          scrollEventThrottle={16}
          style={StyleSheet.absoluteFillObject}
        >
          {adventure.photos.map((uri, i) => (
            <Image
              key={i}
              source={{ uri }}
              style={{ width: CARD_W - 16, height: IMAGE_H }}
              resizeMode="cover"
            />
          ))}
        </ScrollView>

        {/* Heart button */}
        <TouchableOpacity
          style={cardStyles.heartBtn}
          onPress={onToggleSaved}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons
            name={isSaved ? "heart" : "heart-outline"}
            size={20}
            color={isSaved ? "#EF4444" : "#FFFFFF"}
          />
        </TouchableOpacity>

        {/* Photo dots */}
        {adventure.photos.length > 1 && (
          <View style={cardStyles.dots}>
            {adventure.photos.map((_, i) => (
              <View key={i} style={[cardStyles.dot, photoIndex === i && cardStyles.dotActive]} />
            ))}
          </View>
        )}
      </View>

      {/* Text section — white area below image */}
      <View style={cardStyles.textArea}>
        <Text style={cardStyles.cardTitle} numberOfLines={2}>{adventure.title}</Text>
        <View style={cardStyles.subtitleRow}>
          {adventure.activityTypes.map(type => {
            const iconName = (ACTIVITY_ICON[type] ?? "map-marker-outline") as React.ComponentProps<typeof MaterialCommunityIcons>["name"];
            return (
              <MaterialCommunityIcons key={type} name={iconName} size={13} color={colors.muted} />
            );
          })}
          <Text style={cardStyles.cardSubtitle}>
            {formatDuration(adventure.days)} · {adventure.level} · {formatBudget(adventure.budget)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Adventure expanded modal ─────────────────────────────────────────────────

function AdventureExpandedModal({
  adventure, visible, isSaved, onToggleSaved, onClose,
}: {
  adventure: Adventure | null;
  visible: boolean;
  isSaved: boolean;
  onToggleSaved: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [forking, setForking] = useState(false);

  async function handleAddToMyTrips() {
    if (!adventure || forking) return;
    setForking(true);
    try {
      const { id } = await forkAdventure(adventure.id);
      onClose();
      router.push(`/(app)/trips/${id}` as any);
    } catch (e) {
      Alert.alert("Couldn't copy itinerary", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setForking(false);
    }
  }
  const MODAL_W  = SCREEN_W - spacing.md * 2;
  const PHOTO_H  = MODAL_W * 0.62;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      {adventure && (
        <View style={[modalStyles.container, { paddingTop: insets.top }]}>
          {/* Top bar */}
          <View style={modalStyles.topBar}>
            <TouchableOpacity style={modalStyles.iconBtn} onPress={onClose}>
              <Feather name="arrow-left" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={modalStyles.iconBtn} onPress={onToggleSaved}>
              <MaterialCommunityIcons
                name={isSaved ? "heart" : "heart-outline"}
                size={20}
                color={isSaved ? "#EF4444" : colors.muted}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          >
            {/* Photo card — same inset tile style */}
            <View style={modalStyles.photoCard}>
              <View style={[modalStyles.imageWrap, { height: PHOTO_H }]}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / (MODAL_W - 16));
                    setPhotoIndex(idx);
                  }}
                  scrollEventThrottle={16}
                  style={StyleSheet.absoluteFillObject}
                >
                  {adventure.photos.map((uri, i) => (
                    <Image
                      key={i}
                      source={{ uri }}
                      style={{ width: MODAL_W - 16, height: PHOTO_H }}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
                {adventure.photos.length > 1 && (
                  <View style={modalStyles.photoDots}>
                    {adventure.photos.map((_, i) => (
                      <View key={i} style={[modalStyles.photoDot, photoIndex === i && modalStyles.photoDotActive]} />
                    ))}
                  </View>
                )}
              </View>

              {/* Text area inside card */}
              <View style={modalStyles.cardText}>
                <Text style={modalStyles.modalTitle} numberOfLines={2}>{adventure.title}</Text>
                <View style={modalStyles.locationRow}>
                  <Feather name="map-pin" size={12} color={colors.muted} />
                  <Text style={modalStyles.locationText}>{adventure.region}, {adventure.country}</Text>
                  {adventure.rating > 0 && (
                    <Text style={modalStyles.ratingBadge}>★ {adventure.rating}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Chips */}
            <View style={modalStyles.chipsRow}>
              <View style={modalStyles.detailChip}>
                <Text style={modalStyles.detailChipText}>{formatDuration(adventure.days)}</Text>
              </View>
              <View style={modalStyles.detailChip}>
                <Text style={modalStyles.detailChipText}>{adventure.level}</Text>
              </View>
              <View style={modalStyles.detailChip}>
                <Text style={modalStyles.detailChipText}>{formatBudget(adventure.budget)}</Text>
              </View>
              {adventure.activityTypes.map(type => (
                <View key={type} style={modalStyles.detailChip}>
                  <Text style={modalStyles.detailChipText}>
                    {type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                  </Text>
                </View>
              ))}
            </View>

            {/* Description */}
            <Text style={modalStyles.sectionHeader}>About this adventure</Text>
            <Text style={modalStyles.description}>{adventure.description}</Text>

            <TouchableOpacity
              style={modalStyles.ctaBtn}
              onPress={() => {
                onClose();
                router.push(`/(app)/trips/${adventure.id}` as any);
              }}
              activeOpacity={0.85}
            >
              <Text style={modalStyles.ctaText}>See full itinerary</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[modalStyles.ctaBtn, modalStyles.ctaBtnSecondary, forking && { opacity: 0.6 }]}
              onPress={handleAddToMyTrips}
              activeOpacity={0.85}
              disabled={forking}
            >
              {forking
                ? <ActivityIndicator size="small" color={colors.inverse} />
                : <Text style={modalStyles.ctaTextSecondary}>Add itinerary to My Trips</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}

// ─── POI card (restaurant / activity tile) ────────────────────────────────────

const POI_HEADER_H = 130;
const POI_CARD_H   = POI_HEADER_H + 72;

function POICard({ pin }: { pin: POIPin }) {
  const cat   = ACTIVITY_CATEGORIES.find(c => c.key === pin.category);
  const icon  = (cat?.icon ?? "map-marker-outline") as React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  const color = cat?.color ?? colors.accent;

  return (
    <View style={poiCardStyles.card}>
      {/* Coloured header with large icon */}
      <View style={[poiCardStyles.header, { backgroundColor: color }]}>
        <MaterialCommunityIcons name={icon} size={40} color="rgba(255,255,255,0.9)" />
        <Text style={poiCardStyles.catLabel}>{cat?.label ?? pin.category}</Text>
      </View>
      {/* Text body */}
      <View style={poiCardStyles.body}>
        <Text style={poiCardStyles.title} numberOfLines={1}>{pin.title}</Text>
        {!!pin.subtitle && <Text style={poiCardStyles.subtitle} numberOfLines={1}>{pin.subtitle}</Text>}
        {!!pin.region && (
          <View style={poiCardStyles.regionRow}>
            <Feather name="map-pin" size={11} color={colors.muted} />
            <Text style={poiCardStyles.regionText} numberOfLines={1}>
              {pin.region}{pin.adventureTitle ? ` · ${pin.adventureTitle}` : ""}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Impressions sheet ────────────────────────────────────────────────────────

function ImpressionsSheet({
  adventures, savedIds, onToggleSaved, onCardPress, impressionsY, poiPins, mapMode,
}: {
  adventures: Adventure[];
  savedIds: Set<string>;
  onToggleSaved: (id: string) => void;
  onCardPress: (adv: Adventure) => void;
  impressionsY: Animated.Value;
  poiPins: POIPin[];
  mapMode: "adventures" | "pois";
}) {
  const insets = useSafeAreaInsets();
  const snapStateRef = useRef<"peek" | "half" | "expanded">("peek");

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dy) > 5 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderGrant: () => {
      impressionsY.stopAnimation();
      impressionsY.extractOffset();
    },
    onPanResponderMove: (_, g) => {
      impressionsY.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      impressionsY.flattenOffset();
      const currentY = (impressionsY as any)._value;
      const { vy } = g;

      let target: number;
      if (vy > 0.5) {
        target = snapStateRef.current === "expanded" ? SNAP_HALF : SNAP_PEEK;
      } else if (vy < -0.5) {
        target = snapStateRef.current === "peek" ? SNAP_HALF : SNAP_EXPANDED;
      } else {
        const opts = [
          { v: SNAP_PEEK,     d: Math.abs(currentY - SNAP_PEEK) },
          { v: SNAP_HALF,     d: Math.abs(currentY - SNAP_HALF) },
          { v: SNAP_EXPANDED, d: Math.abs(currentY - SNAP_EXPANDED) },
        ];
        target = opts.reduce((a, b) => (a.d < b.d ? a : b)).v;
      }

      snapStateRef.current =
        target === SNAP_PEEK ? "peek" : target === SNAP_HALF ? "half" : "expanded";
      Animated.spring(impressionsY, {
        toValue: target, useNativeDriver: true, tension: 65, friction: 11,
      }).start();
    },
  }), [impressionsY]);

  const isPOIMode = mapMode === "pois";
  const cat       = poiPins[0] ? ACTIVITY_CATEGORIES.find(c => c.key === poiPins[0].category) : null;
  const countLabel = isPOIMode
    ? `${poiPins.length} ${cat?.label.toLowerCase() ?? "results"}`
    : `${adventures.length} public ${adventures.length === 1 ? "adventure" : "adventures"}`;

  return (
    <Animated.View style={[impStyles.sheet, { transform: [{ translateY: impressionsY }] }]}>
      <View style={impStyles.handleArea} {...panResponder.panHandlers}>
        <View style={impStyles.handle} />
        <Text style={impStyles.countLabel}>{countLabel}</Text>
      </View>

      {isPOIMode ? (
        <FlatList
          data={poiPins}
          keyExtractor={p => p.id}
          showsVerticalScrollIndicator={false}
          snapToInterval={POI_CARD_H + 16}
          decelerationRate="fast"
          contentContainerStyle={[impStyles.listContent, { paddingBottom: insets.bottom + 24 }]}
          renderItem={({ item }) => <POICard pin={item} />}
        />
      ) : (
        <FlatList
          data={adventures}
          keyExtractor={a => a.id}
          showsVerticalScrollIndicator={false}
          snapToInterval={CARD_H + 16}
          decelerationRate="fast"
          contentContainerStyle={[impStyles.listContent, { paddingBottom: insets.bottom + 24 }]}
          renderItem={({ item }) => (
            <AdventureCard
              adventure={item}
              isSaved={savedIds.has(item.id)}
              onToggleSaved={() => onToggleSaved(item.id)}
              onPress={() => onCardPress(item)}
            />
          )}
        />
      )}
    </Animated.View>
  );
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function toExploreAdventure(row: PublicAdventureRow): Adventure {
  return {
    id:            row.id,
    title:         row.title,
    activityTypes: [row.activityType],
    region:        row.region,
    country:       row.meta?.country ?? row.region,
    days:          row.durationDays,
    avgDistanceKm: row.meta?.avgDistanceKm ?? null,
    avgElevationM: row.meta?.avgElevationM ?? null,
    description:   row.description,
    budget:        row.budget ?? "mid",
    level:         row.level ?? "intermediate",
    rating:        row.rating ?? 0,
    coords:        row.meta?.coords ?? [10, 48],
    uploadedBy:    null,
    photos:        [`https://picsum.photos/seed/${row.id}/800/500`],
  };
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<Camera>(null);
  const mapRef    = useRef<MapView>(null);
  const boundsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [adventures, setAdventures] = useState<Adventure[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedAdventure, setSelectedAdventure] = useState<Adventure | null>(null);
  const [expandedAdventure, setExpandedAdventure] = useState<Adventure | null>(null);
  const [zoom, setZoom] = useState(3.8);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [mapBounds, setMapBounds] = useState<[[number, number], [number, number]] | null>(null);

  // Mode + activity state
  const [activityCategory, setActivityCategory] = useState<ActivityCategory | null>(null);
  const [poiPins, setPoiPins]                   = useState<POIPin[]>([]);
  const [mapMode, setMapMode]                   = useState<"adventures" | "pois">("adventures");
  const [loadingPOIs, setLoadingPOIs]           = useState(false);

  // Geo state for dynamic Stays filter
  const [mapCentre, setMapCentre]                   = useState<[number, number]>([13.0, 46.5]);
  const [neighbourhoodOptions, setNeighbourhoodOptions] = useState<string[]>([]);
  const [landmarkOptions, setLandmarkOptions]           = useState<string[]>([]);
  const [loadingGeoData, setLoadingGeoData]             = useState(false);

  // Search state
  const [searchQuery, setSearchQuery]   = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const sheetY      = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const impressionsY = useRef(new Animated.Value(SNAP_PEEK)).current;

  const loadAdventures = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    getPublicAdventures()
      .then(rows => { setAdventures(rows.map(toExploreAdventure)); setLoading(false); })
      .catch(() => { setLoadError(true); setLoading(false); });
  }, []);

  useEffect(() => { loadAdventures(); }, [loadAdventures]);

  const handleFilterOpen = useCallback(async () => {
    setFilterOpen(true);
    setLoadingGeoData(true);
    const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
    const { neighbourhoods, landmarks } = await fetchMapboxGeoData(mapCentre[0], mapCentre[1], token);
    setNeighbourhoodOptions(neighbourhoods);
    setLandmarkOptions(landmarks);
    setLoadingGeoData(false);
  }, [mapCentre]);

  const regions = useMemo(() => [...new Set(adventures.map(a => a.region))].sort(), [adventures]);

  const filtered = useMemo(() => applyFilters(adventures, filters), [adventures, filters]);
  const activeFilterCount = countActiveFilters(filters);
  const publicAdventures  = useMemo(() => filtered.filter(a => a.uploadedBy === null), [filtered]);

  // Build typeahead suggestions from loaded adventures + static lists
  const suggestions = useMemo((): Suggestion[] => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: Suggestion[] = [];
    const seen = new Set<string>();

    // Countries
    const countryCoords: Record<string, [number, number][]> = {};
    adventures.forEach(a => {
      if (!countryCoords[a.country]) countryCoords[a.country] = [];
      countryCoords[a.country].push(a.coords);
    });
    Object.entries(countryCoords).forEach(([country, cl]) => {
      if (!country.toLowerCase().includes(q)) return;
      const avg: [number, number] = [
        cl.reduce((s, c) => s + c[0], 0) / cl.length,
        cl.reduce((s, c) => s + c[1], 0) / cl.length,
      ];
      const key = `country:${country}`;
      if (!seen.has(key)) { seen.add(key); results.push({ kind: "country", label: country, sublabel: "Country", coords: avg }); }
    });

    // Cities / regions
    const regionCoords: Record<string, [number, number][]> = {};
    adventures.forEach(a => {
      if (!regionCoords[a.region]) regionCoords[a.region] = [];
      regionCoords[a.region].push(a.coords);
    });
    Object.entries(regionCoords).forEach(([region, cl]) => {
      if (!region.toLowerCase().includes(q)) return;
      const avg: [number, number] = [
        cl.reduce((s, c) => s + c[0], 0) / cl.length,
        cl.reduce((s, c) => s + c[1], 0) / cl.length,
      ];
      const key = `city:${region}`;
      if (!seen.has(key)) { seen.add(key); results.push({ kind: "city", label: region, sublabel: "Region", coords: avg }); }
    });

    // Activities (setting types)
    SETTING_OPTIONS.forEach(o => {
      if (!o.label.toLowerCase().includes(q)) return;
      const key = `activity:${o.key}`;
      if (!seen.has(key)) { seen.add(key); results.push({ kind: "activity", label: o.label, sublabel: "Activity", activityKey: o.key }); }
    });

    // Vacation focus types
    FOCUS_OPTIONS.forEach(f => {
      if (!f.toLowerCase().includes(q)) return;
      const key = `activity:focus:${f}`;
      if (!seen.has(key)) { seen.add(key); results.push({ kind: "activity", label: f, sublabel: "Vacation type" }); }
    });

    // Cuisines / restaurant types
    CUISINE_SUGGESTIONS.forEach(c => {
      if (!c.toLowerCase().includes(q)) return;
      const key = `cuisine:${c}`;
      if (!seen.has(key)) { seen.add(key); results.push({ kind: "cuisine", label: c, sublabel: "Restaurant", cuisineQuery: c }); }
    });

    return results.slice(0, 10);
  }, [searchQuery, adventures]);

  const handleSuggestionSelect = useCallback(async (s: Suggestion) => {
    setSearchQuery(s.label);
    setSearchFocused(false);

    if ((s.kind === "country" || s.kind === "city") && s.coords) {
      cameraRef.current?.setCamera({
        centerCoordinate: s.coords,
        zoomLevel: s.kind === "country" ? 5 : 8,
        animationDuration: 600,
      });
      setMapMode("adventures");
    }

    if (s.kind === "activity") {
      const matchingKey = SETTING_OPTIONS.find(o => o.label === s.label)?.key;
      if (matchingKey) setFilters(f => ({ ...f, activities: [matchingKey] }));
      setMapMode("adventures");
    }

    if (s.kind === "cuisine" && s.cuisineQuery) {
      setLoadingPOIs(true);
      setMapMode("pois");
      setActivityCategory("restaurants");
      impressionsY.setValue(SNAP_PEEK);
      try {
        const rests = await getPublicRestaurants(s.cuisineQuery);
        const pins: POIPin[] = rests.map((r, i) => ({
          id: `rest-search-${i}`, title: r.name, category: "restaurants", coords: r.coords,
          subtitle: [r.cuisine, r.priceRange].filter(Boolean).join(" · "),
          region: r.region, adventureTitle: r.adventureTitle,
        }));
        setPoiPins(pins);
        if (pins.length > 0) {
          const avgLng = pins.reduce((acc, p) => acc + p.coords[0], 0) / pins.length;
          const avgLat = pins.reduce((acc, p) => acc + p.coords[1], 0) / pins.length;
          cameraRef.current?.setCamera({ centerCoordinate: [avgLng, avgLat], zoomLevel: 6, animationDuration: 600 });
        }
      } catch { setMapMode("adventures"); }
      finally { setLoadingPOIs(false); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impressionsY]);


  const visiblePublicAdventures = useMemo(() => {
    if (!mapBounds) return publicAdventures;
    const [[maxLng, maxLat], [minLng, minLat]] = mapBounds;
    return publicAdventures.filter(a => {
      const [lng, lat] = a.coords;
      return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
    });
  }, [publicAdventures, mapBounds]);

  const visiblePOIPins = useMemo(() => {
    if (!mapBounds || poiPins.length === 0) return poiPins;
    const [[maxLng, maxLat], [minLng, minLat]] = mapBounds;
    return poiPins.filter(p => {
      const [lng, lat] = p.coords;
      return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
    });
  }, [poiPins, mapBounds]);

  const toggleSaved = useCallback((id: string) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      const wasSaved = next.has(id);
      wasSaved ? next.delete(id) : next.add(id);
      (wasSaved ? unbookmarkAdventure : bookmarkAdventure)(id).catch(() => {
        // Revert on failure
        setSavedIds(s => {
          const revert = new Set(s);
          wasSaved ? revert.add(id) : revert.delete(id);
          return revert;
        });
      });
      return next;
    });
  }, []);

  const showSheet = useCallback((adventure: Adventure) => {
    setSelectedAdventure(adventure);
    Animated.spring(impressionsY, {
      toValue: SCREEN_H, useNativeDriver: true, tension: 65, friction: 11,
    }).start();
    Animated.spring(sheetY, {
      toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
    }).start();
  }, [sheetY, impressionsY]);

  const hideSheet = useCallback(() => {
    Animated.timing(sheetY, {
      toValue: SHEET_HEIGHT, duration: 200, useNativeDriver: true,
    }).start(() => {
      setSelectedAdventure(null);
      Animated.spring(impressionsY, {
        toValue: SNAP_PEEK, useNativeDriver: true, tension: 65, friction: 11,
      }).start();
    });
  }, [sheetY, impressionsY]);


  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Feather name="compass" size={40} color={colors.border} />
        <Text style={styles.loadingText}>Loading adventures…</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Feather name="wifi-off" size={40} color={colors.border} />
        <Text style={styles.loadingText}>Couldn't load adventures</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadAdventures}>
          <Text style={styles.retryText}>Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        styleURL="mapbox://styles/mapbox/navigation-day-v1"
        onPress={hideSheet}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
        onCameraChanged={(state) => {
          setZoom(state.properties.zoom);
          if (boundsTimer.current) clearTimeout(boundsTimer.current);
          boundsTimer.current = setTimeout(async () => {
            const bounds = await mapRef.current?.getVisibleBounds();
            if (bounds) {
              const b = bounds as [[number, number], [number, number]];
              setMapBounds(b);
              const [[maxLng, maxLat], [minLng, minLat]] = b;
              setMapCentre([(maxLng + minLng) / 2, (maxLat + minLat) / 2]);
            }
          }, 150);
        }}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: [13.0, 46.5], zoomLevel: 3.8 }}
        />

        {/* Ocean/water color override */}
        <FillLayer id="water" existing style={{ fillColor: "#E8F1FF" }} />

        {/* Country labels: large at continental zoom, recede as cities take over */}
        <SymbolLayer
          id="country-label"
          existing
          style={{
            textSize: ["interpolate", ["linear"], ["zoom"], 2, 17, 4, 15, 6, 12, 8, 9, 10, 7],
            textOpacity: ["interpolate", ["linear"], ["zoom"], 2, 0.9, 10, 0.5],
            textLetterSpacing: 0.12,
          }}
        />

        {/* City labels: small at low zoom, grow prominent as user zooms in */}
        <SymbolLayer
          id="settlement-label"
          existing
          style={{
            textSize: ["interpolate", ["linear"], ["zoom"], 4, 7, 7, 10, 10, 12, 13, 14],
            textOpacity: ["interpolate", ["linear"], ["zoom"], 4, 0.4, 7, 0.8, 10, 1.0],
          }}
        />

        {/* Adventure pins */}
        {mapMode === "adventures" && filtered.map(adv => (
          <PointAnnotation
            key={adv.id}
            id={adv.id}
            coordinate={adv.coords}
            anchor={{ x: 0.5, y: 0.5 }}
            onSelected={() => {
              cameraRef.current?.setCamera({
                centerCoordinate: adv.coords,
                zoomLevel: Math.max(zoom, 8),
                animationDuration: 400,
              });
              showSheet(adv);
            }}
          >
            <AdventurePin />
          </PointAnnotation>
        ))}

        {/* Activity / restaurant / bar / café POI pins */}
        {mapMode === "pois" && poiPins.map(pin => (
          <PointAnnotation
            key={pin.id}
            id={pin.id}
            coordinate={pin.coords}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <MapPin category={pin.category} />
          </PointAnnotation>
        ))}
      </MapView>

      {/* Filter button — always visible alongside search bar */}
      <View style={[styles.filterBtnWrap, { top: insets.top + spacing.sm }]}>
        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={handleFilterOpen}
          activeOpacity={0.85}
        >
          <Feather name="sliders" size={16} color={activeFilterCount > 0 ? colors.inverse : colors.text} />
          {activeFilterCount > 0 && (
            <Text style={styles.filterCount}>{activeFilterCount}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={[styles.searchWrap, { top: insets.top + spacing.sm }]}>
        <View style={styles.searchBar}>
          <Feather name="search" size={15} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={t => {
              setSearchQuery(t);
              setSearchFocused(true);
              if (!t && mapMode === "pois" && activityCategory === null) {
                setMapMode("adventures");
                setPoiPins([]);
              }
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => { setSearchQuery(""); setSearchFocused(false); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="x" size={14} color={colors.muted} />
            </TouchableOpacity>
          )}
          {loadingPOIs && (
            <View style={{ marginLeft: 4 }}>
              <Feather name="loader" size={14} color={colors.accent} />
            </View>
          )}
        </View>

        {/* Dropdown */}
        {searchFocused && suggestions.length > 0 && (
          <View style={styles.dropdown}>
            {suggestions.map((s, i) => {
              const icon: React.ComponentProps<typeof Feather>["name"] =
                s.kind === "country"  ? "globe"    :
                s.kind === "city"     ? "map-pin"  :
                s.kind === "activity" ? "activity" : "coffee";
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.dropdownRow, i < suggestions.length - 1 && styles.dropdownDivider]}
                  onPress={() => handleSuggestionSelect(s)}
                  activeOpacity={0.7}
                >
                  <View style={styles.dropdownIcon}>
                    <Feather name={icon} size={13} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dropdownLabel}>{s.label}</Text>
                    {s.sublabel && <Text style={styles.dropdownSub}>{s.sublabel}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>


      <FilterSheet
        visible={filterOpen}
        filters={filters}
        onChange={setFilters}
        neighbourhoodOptions={neighbourhoodOptions}
        landmarkOptions={landmarkOptions}
        loadingGeoData={loadingGeoData}
        onClose={() => {
          setFilterOpen(false);
          const fc = filters.filterCategory;
          if (fc === "restaurants") {
            setActivityCategory("restaurants");
            const q = filters.mealTypes.includes("cafe") ? "cafe"
              : filters.mealTypes.includes("bar") ? "bar" : "";
            setLoadingPOIs(true);
            getPublicRestaurants(q).then(rests => {
              setPoiPins(rests.map((r, i) => ({
                id: `rest-f-${i}`, title: r.name, category: "restaurants", coords: r.coords,
                subtitle: [r.cuisine, r.priceRange].filter(Boolean).join(" · "),
                region: r.region, adventureTitle: r.adventureTitle,
              })));
              setMapMode("pois");
            }).catch(() => {}).finally(() => setLoadingPOIs(false));
          } else if (fc === "activities") {
            const primaryType = (filters.activityTypes[0] ?? null) as ActivityCategory | null;
            if (primaryType) {
              setActivityCategory(primaryType);
              setLoadingPOIs(true);
              getPublicActivities(primaryType).then(acts => {
                setPoiPins(acts.map((a, i) => ({
                  id: `act-f-${i}`, title: a.title, category: primaryType, coords: a.coords,
                  subtitle: [a.difficulty, a.distanceKm ? `${a.distanceKm} km` : null].filter(Boolean).join(" · "),
                  region: a.region, adventureTitle: a.adventureTitle,
                })));
                setMapMode("pois");
              }).catch(() => {}).finally(() => setLoadingPOIs(false));
            } else {
              setMapMode("adventures");
            }
          } else {
            setActivityCategory(null);
            setPoiPins([]);
            setMapMode("adventures");
            impressionsY.setValue(SNAP_PEEK);
          }
        }}
        onReset={() => setFilters(DEFAULT_FILTERS)}
      />

      <AdventureSheet
        adventure={selectedAdventure}
        translateY={sheetY}
        onClose={hideSheet}
        onPlan={() => { hideSheet(); router.push(`/(app)/trips/${selectedAdventure?.id}` as any); }}
      />

      <ImpressionsSheet
        adventures={visiblePublicAdventures}
        savedIds={savedIds}
        onToggleSaved={toggleSaved}
        onCardPress={setExpandedAdventure}
        impressionsY={impressionsY}
        poiPins={visiblePOIPins}
        mapMode={mapMode}
      />

      <AdventureExpandedModal
        adventure={expandedAdventure}
        visible={expandedAdventure !== null}
        isSaved={expandedAdventure ? savedIds.has(expandedAdventure.id) : false}
        onToggleSaved={() => expandedAdventure && toggleSaved(expandedAdventure.id)}
        onClose={() => setExpandedAdventure(null)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center", backgroundColor: colors.bg, gap: spacing.sm },
  loadingText: { fontFamily: fonts.sans, fontSize: fontSize.base, color: colors.muted, marginTop: spacing.xs },
  retryBtn: { marginTop: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.full, backgroundColor: colors.accent },
  retryText: { fontFamily: fonts.sansBold, fontSize: fontSize.sm, color: colors.inverse },

  // Mode toggle
  modeToggleWrap: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    alignItems: "center",
    zIndex: 45,
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.full,
    padding: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  modeTab: {
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    alignItems: "center",
  },
  modeTabActive: { backgroundColor: colors.text },
  modeTabText: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.muted },
  modeTabTextActive: { color: colors.inverse },

  // Activity category chips
  categoryRowScroll: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 44,
  },
  categoryRowContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryChipText: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.text },
  categoryChipTextActive: { color: "#FFFFFF" },

  filterBtnWrap: { position: "absolute", right: spacing.md },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.full,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  filterBtnActive: { backgroundColor: colors.accent },
  filterCount: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize.sm,
    color: colors.inverse,
  },

  searchWrap: {
    position: "absolute",
    left: spacing.md,
    right: 76,
    zIndex: 50,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.full,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.text,
    padding: 0,
  },
  dropdown: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginTop: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: 10,
  },
  dropdownDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dropdownIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.accent + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  dropdownSub: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 1,
  },

  sheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 16,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: spacing.sm,
  },
  sheetContent: { padding: spacing.md, gap: spacing.sm },
  sheetTopRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
  },
  activityChip: {
    paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full,
  },
  activityChipText: { fontFamily: fonts.sansBold, fontSize: fontSize.xs, letterSpacing: 0.5 },
  regionText: { fontFamily: fonts.sans, flex: 1, fontSize: fontSize.sm, color: colors.muted },
  ratingText: { fontFamily: fonts.sansBold, fontSize: fontSize.sm, color: "#F59E0B" },
  sheetTitle: {
    fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.text, letterSpacing: -0.4,
  },
  statsRow: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" },
  statChip: {
    backgroundColor: colors.sheet, borderRadius: radius.full,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  statText: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.xs, color: colors.muted },
  sheetDesc: { fontFamily: fonts.sans, fontSize: fontSize.sm, color: colors.muted, lineHeight: 20 },
  ctaBtn: {
    backgroundColor: colors.inputBg, borderRadius: radius.full,
    paddingVertical: 14, alignItems: "center", marginTop: spacing.xs,
  },
  ctaText: { fontFamily: fonts.sansBold, color: colors.muted, fontSize: fontSize.base },
  ctaBtnSecondary: {
    backgroundColor: colors.accent, borderWidth: 0,
    marginTop: spacing.sm,
  },
  ctaTextSecondary: { fontFamily: fonts.sansBold, color: colors.inverse, fontSize: fontSize.base },
});

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 5,
    maxWidth: 160,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  colorBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: "#000000",
    flexShrink: 1,
  },
  adventurePin: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: colors.accent,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     2.5,
    borderColor:     "#FFFFFF",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.28,
    shadowRadius:    6,
    elevation:       6,
  },
  activityPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 6,
  },
});

const filterStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
    zIndex: 100,
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontFamily: fonts.display, fontSize: fontSize.lg, color: colors.text, letterSpacing: -0.3 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  resetText: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.accent },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.sheet,
    alignItems: "center", justifyContent: "center",
  },
  body: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize.sm,
    color: colors.text, textTransform: "uppercase", letterSpacing: 0.5,
  },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 3,
    borderRadius: radius.full,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { fontFamily: fonts.sansMedium, fontSize: fontSize.sm, color: colors.text },
  chipTextActive: { color: colors.inverse },

  // Category tabs
  catScrollWrapper: {
    height: 56,
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  catScroll: {},
  catScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  catTab: {
    flexShrink: 0,
    paddingHorizontal: spacing.md + 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  catTabActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  catTabText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  catTabTextActive: {
    color: colors.inverse,
  },

  // Counter (bedrooms / bathrooms)
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  counterLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  counter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  counterBtn: {
    width: 30, height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  counterValue: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize.base,
    color: colors.text,
    minWidth: 28,
    textAlign: "center",
  },

  // Star rating
  starRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  starChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  starChipActive: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  starText: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
    letterSpacing: 2,
  },
  starTextActive: { color: "#F59E0B" },

  // Show more
  showMoreBtn: {
    marginTop: spacing.xs,
  },
  showMoreText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSize.sm,
    color: colors.accent,
  },

  // Geo loading
  geoLoading: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
    fontStyle: "italic",
  },

  // Toggle (boolean filters)
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  toggleLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  toggleSub: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 2,
  },
  toggle: {
    width: 44, height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleOn: { backgroundColor: colors.accent },
  toggleThumb: {
    width: 20, height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  toggleThumbOn: { alignSelf: "flex-end" },

  // Location input
  locationInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inputBg,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  locationInput: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: fontSize.base,
    color: colors.text,
    paddingVertical: 0,
  },
  locationSuggestions: {
    marginTop: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  locationSuggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  locationSuggestionText: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.text,
  },
});

const dualRangeStyles = StyleSheet.create({
  wrapper: { paddingTop: 8, paddingBottom: 4 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  inputBox: { flex: 1, gap: 4 },
  inputLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: fontSize.xs,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  inputInner: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    gap: 4,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSize.sm,
    color: colors.text,
    minWidth: 30,
  },
  inputUnit: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  inputSep: {
    width: spacing.sm,
    height: 1.5,
    backgroundColor: colors.border,
    alignSelf: "flex-end",
    marginBottom: 14,
  },
});

const rangeStyles = StyleSheet.create({
  wrapper: { paddingVertical: 8 },
  priceLabel: { fontFamily: fonts.sansSemiBold, fontSize: fontSize.sm, color: colors.text, marginBottom: 4 },
  trackContainer: { height: 30, marginHorizontal: 4 },
  track: {
    position: "absolute",
    top: 13, left: 0, right: 0,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  selectedRange: {
    position: "absolute",
    top: 13,
    height: 4,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  handle: {
    position: "absolute",
    top: 4,
    width: 22, height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: colors.accent,
  },
});

const cardStyles = StyleSheet.create({
  card: {
    width: CARD_W,
    borderRadius: 20,
    backgroundColor: colors.card,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 4,
    overflow: "hidden",
  },
  imageWrap: {
    margin: 8,
    height: IMAGE_H,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.border,
  },
  heartBtn: {
    position: "absolute",
    top: 10, right: 10,
    width: 34, height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.30)",
    alignItems: "center",
    justifyContent: "center",
  },
  dots: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    flexDirection: "row",
    gap: 4,
    left: 0, right: 0,
    justifyContent: "center",
  },
  dot: {
    width: 5, height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  dotActive: { backgroundColor: "#FFFFFF" },
  textArea: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 6,
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardSubtitle: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
});

const impStyles = StyleSheet.create({
  sheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: SCREEN_H,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  handleArea: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  countLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
});

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  // Photo card — same inset tile style
  photoCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 4,
  },
  imageWrap: {
    margin: 8,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.border,
  },
  photoDots: {
    position: "absolute",
    bottom: 10,
    left: 0, right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  photoDot: {
    width: 5, height: 5, borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  photoDotActive: { backgroundColor: "#FFFFFF" },
  cardText: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 14,
    gap: 4,
  },
  modalTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: colors.text,
    letterSpacing: -0.3,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontFamily: fonts.sans,
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  ratingBadge: {
    fontFamily: fonts.sansBold,
    color: "#F59E0B",
    fontSize: fontSize.sm,
  },

  // Below card
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  detailChip: {
    backgroundColor: colors.card,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  detailChipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSize.sm,
    color: colors.text,
    textTransform: "capitalize",
  },
  sectionHeader: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize.base,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  description: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
    lineHeight: 22,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  ctaBtn: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.full,
    paddingVertical: 16,
    marginHorizontal: spacing.md,
    alignItems: "center",
    marginTop: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.muted,
  },
  ctaText: {
    fontFamily: fonts.sansBold,
    color: colors.muted,
    fontSize: fontSize.base,
  },
  ctaBtnSecondary: {
    backgroundColor: colors.accent,
    marginTop: spacing.sm,
    borderColor: "#FFFFFF",
  },
  ctaTextSecondary: {
    fontFamily: fonts.sansBold,
    color: colors.inverse,
    fontSize: fontSize.base,
  },
});

const poiCardStyles = StyleSheet.create({
  card: {
    width: CARD_W,
    borderRadius: 20,
    backgroundColor: colors.card,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 4,
    overflow: "hidden",
  },
  header: {
    height: POI_HEADER_H,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  catLabel: {
    fontFamily: fonts.sansBold,
    fontSize: fontSize.sm,
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 4,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
    textTransform: "capitalize",
  },
  regionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  regionText: {
    fontFamily: fonts.sans,
    fontSize: fontSize.xs,
    color: colors.muted,
    flex: 1,
  },
});
