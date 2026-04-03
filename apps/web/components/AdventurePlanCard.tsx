"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown, ChevronRight, Mountain,
  Check, MapPin, ExternalLink, AlertCircle,
} from "lucide-react";
import { KomootEmbed } from "./KomootEmbed";
import type {
  GeneratedAdventure,
  DayAlternativesMap,
  RouteAlternative,
  AccommodationStop,
  AccommodationOption,
} from "../lib/agent/adventure-agent";

interface Props {
  adventure: GeneratedAdventure;
  dayAlternatives: DayAlternativesMap;
  accommodationStops: AccommodationStop[];
  adventureId: string | null;
}

interface DayRouteSelection {
  index: number;       // 0 = main, 1/2 = alternatives
  end_location: string;
}

function bookingUrl({
  propertyName,
  location,
  checkin,
  checkout,
  adults = 1,
  trackingLabel,
}: {
  propertyName: string;
  location: string;
  checkin?: string;   // YYYY-MM-DD
  checkout?: string;  // YYYY-MM-DD
  adults?: number;
  trackingLabel?: string; // e.g. "adventure-abc123-night-1"
}) {
  const aid = process.env.NEXT_PUBLIC_BOOKING_AFFILIATE_ID;
  const params = new URLSearchParams({
    ss: `${propertyName} ${location}`,
    group_adults: String(adults),
    no_rooms: "1",
  });
  if (aid) params.set("aid", aid);
  if (trackingLabel) params.set("label", trackingLabel);
  if (checkin) params.set("checkin", checkin);
  if (checkout) params.set("checkout", checkout);
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}

// Compute ISO date string offset from a base date by N days
function offsetDate(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
  } catch { /* non-fatal */ }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdventurePlanCard({ adventure, dayAlternatives, accommodationStops, adventureId }: Props) {
  const router = useRouter();

  // Phase: "routes" → user picks routes for all days → "accommodation" → user picks stays → "save"
  const [phase, setPhase] = useState<"routes" | "accommodation">("routes");

  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]));
  const [routeSelections, setRouteSelections] = useState<Record<number, DayRouteSelection>>({});
  const [accSelections, setAccSelections] = useState<Record<string, number>>({}); // location → option index
  const [komootTourIds, setKomootTourIds] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const toggleDay = (n: number) =>
    setExpandedDays((prev) => { const s = new Set(prev); if (s.has(n)) { s.delete(n); } else { s.add(n); } return s; });

  const getRouteSelection = (dayNumber: number): DayRouteSelection =>
    routeSelections[dayNumber] ?? { index: 0, end_location: adventure.days.find(d => d.day_number === dayNumber)?.end_location ?? "" };

  const selectRoute = (dayNumber: number, index: number, end_location: string) => {
    setRouteSelections(prev => ({ ...prev, [dayNumber]: { index, end_location } }));
    if (adventureId) recordSelection(adventureId, dayNumber, "route", index);
  };

  // Detect if any alternative route ends in a different location than the main plan's accommodation stop
  const getLocationMismatch = (dayNumber: number): string | null => {
    const sel = getRouteSelection(dayNumber);
    if (sel.index === 0) return null; // main route — no mismatch
    const mainDay = adventure.days.find(d => d.day_number === dayNumber);
    if (!mainDay) return null;
    const stop = accommodationStops.find(s => s.night_numbers.includes(dayNumber));
    if (!stop) return null;
    if (sel.end_location && sel.end_location.toLowerCase() !== stop.location.toLowerCase()) {
      return `This route ends in ${sel.end_location} instead of ${stop.location} — accommodation below is for ${stop.location}`;
    }
    return null;
  };

  const allDaysReviewed = adventure.days.every(d => expandedDays.has(d.day_number) || routeSelections[d.day_number] !== undefined);

  const handleConfirmRoutes = () => {
    setPhase("accommodation");
    setExpandedDays(new Set());
  };

  const handleSave = async () => {
    if (!adventureId) { router.push("/mytrips"); return; }
    setSaving(true);
    try {
      await fetch(`/api/adventures/${adventureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSaved: true }),
      });
      router.push("/mytrips");
    } catch { setSaving(false); }
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

        {/* Phase indicator */}
        <div className="flex gap-2 mt-3">
          <span className={`text-xs px-2 py-0.5 font-semibold ${phase === "routes" ? "bg-black text-white" : "bg-[#e9ebef] text-[#717182]"}`}>
            1 Routes
          </span>
          <span className={`text-xs px-2 py-0.5 font-semibold ${phase === "accommodation" ? "bg-black text-white" : "bg-[#e9ebef] text-[#717182]"}`}>
            2 Accommodation
          </span>
        </div>
      </div>

      {/* ── Phase 1: Routes ───────────────────────────────────────────────────── */}
      {phase === "routes" && (
        <>
          <div className="divide-y divide-[#dadccb]">
            {adventure.days.map((day) => {
              const isExpanded = expandedDays.has(day.day_number);
              const alts = dayAlternatives[String(day.day_number)];
              const sel = getRouteSelection(day.day_number);
              const mismatch = getLocationMismatch(day.day_number);

              return (
                <div key={day.day_number}>
                  <button
                    onClick={() => toggleDay(day.day_number)}
                    className="w-full flex items-start justify-between px-4 py-3 text-left hover:bg-[#f8f8f5] transition-colors"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-xs font-semibold text-[#717182] mb-0.5">Day {day.day_number}</p>
                      <p className="text-sm font-semibold text-[#212121] leading-snug">{day.title}</p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {day.distance_km && <span className="text-xs bg-[#e9ebef] text-[#212121] px-2 py-0.5">{day.distance_km}km</span>}
                        {day.elevation_gain_m && <span className="text-xs bg-[#e9ebef] text-[#212121] px-2 py-0.5">{day.elevation_gain_m}m ↑</span>}
                        {sel.index > 0 && (
                          <span className="text-xs bg-black text-white px-2 py-0.5">
                            {sel.index === 1 ? "Easier" : "Harder"} selected
                          </span>
                        )}
                      </div>
                    </div>
                    {isExpanded
                      ? <ChevronDown size={16} className="text-[#717182] mt-1 flex-shrink-0" />
                      : <ChevronRight size={16} className="text-[#717182] mt-1 flex-shrink-0" />
                    }
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4">
                      <p className="text-sm text-[#212121] leading-relaxed">{day.description}</p>
                      {day.route_notes && (
                        <p className="text-xs text-[#717182] leading-relaxed border-l-2 border-[#dadccb] pl-3">
                          {day.route_notes}
                        </p>
                      )}

                      {/* Route options */}
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Mountain size={12} className="text-[#717182]" />
                          <p className="text-xs font-semibold text-[#717182] uppercase tracking-wide">Route options</p>
                        </div>
                        <div className="space-y-2">
                          {/* Main route */}
                          <RouteOption
                            label="Main"
                            title={day.title}
                            distanceKm={day.distance_km}
                            elevationM={day.elevation_gain_m}
                            difficulty="moderate"
                            description={day.description}
                            endLocation={day.end_location}
                            isSelected={sel.index === 0}
                            onSelect={() => selectRoute(day.day_number, 0, day.end_location)}
                          />
                          {alts?.routes?.map((alt, idx) => (
                            <RouteOption
                              key={idx}
                              label={idx === 0 ? "Easier" : "Harder"}
                              title={alt.title}
                              distanceKm={alt.distance_km}
                              elevationM={alt.elevation_gain_m}
                              difficulty={alt.difficulty}
                              description={alt.description}
                              endLocation={alt.end_location}
                              isSelected={sel.index === idx + 1}
                              onSelect={() => selectRoute(day.day_number, idx + 1, alt.end_location)}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Location mismatch warning */}
                      {mismatch && (
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 px-3 py-2">
                          <AlertCircle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700">{mismatch}</p>
                        </div>
                      )}

                      {/* Komoot embed */}
                      <KomootEmbed
                        tourId={komootTourIds[day.day_number] ?? null}
                        adventureId={adventureId}
                        dayNumber={day.day_number}
                        editable={true}
                        onLinked={(id) => setKomootTourIds(prev => ({ ...prev, [day.day_number]: id }))}
                        onUnlinked={() => setKomootTourIds(prev => { const n = { ...prev }; delete n[day.day_number]; return n; })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Confirm routes CTA */}
          <div className="px-4 py-4 border-t border-[#dadccb] space-y-2">
            {!allDaysReviewed && (
              <p className="text-xs text-[#717182] text-center">
                Open each day to review and select your route
              </p>
            )}
            <button
              onClick={handleConfirmRoutes}
              className="w-full bg-black text-white py-3 text-sm font-semibold"
            >
              Confirm routes → Choose accommodation
            </button>
          </div>
        </>
      )}

      {/* ── Phase 2: Accommodation ────────────────────────────────────────────── */}
      {phase === "accommodation" && (
        <>
          <div className="px-4 py-3 border-b border-[#dadccb] flex items-center justify-between">
            <p className="text-sm font-semibold text-[#212121]">Where to stay</p>
            <button
              onClick={() => setPhase("routes")}
              className="text-xs text-[#717182] hover:text-[#212121] underline"
            >
              ← Edit routes
            </button>
          </div>

          {accommodationStops.length === 0 ? (
            <p className="px-4 py-6 text-sm text-[#717182]">No accommodation stops generated.</p>
          ) : (
            <div className="divide-y divide-[#dadccb]">
              {accommodationStops.map((stop, stopIdx) => {
                const selectedOptIdx = accSelections[stop.location] ?? 0;

                return (
                  <div key={stopIdx} className="px-4 py-4 space-y-3">
                    {/* Stop header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-[#212121]" />
                          <p className="text-sm font-bold text-[#212121]">{stop.location}</p>
                        </div>
                        <p className="text-xs text-[#717182] mt-0.5 ml-5">
                          {stop.night_numbers.length === 1
                            ? `Night ${stop.night_numbers[0]}`
                            : `Nights ${stop.night_numbers[0]}–${stop.night_numbers[stop.night_numbers.length - 1]}`}
                          {stop.notes ? ` · ${stop.notes}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Accommodation options */}
                    <div className="space-y-2">
                      {stop.options.map((opt, optIdx) => (
                        <AccommodationCard
                          key={optIdx}
                          opt={opt}
                          nightCount={stop.night_numbers.length}
                          nightNumbers={stop.night_numbers}
                          startDate={adventure.start_date ?? null}
                          adventureId={adventureId}
                          isSelected={selectedOptIdx === optIdx}
                          location={stop.location}
                          onSelect={() => {
                            setAccSelections(prev => ({ ...prev, [stop.location]: optIdx }));
                            if (adventureId) {
                              recordSelection(adventureId, stop.night_numbers[0] ?? 1, "accommodation", optIdx, opt.type);
                            }
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Save CTA */}
          <div className="px-4 py-4 border-t border-[#dadccb]">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-black text-white py-3 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save this adventure"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Route option card ────────────────────────────────────────────────────────

interface RouteOptionProps {
  label: string;
  title: string;
  distanceKm: number | null;
  elevationM: number | null;
  difficulty: RouteAlternative["difficulty"] | "moderate";
  description: string;
  endLocation: string;
  isSelected: boolean;
  onSelect: () => void;
}

const DIFFICULTY_COLOUR: Record<string, string> = {
  easy: "text-green-600",
  moderate: "text-[#212121]",
  hard: "text-red-600",
};

function RouteOption({ label, title, distanceKm, elevationM, difficulty, description, endLocation, isSelected, onSelect }: RouteOptionProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left border px-3 py-2.5 transition-colors ${isSelected ? "border-[#212121] bg-[#f8f8f5]" : "border-[#dadccb] hover:border-[#212121]"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-0.5">
            <span className={`text-xs font-semibold ${DIFFICULTY_COLOUR[difficulty] ?? "text-[#212121]"}`}>{label}</span>
            {distanceKm && <span className="text-xs text-[#717182]">{distanceKm}km</span>}
            {elevationM && <span className="text-xs text-[#717182]">{elevationM}m ↑</span>}
          </div>
          <p className="text-xs font-medium text-[#212121] truncate">{title}</p>
          <p className="text-xs text-[#717182] mt-0.5 line-clamp-2">{description}</p>
          {endLocation && (
            <p className="text-xs text-[#717182] mt-0.5">
              <span className="font-medium">Ends:</span> {endLocation}
            </p>
          )}
        </div>
        {isSelected && <Check size={14} className="text-[#212121] flex-shrink-0 mt-0.5" />}
      </div>
    </button>
  );
}

// ─── Accommodation card ───────────────────────────────────────────────────────

interface AccommodationCardProps {
  opt: AccommodationOption;
  nightCount: number;
  nightNumbers: number[];
  location: string;
  startDate: string | null;
  adventureId: string | null;
  isSelected: boolean;
  onSelect: () => void;
}

const PRICE_RANGE_LABEL: Record<string, string> = { budget: "Budget", mid: "Mid-range", luxury: "Luxury" };

function AccommodationCard({ opt, nightCount, nightNumbers, location, startDate, adventureId, isSelected, onSelect }: AccommodationCardProps) {
  const totalEur = opt.price_per_night_eur
    ? opt.price_per_night_eur * nightCount
    : null;

  // Compute check-in/check-out from adventure start date if available
  const checkin = startDate && nightNumbers.length > 0
    ? offsetDate(startDate, (nightNumbers[0] ?? 1) - 1)
    : undefined;
  const checkout = startDate && nightNumbers.length > 0
    ? offsetDate(startDate, nightNumbers[nightNumbers.length - 1] ?? 1)
    : undefined;

  const trackingLabel = adventureId ? `adventure-${adventureId}` : undefined;

  return (
    <div
      className={`border transition-colors ${isSelected ? "border-[#212121]" : "border-[#dadccb]"}`}
    >
      <button
        onClick={onSelect}
        className="w-full text-left px-3 py-2.5 hover:bg-[#f8f8f5] transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-xs font-semibold text-[#212121] truncate">{opt.name}</p>
              {isSelected && <Check size={12} className="text-[#212121] flex-shrink-0" />}
            </div>
            <p className="text-xs text-[#717182]">
              {opt.type.charAt(0).toUpperCase() + opt.type.slice(1)} · {PRICE_RANGE_LABEL[opt.price_range]}
            </p>
            <p className="text-xs text-[#717182] mt-1 line-clamp-2">{opt.description}</p>
          </div>
          {opt.price_per_night_eur && (
            <div className="flex-shrink-0 text-right">
              <p className="text-sm font-bold text-[#212121]">€{opt.price_per_night_eur}</p>
              <p className="text-xs text-[#717182]">/ night</p>
              {nightCount > 1 && totalEur && (
                <p className="text-xs text-[#717182] mt-0.5">€{totalEur} total</p>
              )}
            </div>
          )}
        </div>
      </button>

      {/* Book link — always visible */}
      <div className="border-t border-[#dadccb] px-3 py-2 flex items-center justify-between">
        <p className="text-xs text-[#717182]">Find availability</p>
        <a
          href={bookingUrl({ propertyName: opt.name, location, checkin, checkout, trackingLabel })}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-xs font-semibold text-[#212121] hover:underline"
        >
          <ExternalLink size={11} />
          Booking.com
        </a>
      </div>
    </div>
  );
}
