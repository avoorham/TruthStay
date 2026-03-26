"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, MapPin, Home, Utensils, Camera, Map, Star, ExternalLink } from "lucide-react";

interface Trip {
  id: string;
  title: string;
  location: string;
  dates: string;
  coverImage: string;
  allPhotos: string[];
  accommodations: Array<{ name: string; type: string; address: string; rating: number; photos: string[] }>;
  restaurants: Array<{ name: string; cuisine: string; address: string; rating: number; photo: string }>;
  routes: Array<{ name: string; description: string; photos: string[] }>;
  itinerary: Array<{ day: number; date: string; activities: string[] }>;
}

const MY_TRIPS: Trip[] = [
  {
    id: "1",
    title: "Swiss Alps Adventure",
    location: "Switzerland",
    dates: "Jun 15 – Jun 27, 2024",
    coverImage: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&h=300&fit=crop",
    allPhotos: [
      "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop",
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=300&fit=crop",
    ],
    accommodations: [
      { name: "Alpine Chalet Zermatt", type: "Mountain Lodge", address: "Riedweg 2, 3920 Zermatt", rating: 5, photos: ["https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=400&h=300&fit=crop"] },
      { name: "Interlaken Boutique Hotel", type: "Hotel", address: "Höheweg 37, 3800 Interlaken", rating: 4, photos: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop"] },
    ],
    restaurants: [
      { name: "Chez Vrony", cuisine: "Swiss Alpine", address: "Findeln, 3920 Zermatt", rating: 5, photo: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=300&fit=crop" },
      { name: "Restaurant Taverne", cuisine: "Traditional Swiss", address: "Jungfraustrasse 68, Interlaken", rating: 4, photo: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop" },
    ],
    routes: [
      { name: "Gornergrat to Matterhorn Viewpoint", description: "Scenic train ride with panoramic views of the Matterhorn", photos: ["https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&h=300&fit=crop"] },
    ],
    itinerary: [
      { day: 1, date: "Jun 15", activities: ["Arrive in Zurich", "Train to Zermatt", "Check into Alpine Chalet", "Evening walk"] },
      { day: 2, date: "Jun 16", activities: ["Gornergrat Railway", "Matterhorn photography", "Lunch at Chez Vrony", "Hiking trails"] },
    ],
  },
];

type Tab = "itinerary" | "photos" | "accommodations" | "restaurants" | "routes";

export default function MyTripsPage() {
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("itinerary");

  if (selectedTrip) {
    const tabs: Array<{ id: Tab; label: string; icon: any }> = [
      { id: "itinerary", label: "Itinerary", icon: Calendar },
      { id: "photos", label: "Photos", icon: Camera },
      { id: "accommodations", label: "Stays", icon: Home },
      { id: "restaurants", label: "Dining", icon: Utensils },
      { id: "routes", label: "Routes", icon: Map },
    ];

    return (
      <div className="min-h-screen bg-white pb-20">
        {/* Hero */}
        <div className="relative">
          <img src={selectedTrip.coverImage} alt={selectedTrip.title} className="w-full h-64 object-cover" />
          <button onClick={() => setSelectedTrip(null)} className="absolute top-6 left-6 bg-white p-2 shadow-lg">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <div className="px-6 py-6 border-b border-[#dadccb]">
          <h1 className="text-2xl font-bold mb-2">{selectedTrip.title}</h1>
          <div className="flex items-center gap-4 text-sm text-[#717182]">
            <span className="flex items-center gap-1"><MapPin size={14} />{selectedTrip.location}</span>
            <span className="flex items-center gap-1"><Calendar size={14} />{selectedTrip.dates}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-[#dadccb] overflow-x-auto">
          <div className="flex px-6 gap-6">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 py-4 border-b-2 whitespace-nowrap transition-colors ${activeTab === id ? "border-black" : "border-transparent"}`}
              >
                <Icon size={16} className={activeTab === id ? "text-black" : "text-[#717182]"} />
                <span className={`text-sm ${activeTab === id ? "font-bold text-black" : "text-[#717182]"}`}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-6">
          {activeTab === "itinerary" && (
            <div className="space-y-6">
              {selectedTrip.itinerary.map((day) => (
                <div key={day.day} className="border-l-2 border-black pl-4">
                  <p className="font-bold text-lg">Day {day.day}</p>
                  <p className="text-sm text-[#717182] mb-3">{day.date}</p>
                  <ul className="space-y-2">
                    {day.activities.map((a, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-black rounded-full mt-2 flex-shrink-0" />
                        <p className="text-sm">{a}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {activeTab === "photos" && (
            <div className="grid grid-cols-2 gap-3">
              {selectedTrip.allPhotos.map((photo, i) => (
                <img key={i} src={photo} alt="" className="w-full h-44 object-cover" />
              ))}
            </div>
          )}

          {activeTab === "accommodations" && (
            <div className="space-y-6">
              {selectedTrip.accommodations.map((acc, i) => (
                <div key={i} className="border border-[#dadccb]">
                  <div className="grid grid-cols-2 gap-2 p-2">
                    {acc.photos.map((p, j) => <img key={j} src={p} alt="" className="w-full h-32 object-cover" />)}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <h3 className="font-bold">{acc.name}</h3>
                        <p className="text-sm text-[#717182]">{acc.type}</p>
                      </div>
                      <div className="flex gap-0.5">{[...Array(acc.rating)].map((_, k) => <Star key={k} size={14} fill="#000" stroke="none" />)}</div>
                    </div>
                    <p className="text-xs text-[#717182] mb-3 flex items-center gap-1"><MapPin size={12} />{acc.address}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "restaurants" && (
            <div className="space-y-4">
              {selectedTrip.restaurants.map((r, i) => (
                <div key={i} className="border border-[#dadccb]">
                  <img src={r.photo} alt={r.name} className="w-full h-40 object-cover" />
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <h3 className="font-bold">{r.name}</h3>
                        <p className="text-sm text-[#717182]">{r.cuisine}</p>
                      </div>
                      <div className="flex gap-0.5">{[...Array(r.rating)].map((_, k) => <Star key={k} size={14} fill="#000" stroke="none" />)}</div>
                    </div>
                    <p className="text-xs text-[#717182] flex items-center gap-1"><MapPin size={12} />{r.address}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "routes" && (
            <div className="space-y-6">
              {selectedTrip.routes.map((route, i) => (
                <div key={i} className="border border-[#dadccb]">
                  <div className="grid grid-cols-2 gap-2 p-2">
                    {route.photos.map((p, j) => <img key={j} src={p} alt="" className="w-full h-32 object-cover" />)}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold mb-1">{route.name}</h3>
                    <p className="text-sm text-[#717182]">{route.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="px-6 pt-16 pb-6 border-b border-[#dadccb]">
        <h1 className="text-2xl font-bold">My Trips</h1>
        <p className="text-sm text-[#717182] mt-1">{MY_TRIPS.length} trip{MY_TRIPS.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="p-6 space-y-4">
        {MY_TRIPS.map((trip) => (
          <div
            key={trip.id}
            onClick={() => { setSelectedTrip(trip); setActiveTab("itinerary"); }}
            className="border border-[#dadccb] cursor-pointer hover:shadow-md transition-shadow"
          >
            <img src={trip.coverImage} alt={trip.title} className="w-full h-48 object-cover" />
            <div className="p-4">
              <h2 className="font-bold text-lg mb-2">{trip.title}</h2>
              <div className="space-y-1 text-sm text-[#717182]">
                <div className="flex items-center gap-2"><MapPin size={14} />{trip.location}</div>
                <div className="flex items-center gap-2"><Calendar size={14} />{trip.dates}</div>
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs text-[#717182]">
                <span className="flex items-center gap-1"><Camera size={12} />{trip.allPhotos.length} photos</span>
                <span className="flex items-center gap-1"><Home size={12} />{trip.accommodations.length} stays</span>
                <span className="flex items-center gap-1"><Utensils size={12} />{trip.restaurants.length} dining</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
