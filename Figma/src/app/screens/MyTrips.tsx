import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Calendar, MapPin, Home, Utensils, Camera, Map, Star, ExternalLink } from 'lucide-react';

interface Accommodation {
  name: string;
  type: string;
  address: string;
  link: string;
  rating: number;
  photos: string[];
}

interface Restaurant {
  name: string;
  cuisine: string;
  address: string;
  link: string;
  rating: number;
  photo: string;
}

interface RoutePoint {
  name: string;
  description: string;
  photos: string[];
}

interface Trip {
  id: string;
  title: string;
  location: string;
  dates: string;
  coverImage: string;
  allPhotos: string[];
  accommodations: Accommodation[];
  restaurants: Restaurant[];
  routes: RoutePoint[];
  itinerary: {
    day: number;
    date: string;
    activities: string[];
  }[];
}

const MY_TRIPS: Trip[] = [
  {
    id: '1',
    title: 'Swiss Alps Adventure',
    location: 'Switzerland',
    dates: 'Jun 15 - Jun 27, 2024',
    coverImage: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&h=300&fit=crop',
    allPhotos: [
      'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
    ],
    accommodations: [
      {
        name: 'Alpine Chalet Zermatt',
        type: 'Mountain Lodge',
        address: 'Riedweg 2, 3920 Zermatt',
        link: 'https://booking.com',
        rating: 5,
        photos: [
          'https://images.unsplash.com/photo-1470770903676-69b98201ea1c?w=400&h=300&fit=crop',
          'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&h=300&fit=crop',
        ],
      },
      {
        name: 'Interlaken Boutique Hotel',
        type: 'Hotel',
        address: 'Höheweg 37, 3800 Interlaken',
        link: 'https://booking.com',
        rating: 4,
        photos: [
          'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=300&fit=crop',
        ],
      },
    ],
    restaurants: [
      {
        name: 'Chez Vrony',
        cuisine: 'Swiss Alpine',
        address: 'Findeln, 3920 Zermatt',
        link: 'https://maps.google.com',
        rating: 5,
        photo: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=300&fit=crop',
      },
      {
        name: 'Restaurant Taverne',
        cuisine: 'Traditional Swiss',
        address: 'Jungfraustrasse 68, Interlaken',
        link: 'https://maps.google.com',
        rating: 4,
        photo: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop',
      },
      {
        name: 'Glacier Restaurant Eiger',
        cuisine: 'Mountain Cuisine',
        address: 'Eigergletscher Station',
        link: 'https://maps.google.com',
        rating: 5,
        photo: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop',
      },
    ],
    routes: [
      {
        name: 'Gornergrat Railway to Matterhorn Viewpoint',
        description: 'Scenic train ride with panoramic views of the Matterhorn and surrounding peaks',
        photos: [
          'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&h=300&fit=crop',
          'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
        ],
      },
      {
        name: 'Jungfraujoch - Top of Europe',
        description: 'Journey to the highest railway station in Europe at 3,454m',
        photos: [
          'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=300&fit=crop',
        ],
      },
    ],
    itinerary: [
      {
        day: 1,
        date: 'Jun 15',
        activities: ['Arrive in Zurich', 'Train to Zermatt', 'Check into Alpine Chalet', 'Evening walk through village'],
      },
      {
        day: 2,
        date: 'Jun 16',
        activities: ['Gornergrat Railway trip', 'Matterhorn photography', 'Lunch at Chez Vrony', 'Hiking trails'],
      },
      {
        day: 3,
        date: 'Jun 17',
        activities: ['Full day Jungfraujoch excursion', 'Ice Palace visit', 'Sphinx Observatory', 'Return to Interlaken'],
      },
    ],
  },
  {
    id: '2',
    title: 'Bali Beach Retreat',
    location: 'Bali, Indonesia',
    dates: 'Aug 5 - Aug 15, 2024',
    coverImage: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&h=300&fit=crop',
    allPhotos: [
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1559628376-f3fe5f782a2e?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?w=400&h=300&fit=crop',
    ],
    accommodations: [
      {
        name: 'Seminyak Beach Villa',
        type: 'Private Villa',
        address: 'Jl. Petitenget, Seminyak',
        link: 'https://airbnb.com',
        rating: 5,
        photos: [
          'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400&h=300&fit=crop',
        ],
      },
    ],
    restaurants: [
      {
        name: 'Potato Head Beach Club',
        cuisine: 'International',
        address: 'Jl. Petitenget 51B, Seminyak',
        link: 'https://maps.google.com',
        rating: 5,
        photo: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=400&h=300&fit=crop',
      },
      {
        name: 'Locavore',
        cuisine: 'Contemporary Indonesian',
        address: 'Jl. Dewisita, Ubud',
        link: 'https://maps.google.com',
        rating: 5,
        photo: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=400&h=300&fit=crop',
      },
    ],
    routes: [
      {
        name: 'Uluwatu Temple Coastal Route',
        description: 'Scenic coastal drive to clifftop temple with sunset views',
        photos: [
          'https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?w=400&h=300&fit=crop',
        ],
      },
    ],
    itinerary: [
      {
        day: 1,
        date: 'Aug 5',
        activities: ['Arrive in Denpasar', 'Transfer to Seminyak', 'Beach villa check-in', 'Sunset at beach'],
      },
      {
        day: 2,
        date: 'Aug 6',
        activities: ['Surf lessons at Seminyak Beach', 'Spa afternoon', 'Dinner at Potato Head'],
      },
    ],
  },
];

export function MyTrips() {
  const navigate = useNavigate();
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [activeTab, setActiveTab] = useState<'photos' | 'accommodations' | 'restaurants' | 'routes' | 'itinerary'>('itinerary');

  if (selectedTrip) {
    return (
      <div className="min-h-screen bg-white pb-20">
        {/* Trip Header */}
        <div className="relative">
          <img 
            src={selectedTrip.coverImage} 
            alt={selectedTrip.title}
            className="w-full h-64 object-cover"
          />
          <button
            onClick={() => setSelectedTrip(null)}
            className="absolute top-6 left-6 bg-white p-2 shadow-lg"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-6 border-b border-[#dadccb]">
          <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Archivo, sans-serif' }}>
            {selectedTrip.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-[#212121]">
            <div className="flex items-center gap-1">
              <MapPin size={16} />
              <span style={{ fontFamily: 'Archivo, sans-serif' }}>{selectedTrip.location}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={16} />
              <span style={{ fontFamily: 'Archivo, sans-serif' }}>{selectedTrip.dates}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-[#dadccb] overflow-x-auto">
          <div className="flex px-6 gap-6">
            {[
              { id: 'itinerary', label: 'Itinerary', icon: Calendar },
              { id: 'photos', label: 'Photos', icon: Camera },
              { id: 'accommodations', label: 'Stays', icon: Home },
              { id: 'restaurants', label: 'Dining', icon: Utensils },
              { id: 'routes', label: 'Routes', icon: Map },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`flex items-center gap-2 py-4 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === id ? 'border-black' : 'border-transparent'
                }`}
              >
                <Icon size={16} className={activeTab === id ? 'text-black' : 'text-[#212121]'} />
                <span
                  className={`text-sm ${activeTab === id ? 'font-bold text-black' : 'text-[#212121]'}`}
                  style={{ fontFamily: 'Archivo, sans-serif' }}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-6 py-6">
          {activeTab === 'itinerary' && (
            <div className="space-y-6">
              {selectedTrip.itinerary.map((day) => (
                <div key={day.day} className="border-l-2 border-black pl-4">
                  <div className="mb-3">
                    <p className="font-bold text-lg" style={{ fontFamily: 'Archivo, sans-serif' }}>
                      Day {day.day}
                    </p>
                    <p className="text-sm text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
                      {day.date}
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {day.activities.map((activity, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-black rounded-full mt-2 flex-shrink-0" />
                        <p className="text-sm" style={{ fontFamily: 'Archivo, sans-serif' }}>
                          {activity}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'photos' && (
            <div className="grid grid-cols-2 gap-3">
              {selectedTrip.allPhotos.map((photo, idx) => (
                <img
                  key={idx}
                  src={photo}
                  alt={`Photo ${idx + 1}`}
                  className="w-full h-44 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                />
              ))}
            </div>
          )}

          {activeTab === 'accommodations' && (
            <div className="space-y-6">
              {selectedTrip.accommodations.map((acc, idx) => (
                <div key={idx} className="border border-[#dadccb] bg-white shadow-sm">
                  <div className="grid grid-cols-2 gap-2 p-2">
                    {acc.photos.map((photo, photoIdx) => (
                      <img
                        key={photoIdx}
                        src={photo}
                        alt={acc.name}
                        className="w-full h-32 object-cover"
                      />
                    ))}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-base mb-1" style={{ fontFamily: 'Archivo, sans-serif' }}>
                          {acc.name}
                        </h3>
                        <p className="text-sm text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
                          {acc.type}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {[...Array(acc.rating)].map((_, i) => (
                          <Star key={i} size={14} fill="#000" stroke="none" />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-[#212121] mb-3 flex items-start gap-1" style={{ fontFamily: 'Archivo, sans-serif' }}>
                      <MapPin size={12} className="mt-0.5 flex-shrink-0" />
                      {acc.address}
                    </p>
                    <a
                      href={acc.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-black text-white py-2 text-sm font-bold"
                      style={{ fontFamily: 'Archivo, sans-serif' }}
                    >
                      View Booking <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'restaurants' && (
            <div className="space-y-4">
              {selectedTrip.restaurants.map((restaurant, idx) => (
                <div key={idx} className="border border-[#dadccb] bg-white shadow-sm">
                  <img
                    src={restaurant.photo}
                    alt={restaurant.name}
                    className="w-full h-40 object-cover"
                  />
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-base mb-1" style={{ fontFamily: 'Archivo, sans-serif' }}>
                          {restaurant.name}
                        </h3>
                        <p className="text-sm text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
                          {restaurant.cuisine}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {[...Array(restaurant.rating)].map((_, i) => (
                          <Star key={i} size={14} fill="#000" stroke="none" />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-[#212121] mb-3 flex items-start gap-1" style={{ fontFamily: 'Archivo, sans-serif' }}>
                      <MapPin size={12} className="mt-0.5 flex-shrink-0" />
                      {restaurant.address}
                    </p>
                    <a
                      href={restaurant.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-black text-white py-2 text-sm font-bold"
                      style={{ fontFamily: 'Archivo, sans-serif' }}
                    >
                      View on Maps <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'routes' && (
            <div className="space-y-6">
              {selectedTrip.routes.map((route, idx) => (
                <div key={idx} className="border border-[#dadccb] bg-white shadow-sm">
                  <div className="grid grid-cols-2 gap-2 p-2">
                    {route.photos.map((photo, photoIdx) => (
                      <img
                        key={photoIdx}
                        src={photo}
                        alt={route.name}
                        className="w-full h-32 object-cover"
                      />
                    ))}
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-base mb-2" style={{ fontFamily: 'Archivo, sans-serif' }}>
                      {route.name}
                    </h3>
                    <p className="text-sm text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
                      {route.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Trip List View
  return (
    <div className="min-h-screen bg-white">
      <div className="px-6 pt-16 pb-6 border-b border-[#dadccb]">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Archivo, sans-serif' }}>
          My Trips
        </h1>
        <p className="text-sm text-[#212121] mt-1" style={{ fontFamily: 'Archivo, sans-serif' }}>
          {MY_TRIPS.length} trip{MY_TRIPS.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="p-6 space-y-4">
        {MY_TRIPS.map((trip) => (
          <div
            key={trip.id}
            onClick={() => setSelectedTrip(trip)}
            className="border border-[#dadccb] bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          >
            <img
              src={trip.coverImage}
              alt={trip.title}
              className="w-full h-48 object-cover"
            />
            <div className="p-4">
              <h2 className="font-bold text-lg mb-2" style={{ fontFamily: 'Archivo, sans-serif' }}>
                {trip.title}
              </h2>
              <div className="space-y-1 text-sm text-[#212121]">
                <div className="flex items-center gap-2">
                  <MapPin size={14} />
                  <span style={{ fontFamily: 'Archivo, sans-serif' }}>{trip.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={14} />
                  <span style={{ fontFamily: 'Archivo, sans-serif' }}>{trip.dates}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4 text-xs" style={{ fontFamily: 'Archivo, sans-serif' }}>
                <div className="flex items-center gap-1">
                  <Camera size={12} />
                  <span>{trip.allPhotos.length} photos</span>
                </div>
                <div className="flex items-center gap-1">
                  <Home size={12} />
                  <span>{trip.accommodations.length} stay{trip.accommodations.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Utensils size={12} />
                  <span>{trip.restaurants.length} spots</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
