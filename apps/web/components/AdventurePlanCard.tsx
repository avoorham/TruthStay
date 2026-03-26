"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Mountain, Bed, Check } from "lucide-react";
import { KomootEmbed } from "./KomootEmbed";
import type {
  GeneratedAdventure,
  DayAlternativesMap,
  RouteAlternative,
  AccommodationAlternative,
} from "../lib/agent/adventure-agent";

interface Props {
  adventure: GeneratedAdventure;
  dayAlternatives: DayAlternativesMap;
  adventureId: string | null;
}

// Per-day selection state
interface DaySelection {
  routeIndex: number;        // 0 = main, 1/2 = alternatives
  accommodationIndex: number;
}

function formatDistance(km: number | null) {
  if (!km) return null;
  return `${km}km`;
}

function formatElevation(m: number | null) {
  if (!m) return null;
  return `${m}m ↑`;
}

function difficultyLabel(d: RouteAlternative["difficulty"]) {
  return { easy: "Easier", moderate: "Main", hard: "Harder" }[d];
}

function difficultyColour(d: RouteAlternative["difficulty"]) {
  return { easy: "text-green-600", moderate: "text-[#212121]", hard: "text-red-600" }[d];
}

async function recordSelection(
  adventureId: string,
  dayNumber: number,
  category: "route" | "accommodation",
  selectedIndex: number,
  optionType?: string
) {
  try {
    await fetch(`/api/adventures/${adventureId}/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day_number: dayNumber, category, selected_index: selectedIndex, option_type: optionType }),
    });
  } catch {
    // non-fatal
  }
}

export function AdventurePlanCard({ adventure, dayAlternatives, adventureId }: Props) {
  const router = useRouter();
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]));
  const [selections, setSelections] = useState<Record<number, DaySelection>>({});
  const [komootTourIds, setKomootTourIds] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const toggleDay = (dayNumber: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      next.has(dayNumber) ? next.delete(dayNumber) : next.add(dayNumber);
      return next;
    });
  };

  const getSelection = (dayNumber: number): DaySelection =>
    selections[dayNumber] ?? { routeIndex: 0, accommodationIndex: 0 };

  const selectRoute = (dayNumber: number, index: number, optionType?: string) => {
    setSelections((prev) => ({
      ...prev,
      [dayNumber]: { ...getSelection(dayNumber), routeIndex: index },
    }));
    if (adventureId) recordSelection(adventureId, dayNumber, "route", index, optionType);
  };

  const selectAccommodation = (dayNumber: number, index: number, optionType?: string) => {
    setSelections((prev) => ({
      ...prev,
      [dayNumber]: { ...getSelection(dayNumber), accommodationIndex: index },
    }));
    if (adventureId) recordSelection(adventureId, dayNumber, "accommodation", index, optionType);
  };

  const handleSave = async () => {
    if (!adventureId) {
      router.push("/mytrips");
      return;
    }
    setSaving(true);
    try {
      await fetch(`/api/adventures/${adventureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSaved: true }),
      });
      router.push("/mytrips");
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="border border-[#dadccb] bg-white w-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-[#dadccb]">
        <h2 className="font-bold text-base text-[#212121] leading-snug">{adventure.title}</h2>
        <p className="text-xs text-[#717182] mt-1 leading-relaxed">{adventure.description}</p>
        <div className="flex gap-3 mt-2 text-xs text-[#717182]">
          <span>{adventure.duration_days} days</span>
          <span>·</span>
          <span className="capitalize">{adventure.activity_type.replace("_", " ")}</span>
          <span>·</span>
          <span>{adventure.region}</span>
        </div>
      </div>

      {/* Days */}
      <div className="divide-y divide-[#dadccb]">
        {adventure.days.map((day) => {
          const isExpanded = expandedDays.has(day.day_number);
          const sel = getSelection(day.day_number);
          const alts = dayAlternatives[String(day.day_number)];
          const komootTourId = komootTourIds[day.day_number] ?? null;

          return (
            <div key={day.day_number}>
              {/* Day header — always visible */}
              <button
                onClick={() => toggleDay(day.day_number)}
                className="w-full flex items-start justify-between px-4 py-3 text-left hover:bg-[#f8f8f5] transition-colors"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-xs font-semibold text-[#717182] mb-0.5">Day {day.day_number}</p>
                  <p className="text-sm font-semibold text-[#212121] leading-snug">{day.title}</p>
                  <div className="flex gap-2 mt-1">
                    {day.distance_km && (
                      <span className="text-xs bg-[#e9ebef] text-[#212121] px-2 py-0.5">
                        {formatDistance(day.distance_km)}
                      </span>
                    )}
                    {day.elevation_gain_m && (
                      <span className="text-xs bg-[#e9ebef] text-[#212121] px-2 py-0.5">
                        {formatElevation(day.elevation_gain_m)}
                      </span>
                    )}
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronDown size={16} className="text-[#717182] mt-1 flex-shrink-0" />
                ) : (
                  <ChevronRight size={16} className="text-[#717182] mt-1 flex-shrink-0" />
                )}
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4">
                  {/* Description + route notes */}
                  <p className="text-sm text-[#212121] leading-relaxed">{day.description}</p>
                  {day.route_notes && (
                    <p className="text-xs text-[#717182] leading-relaxed border-l-2 border-[#dadccb] pl-3">
                      {day.route_notes}
                    </p>
                  )}

                  {/* Route alternatives */}
                  {alts?.routes && alts.routes.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Mountain size={12} className="text-[#717182]" />
                        <p className="text-xs font-semibold text-[#717182] uppercase tracking-wide">Route options</p>
                      </div>
                      <div className="space-y-2">
                        {/* Main route as option 0 */}
                        <RouteOption
                          label="Main"
                          title={day.title}
                          distanceKm={day.distance_km}
                          elevationM={day.elevation_gain_m}
                          difficulty="moderate"
                          description={day.description}
                          isSelected={sel.routeIndex === 0}
                          onSelect={() => selectRoute(day.day_number, 0)}
                        />
                        {alts.routes.map((alt, idx) => (
                          <RouteOption
                            key={idx}
                            label={difficultyLabel(alt.difficulty)}
                            title={alt.title}
                            distanceKm={alt.distance_km}
                            elevationM={alt.elevation_gain_m}
                            difficulty={alt.difficulty}
                            description={alt.description}
                            isSelected={sel.routeIndex === idx + 1}
                            onSelect={() => selectRoute(day.day_number, idx + 1, alt.difficulty)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Accommodation alternatives */}
                  {alts?.accommodation && alts.accommodation.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Bed size={12} className="text-[#717182]" />
                        <p className="text-xs font-semibold text-[#717182] uppercase tracking-wide">Where to stay</p>
                      </div>
                      <div className="space-y-2">
                        {alts.accommodation.map((acc, idx) => (
                          <AccommodationOption
                            key={idx}
                            acc={acc}
                            isSelected={sel.accommodationIndex === idx}
                            onSelect={() => selectAccommodation(day.day_number, idx, acc.type)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Komoot route embed */}
                  <KomootEmbed
                    tourId={komootTourId}
                    adventureId={adventureId}
                    dayNumber={day.day_number}
                    editable={true}
                    onLinked={(id) =>
                      setKomootTourIds((prev) => ({ ...prev, [day.day_number]: id }))
                    }
                    onUnlinked={() =>
                      setKomootTourIds((prev) => {
                        const next = { ...prev };
                        delete next[day.day_number];
                        return next;
                      })
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save button */}
      <div className="px-4 py-4 border-t border-[#dadccb]">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-black text-white py-3 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save this adventure"}
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface RouteOptionProps {
  label: string;
  title: string;
  distanceKm: number | null;
  elevationM: number | null;
  difficulty: RouteAlternative["difficulty"];
  description: string;
  isSelected: boolean;
  onSelect: () => void;
}

function RouteOption({ label, title, distanceKm, elevationM, difficulty, description, isSelected, onSelect }: RouteOptionProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left border px-3 py-2.5 transition-colors ${
        isSelected ? "border-[#212121] bg-[#f8f8f5]" : "border-[#dadccb] hover:border-[#212121]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-xs font-semibold ${difficultyColour(difficulty)}`}>{label}</span>
            {distanceKm && <span className="text-xs text-[#717182]">{distanceKm}km</span>}
            {elevationM && <span className="text-xs text-[#717182]">{elevationM}m ↑</span>}
          </div>
          <p className="text-xs font-medium text-[#212121] truncate">{title}</p>
          <p className="text-xs text-[#717182] mt-0.5 leading-relaxed line-clamp-2">{description}</p>
        </div>
        {isSelected && <Check size={14} className="text-[#212121] flex-shrink-0 mt-0.5" />}
      </div>
    </button>
  );
}

interface AccommodationOptionProps {
  acc: AccommodationAlternative;
  isSelected: boolean;
  onSelect: () => void;
}

function AccommodationOption({ acc, isSelected, onSelect }: AccommodationOptionProps) {
  const priceLabel = { budget: "Budget", mid: "Mid-range", luxury: "Luxury" }[acc.price_range];
  const typeLabel = acc.type.charAt(0).toUpperCase() + acc.type.slice(1);

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left border px-3 py-2.5 transition-colors ${
        isSelected ? "border-[#212121] bg-[#f8f8f5]" : "border-[#dadccb] hover:border-[#212121]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-[#212121]">{acc.name}</span>
            <span className="text-xs text-[#717182]">{typeLabel} · {priceLabel}</span>
          </div>
          <p className="text-xs text-[#717182] leading-relaxed line-clamp-2">{acc.description}</p>
        </div>
        {isSelected && <Check size={14} className="text-[#212121] flex-shrink-0 mt-0.5" />}
      </div>
    </button>
  );
}
