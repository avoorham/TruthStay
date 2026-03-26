import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { SlidersHorizontal } from 'lucide-react';
import { Drawer } from 'vaul';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

interface Adventure {
  id: string;
  title: string;
  location: string;
  activity: string;
  duration: string;
  userName: string;
  coordinates: [number, number]; // [lat, lng]
  image: string;
}

const ADVENTURES: Adventure[] = [
  {
    id: '1',
    title: 'Swiss Alps Adventure',
    location: 'Switzerland',
    activity: 'Hiking',
    duration: '14 days',
    userName: 'Sarah Chen',
    coordinates: [46.8182, 8.2275],
    image: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&h=300&fit=crop',
  },
  {
    id: '2',
    title: 'Bali Surf Trip',
    location: 'Indonesia',
    activity: 'Surfing',
    duration: '10 days',
    userName: 'Alex Rivera',
    coordinates: [-8.3405, 115.0920],
    image: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=400&h=300&fit=crop',
  },
  {
    id: '3',
    title: 'Amalfi Coast Cycling',
    location: 'Italy',
    activity: 'Cycling',
    duration: '12 days',
    userName: 'Emma Wilson',
    coordinates: [40.6333, 14.6029],
    image: 'https://images.unsplash.com/photo-1534113414509-0bd4d016608c?w=400&h=300&fit=crop',
  },
  {
    id: '4',
    title: 'Norwegian Fjords',
    location: 'Norway',
    activity: 'Kayaking',
    duration: '8 days',
    userName: 'Mike Johnson',
    coordinates: [61.0898, 6.8336],
    image: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&h=300&fit=crop',
  },
  {
    id: '5',
    title: 'Patagonia Trek',
    location: 'Argentina',
    activity: 'Hiking',
    duration: '10 days',
    userName: 'Carlos Martinez',
    coordinates: [-50.5000, -73.0000],
    image: 'https://images.unsplash.com/photo-1434725039720-aaad6dd32dfe?w=400&h=300&fit=crop',
  },
  {
    id: '6',
    title: 'Iceland Winter',
    location: 'Iceland',
    activity: 'Winter Sports',
    duration: '7 days',
    userName: 'Anna Berg',
    coordinates: [64.9631, -19.0208],
    image: 'https://images.unsplash.com/photo-1549388167-6fea1c37a10e?w=400&h=300&fit=crop',
  },
  {
    id: '7',
    title: 'Yosemite Climbing',
    location: 'USA',
    activity: 'Climbing',
    duration: '5 days',
    userName: 'Tom Anderson',
    coordinates: [37.8651, -119.5383],
    image: 'https://images.unsplash.com/photo-1698732994632-4956f36630d5?w=400&h=300&fit=crop',
  },
  {
    id: '8',
    title: 'Great Barrier Reef',
    location: 'Australia',
    activity: 'Scuba Diving',
    duration: '6 days',
    userName: 'Sophie Taylor',
    coordinates: [-18.2871, 147.6992],
    image: 'https://images.unsplash.com/photo-1628371217613-714161455f6b?w=400&h=300&fit=crop',
  },
  {
    id: '9',
    title: 'Tokyo Culture Tour',
    location: 'Japan',
    activity: 'Hiking',
    duration: '8 days',
    userName: 'Yuki Tanaka',
    coordinates: [35.6762, 139.6503],
    image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=300&fit=crop',
  },
  {
    id: '10',
    title: 'Sahara Desert Trek',
    location: 'Morocco',
    activity: 'Hiking',
    duration: '6 days',
    userName: 'Hassan Ali',
    coordinates: [31.7917, -7.0926],
    image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&h=300&fit=crop',
  },
  {
    id: '11',
    title: 'New Zealand Road Trip',
    location: 'New Zealand',
    activity: 'Hiking',
    duration: '15 days',
    userName: 'Kate Brown',
    coordinates: [-41.2865, 174.7762],
    image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&h=300&fit=crop',
  },
  {
    id: '12',
    title: 'Peru Machu Picchu',
    location: 'Peru',
    activity: 'Hiking',
    duration: '9 days',
    userName: 'Diego Santos',
    coordinates: [-13.1631, -72.5450],
    image: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=400&h=300&fit=crop',
  },
  {
    id: '13',
    title: 'Thailand Beach Hopping',
    location: 'Thailand',
    activity: 'Surfing',
    duration: '11 days',
    userName: 'Lisa Wang',
    coordinates: [7.8804, 98.3923],
    image: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=400&h=300&fit=crop',
  },
  {
    id: '14',
    title: 'Canadian Rockies',
    location: 'Canada',
    activity: 'Hiking',
    duration: '10 days',
    userName: 'Jack Wilson',
    coordinates: [51.4968, -115.9281],
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=300&fit=crop',
  },
];

const ACTIVITIES = ['All', 'Hiking', 'Cycling', 'Surfing', 'Kayaking', 'Climbing', 'Winter Sports', 'Scuba Diving'];
const DURATIONS = ['All', '1-5 days', '6-10 days', '11+ days'];

export function Explore() {
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerClusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  
  const [selectedActivity, setSelectedActivity] = useState<string>('All');
  const [selectedDuration, setSelectedDuration] = useState<string>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [filteredAdventures, setFilteredAdventures] = useState<Adventure[]>(ADVENTURES);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create map
    const map = L.map(mapContainerRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: true,
    });

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when filtered adventures change
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing marker cluster group
    if (markerClusterGroupRef.current) {
      mapRef.current.removeLayer(markerClusterGroupRef.current);
    }

    // Create new marker cluster group with custom styling
    const markers = L.markerClusterGroup({
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="
            background: white;
            border: 2px solid #000;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Archivo, sans-serif;
            font-weight: bold;
            font-size: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          ">${count}</div>`,
          className: 'custom-cluster-icon',
          iconSize: L.point(40, 40),
        });
      },
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
    });

    // Add markers for filtered adventures
    filteredAdventures.forEach((adventure) => {
      // Custom marker icon
      const markerIcon = L.divIcon({
        html: `
          <div style="display: flex; flex-direction: column; align-items: center;">
            <div style="
              background: white;
              border: 2px solid #000;
              padding: 6px 12px;
              font-family: Archivo, sans-serif;
              font-size: 11px;
              font-weight: bold;
              white-space: nowrap;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              margin-bottom: 4px;
            ">
              ${adventure.location}
            </div>
            <svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.4 0 0 5.4 0 12C0 21 12 32 12 32C12 32 24 21 24 12C24 5.4 18.6 0 12 0Z" fill="#000000"/>
              <circle cx="12" cy="12" r="6" fill="white"/>
            </svg>
          </div>
        `,
        className: 'custom-marker-icon',
        iconSize: [80, 60],
        iconAnchor: [40, 60],
      });

      const marker = L.marker(adventure.coordinates, { icon: markerIcon });

      // Create popup content
      const popupContent = `
        <div style="font-family: Archivo, sans-serif; width: 200px;">
          <img src="${adventure.image}" alt="${adventure.title}" style="width: 100%; height: 120px; object-fit: cover; margin-bottom: 8px;" />
          <h3 style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${adventure.title}</h3>
          <p style="font-size: 12px; color: #212121; margin-bottom: 4px;">${adventure.location}</p>
          <p style="font-size: 12px; margin-bottom: 8px;">
            <span style="font-weight: bold;">${adventure.userName}</span> • ${adventure.duration}
          </p>
          <button 
            onclick="window.handleTripClick('${adventure.id}')" 
            style="
              width: 100%;
              background: #000;
              color: white;
              padding: 8px;
              border: none;
              font-family: Archivo, sans-serif;
              font-weight: bold;
              font-size: 12px;
              cursor: pointer;
            "
          >
            View Trip
          </button>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 220,
        className: 'custom-popup',
      });

      markers.addLayer(marker);
    });

    mapRef.current.addLayer(markers);
    markerClusterGroupRef.current = markers;

    // Add global click handler for popup buttons
    (window as any).handleTripClick = (id: string) => {
      navigate(`/app/trip/${id}`);
    };

    return () => {
      delete (window as any).handleTripClick;
    };
  }, [filteredAdventures, navigate]);

  // Filter logic
  useEffect(() => {
    let filtered = ADVENTURES;

    if (selectedActivity !== 'All') {
      filtered = filtered.filter(a => a.activity === selectedActivity);
    }

    if (selectedDuration !== 'All') {
      filtered = filtered.filter(a => {
        const days = parseInt(a.duration);
        if (selectedDuration === '1-5 days') return days <= 5;
        if (selectedDuration === '6-10 days') return days >= 6 && days <= 10;
        if (selectedDuration === '11+ days') return days >= 11;
        return true;
      });
    }

    setFilteredAdventures(filtered);
  }, [selectedActivity, selectedDuration]);

  const hasActiveFilters = selectedActivity !== 'All' || selectedDuration !== 'All';

  const clearFilters = () => {
    setSelectedActivity('All');
    setSelectedDuration('All');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col pb-16">
      {/* Filter Bar */}
      <div className="bg-white border-b border-[#dadccb] z-[1000] relative">
        <div className="px-6 py-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full bg-white px-4 py-3 flex items-center justify-between shadow-sm"
            style={{ fontFamily: 'Archivo, sans-serif' }}
          >
            <div className="flex flex-col items-start">
              <span className="font-bold text-sm">
                {hasActiveFilters ? 'Filtered adventures' : 'Adventures in map area'}
              </span>
              <span className="text-xs text-[#212121]">
                {selectedActivity !== 'All' && selectedActivity}
                {selectedActivity !== 'All' && selectedDuration !== 'All' && ' • '}
                {selectedDuration !== 'All' && selectedDuration}
                {!hasActiveFilters && 'All activities • All durations'}
              </span>
            </div>
            <SlidersHorizontal size={20} />
          </button>
        </div>

        {/* Filter Dropdown */}
        {showFilters && (
          <div className="absolute top-full left-0 right-0 bg-white border-b border-[#dadccb] shadow-lg z-[1001]">
            <div className="px-6 py-6">
              {/* Activity Filter */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm" style={{ fontFamily: 'Archivo, sans-serif' }}>
                    Activity
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITIES.map(activity => (
                    <button
                      key={activity}
                      onClick={() => setSelectedActivity(activity)}
                      className={`px-4 py-2 text-sm border ${
                        selectedActivity === activity
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black border-[#212121]'
                      }`}
                      style={{ fontFamily: 'Archivo, sans-serif' }}
                    >
                      {activity}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Filter */}
              <div className="mb-4">
                <h3 className="font-bold text-sm mb-3" style={{ fontFamily: 'Archivo, sans-serif' }}>
                  Duration
                </h3>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map(duration => (
                    <button
                      key={duration}
                      onClick={() => setSelectedDuration(duration)}
                      className={`px-4 py-2 text-sm border ${
                        selectedDuration === duration
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black border-[#212121]'
                      }`}
                      style={{ fontFamily: 'Archivo, sans-serif' }}
                    >
                      {duration}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-[#dadccb]">
                <button
                  onClick={clearFilters}
                  className="flex-1 px-4 py-3 border border-[#212121] text-sm font-bold"
                  style={{ fontFamily: 'Archivo, sans-serif' }}
                >
                  Clear all
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="flex-1 px-4 py-3 bg-black text-white text-sm font-bold"
                  style={{ fontFamily: 'Archivo, sans-serif' }}
                >
                  Show {filteredAdventures.length} adventures
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Bottom Drawer */}
        <Drawer.Root>
          <Drawer.Trigger asChild>
            <button className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white px-6 py-3 shadow-lg border border-black z-[999]">
              <p className="font-bold text-sm" style={{ fontFamily: 'Archivo, sans-serif' }}>
                {filteredAdventures.length} adventure{filteredAdventures.length !== 1 ? 's' : ''}
              </p>
            </button>
          </Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 bg-black/40 z-[1000]" />
            <Drawer.Content className="bg-white flex flex-col fixed bottom-0 left-0 right-0 max-w-[390px] mx-auto h-[80vh] z-[1001]">
              {/* Drawer Handle */}
              <div className="flex-shrink-0 bg-white border-b border-[#dadccb]">
                <div className="mx-auto w-12 h-1.5 bg-[#212121] rounded-full mt-4 mb-2" />
                <div className="px-6 py-4">
                  <Drawer.Title className="font-bold text-lg" style={{ fontFamily: 'Archivo, sans-serif' }}>
                    {filteredAdventures.length} adventure{filteredAdventures.length !== 1 ? 's' : ''}
                  </Drawer.Title>
                  <Drawer.Description className="text-sm text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
                    in this area
                  </Drawer.Description>
                </div>
              </div>

              {/* Adventure Tiles */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  {filteredAdventures.map((adventure) => (
                    <div
                      key={adventure.id}
                      onClick={() => navigate(`/app/trip/${adventure.id}`)}
                      className="cursor-pointer bg-white border border-[#dadccb] shadow-sm"
                    >
                      <img
                        src={adventure.image}
                        alt={adventure.title}
                        className="w-full h-32 object-cover"
                      />
                      <div className="p-3">
                        <h3 className="font-bold text-sm mb-1" style={{ fontFamily: 'Archivo, sans-serif' }}>
                          {adventure.location}
                        </h3>
                        <p className="text-xs text-[#212121] mb-2" style={{ fontFamily: 'Archivo, sans-serif' }}>
                          {adventure.title}
                        </p>
                        <p className="text-xs" style={{ fontFamily: 'Archivo, sans-serif' }}>
                          <span className="font-bold">{adventure.userName}</span>
                        </p>
                        <p className="text-xs text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
                          {adventure.duration}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </div>

      <style>{`
        .leaflet-container {
          font-family: 'Archivo', sans-serif;
        }
        .custom-marker-icon {
          background: transparent !important;
          border: none !important;
        }
        .custom-cluster-icon {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 0;
          padding: 0;
          border: 2px solid #000;
        }
        .leaflet-popup-content {
          margin: 0;
          font-family: 'Archivo', sans-serif;
        }
        .leaflet-popup-tip {
          background: white;
          border: 2px solid #000;
          border-top: none;
          border-right: none;
        }
        .custom-popup .leaflet-popup-close-button {
          font-size: 20px;
          padding: 8px 12px;
          color: #000;
        }
      `}</style>
    </div>
  );
}