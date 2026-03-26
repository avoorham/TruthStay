"use client";

import { useState, useEffect } from "react";
import { Calendar, MapPin, ChevronRight, ChevronDown, Sparkles } from "lucide-react";
import Link from "next/link";
import { KomootEmbed } from "../../../components/KomootEmbed";

interface AdventureDay {
  id: string;
  dayNumber: number;
  title: string;
  description: string | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  routeNotes: string | null;
  komootTourId: string | null;
}

interface SavedAdventure {
  id: string;
  title: string;
  description: string | null;
  region: string;
  activityType: string;
  durationDays: number;
  startDate: string | null;
  createdAt: string;
  adventure_days: AdventureDay[];
}

export default function MyTripsPage() {
  const [adventures, setAdventures] = useState<SavedAdventure[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SavedAdventure | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
  // Per-day Komoot tour IDs — seeded from DB, updated when user links/unlinks
  const [komootTourIds, setKomootTourIds] = useState<Record<number, string>>({});

  useEffect(() => {
    fetch("/api/adventures")
      .then((r) => r.json())
      .then((data) => setAdventures(data.adventures ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleDay = (dayNumber: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      next.has(dayNumber) ? next.delete(dayNumber) : next.add(dayNumber);
      return next;
    });
  };

  const openAdventure = (adv: SavedAdventure) => {
    setSelected(adv);
    setExpandedDays(new Set());
    // Seed Komoot IDs from DB data
    const ids: Record<number, string> = {};
    for (const day of adv.adventure_days ?? []) {
      if (day.komootTourId) ids[day.dayNumber] = day.komootTourId;
    }
    setKomootTourIds(ids);
  };

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    const days = [...(selected.adventure_days ?? [])].sort(
      (a, b) => a.dayNumber - b.dayNumber
    );

    return (
      <div className="min-h-screen bg-white pb-20">
        {/* Header */}
        <div className="px-4 pt-12 pb-4 border-b border-[#dadccb] flex items-start gap-3">
          <button
            onClick={() => { setSelected(null); setExpandedDays(new Set()); setKomootTourIds({}); }}
            className="text-[#212121] pt-0.5"
          >
            <ChevronRight size={20} className="rotate-180" strokeWidth={1.5} />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-lg leading-snug">{selected.title}</h1>
            <div className="flex gap-2 mt-1 text-xs text-[#717182]">
              <span className="flex items-center gap-1"><MapPin size={11} />{selected.region}</span>
              <span>·</span>
              <span>{selected.durationDays} days</span>
              <span>·</span>
              <span className="capitalize">{selected.activityType.replace("_", " ")}</span>
            </div>
          </div>
        </div>

        {selected.description && (
          <p className="px-4 py-4 text-sm text-[#717182] border-b border-[#dadccb]">
            {selected.description}
          </p>
        )}

        {/* Days */}
        <div className="divide-y divide-[#dadccb]">
          {days.map((day) => {
            const isOpen = expandedDays.has(day.dayNumber);
            return (
              <div key={day.id}>
                <button
                  onClick={() => toggleDay(day.dayNumber)}
                  className="w-full flex items-start justify-between px-4 py-4 text-left hover:bg-[#f8f8f5] transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-xs font-semibold text-[#717182] mb-0.5">Day {day.dayNumber}</p>
                    <p className="text-sm font-semibold text-[#212121]">{day.title}</p>
                    <div className="flex gap-2 mt-1.5">
                      {day.distanceKm && (
                        <span className="text-xs bg-[#e9ebef] text-[#212121] px-2 py-0.5">
                          {day.distanceKm}km
                        </span>
                      )}
                      {day.elevationGainM && (
                        <span className="text-xs bg-[#e9ebef] text-[#212121] px-2 py-0.5">
                          {day.elevationGainM}m ↑
                        </span>
                      )}
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronDown size={16} className="text-[#717182] mt-1 flex-shrink-0" strokeWidth={1.5} />
                  ) : (
                    <ChevronRight size={16} className="text-[#717182] mt-1 flex-shrink-0" strokeWidth={1.5} />
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-2">
                    {day.description && (
                      <p className="text-sm text-[#212121] leading-relaxed">{day.description}</p>
                    )}
                    {day.routeNotes && (
                      <p className="text-xs text-[#717182] leading-relaxed border-l-2 border-[#dadccb] pl-3">
                        {day.routeNotes}
                      </p>
                    )}
                    <KomootEmbed
                      tourId={komootTourIds[day.dayNumber] ?? null}
                      adventureId={selected.id}
                      dayNumber={day.dayNumber}
                      editable={true}
                      onLinked={(id) =>
                        setKomootTourIds((prev) => ({ ...prev, [day.dayNumber]: id }))
                      }
                      onUnlinked={() =>
                        setKomootTourIds((prev) => {
                          const next = { ...prev };
                          delete next[day.dayNumber];
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
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">
      <div className="px-4 pt-12 pb-4 border-b border-[#dadccb]">
        <h1 className="text-xl font-bold">My Adventures</h1>
        {!loading && (
          <p className="text-sm text-[#717182] mt-0.5">
            {adventures.length} saved {adventures.length === 1 ? "adventure" : "adventures"}
          </p>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-[#717182]">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-[#717182] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 bg-[#717182] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 bg-[#717182] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      )}

      {!loading && adventures.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
          <Sparkles size={32} strokeWidth={1.5} className="text-[#dadccb] mb-4" />
          <p className="font-semibold text-[#212121] mb-1">No saved adventures yet</p>
          <p className="text-sm text-[#717182] mb-6">
            Chat with the AI planner to build your first sport adventure
          </p>
          <Link
            href="/discover"
            className="bg-black text-white text-sm font-semibold px-6 py-3"
          >
            Start planning
          </Link>
        </div>
      )}

      {!loading && adventures.length > 0 && (
        <div className="divide-y divide-[#dadccb]">
          {adventures.map((adv) => (
            <button
              key={adv.id}
              onClick={() => openAdventure(adv)}
              className="w-full text-left px-4 py-4 hover:bg-[#f8f8f5] transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#212121] leading-snug mb-1">{adv.title}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[#717182]">
                    <span className="flex items-center gap-1"><MapPin size={11} />{adv.region}</span>
                    <span>{adv.durationDays} days</span>
                    <span className="capitalize">{adv.activityType.replace("_", " ")}</span>
                  </div>
                  {adv.description && (
                    <p className="text-xs text-[#717182] mt-1.5 line-clamp-2">{adv.description}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    {(adv.adventure_days ?? [])
                      .slice(0, 3)
                      .sort((a, b) => a.dayNumber - b.dayNumber)
                      .map((d) => (
                        <span key={d.id} className="text-xs bg-[#e9ebef] text-[#212121] px-2 py-0.5 truncate max-w-[100px]">
                          Day {d.dayNumber}: {d.title.split("→")[0]?.trim() ?? d.title}
                        </span>
                      ))}
                    {(adv.adventure_days ?? []).length > 3 && (
                      <span className="text-xs text-[#717182] py-0.5">
                        +{adv.adventure_days.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <ChevronRight size={16} className="text-[#717182]" strokeWidth={1.5} />
                  <span className="text-xs text-[#717182]">
                    {new Date(adv.createdAt).toLocaleDateString([], { day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
