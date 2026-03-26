"use client";

import { useState, useCallback } from "react";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox";
import { MapPin, Star } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

// Sample POIs — will be replaced with real DB data
const SAMPLE_POIS = [
  { id: "1", name: "Col de la Madone", category: "trailhead", lat: 43.778, lng: 7.412, rating: 4.9, activity: "Cycling" },
  { id: "2", name: "Hotel Riviera", category: "hotel", lat: 43.721, lng: 7.277, rating: 4.6, activity: "Cycling" },
  { id: "3", name: "Café du Cycliste", category: "cafe", lat: 43.698, lng: 7.265, rating: 4.8, activity: "Cycling" },
  { id: "4", name: "Gorges du Loup Trailhead", category: "trailhead", lat: 43.726, lng: 6.968, rating: 4.7, activity: "Hiking" },
  { id: "5", name: "La Colle sur Loup", category: "restaurant", lat: 43.686, lng: 7.093, rating: 4.5, activity: "Hiking" },
  { id: "6", name: "Auberge de la Madone", category: "guesthouse", lat: 43.779, lng: 7.392, rating: 4.4, activity: "Cycling" },
];

const CATEGORY_COLOURS: Record<string, string> = {
  trailhead: "#16a34a",
  hotel: "#2563eb",
  hostel: "#2563eb",
  guesthouse: "#2563eb",
  campsite: "#d97706",
  restaurant: "#dc2626",
  cafe: "#dc2626",
  bar: "#dc2626",
  bike_shop: "#7c3aed",
  viewpoint: "#0891b2",
  other: "#212121",
};

interface POI {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  rating: number;
  activity: string;
}

export function ExploreMap() {
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
  const [viewState, setViewState] = useState({
    longitude: 7.265,
    latitude: 43.698,
    zoom: 10,
  });

  const handleMarkerClick = useCallback((poi: POI) => {
    setSelectedPOI(poi);
  }, []);

  return (
    <div className="w-full h-full">
      <Map
        {...viewState}
        onMove={(e) => setViewState(e.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: "100%", height: "100%" }}
        onClick={() => setSelectedPOI(null)}
      >
        <NavigationControl position="bottom-right" showCompass={false} />

        {SAMPLE_POIS.map((poi) => (
          <Marker
            key={poi.id}
            longitude={poi.lng}
            latitude={poi.lat}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handleMarkerClick(poi);
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg cursor-pointer border-2 border-white"
              style={{ backgroundColor: CATEGORY_COLOURS[poi.category] ?? "#212121" }}
            >
              <MapPin size={14} color="white" fill="white" />
            </div>
          </Marker>
        ))}

        {selectedPOI && (
          <Popup
            longitude={selectedPOI.lng}
            latitude={selectedPOI.lat}
            anchor="bottom"
            offset={40}
            onClose={() => setSelectedPOI(null)}
            closeButton={false}
            className="rounded-none"
          >
            <div className="p-3 min-w-[180px] font-[family-name:var(--font-archivo)]">
              <p className="font-bold text-sm text-[#212121] mb-0.5">{selectedPOI.name}</p>
              <p className="text-xs text-[#717182] capitalize mb-2">
                {selectedPOI.category.replace("_", " ")} · {selectedPOI.activity}
              </p>
              <div className="flex items-center gap-1">
                <Star size={12} fill="#212121" stroke="none" />
                <span className="text-xs font-semibold">{selectedPOI.rating.toFixed(1)}</span>
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
