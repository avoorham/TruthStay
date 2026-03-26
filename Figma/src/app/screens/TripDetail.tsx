import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, MapPin, Hotel, Utensils, Route, Activity } from 'lucide-react';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { Button } from '../components/Button';

// Mock data for trip details
const TRIP_DATA: Record<string, any> = {
  '1': {
    userName: 'Sarah Chen',
    userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    title: 'Two weeks exploring the Swiss Alps',
    location: 'Swiss Alps, Switzerland',
    duration: '14 days',
    images: [
      'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1434725039720-aaad6dd32dfe?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=800&fit=crop',
    ],
    description: 'Incredible hiking trails and mountain views throughout the Swiss Alps. Every day brought new adventures and stunning panoramas.',
    accommodations: [
      { name: 'Mountain Lodge Zermatt', location: 'Zermatt', type: 'Hotel', nights: 7 },
      { name: 'Alpine Hostel Interlaken', location: 'Interlaken', type: 'Hostel', nights: 7 },
    ],
    routes: [
      { name: 'Matterhorn Glacier Trail', distance: '15 km', difficulty: 'Moderate', time: '6 hours' },
      { name: 'Jungfrau Loop', distance: '12 km', difficulty: 'Challenging', time: '7 hours' },
      { name: 'Lauterbrunnen Valley Walk', distance: '8 km', difficulty: 'Easy', time: '3 hours' },
    ],
    activities: [
      { name: 'Mountain Hiking', days: '10 days' },
      { name: 'Glacier Trekking', days: '2 days' },
      { name: 'Cable Car Tours', days: '2 days' },
    ],
    restaurants: [
      { name: 'Chez Vrony', location: 'Zermatt', cuisine: 'Swiss Alpine', highlight: 'Best fondue!' },
      { name: 'Restaurant Taverne', location: 'Interlaken', cuisine: 'Traditional Swiss', highlight: 'Amazing rösti' },
      { name: 'Bergrestaurant Allmend', location: 'Jungfraujoch', cuisine: 'Mountain Café', highlight: 'Highest café in Europe' },
    ],
  },
  '2': {
    userName: 'Alex Rivera',
    userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    title: 'Best surf trip ever in Bali',
    location: 'Bali, Indonesia',
    duration: '10 days',
    images: [
      'https://images.unsplash.com/photo-1502680390469-be75c86b636f?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?w=800&h=800&fit=crop',
    ],
    description: 'Caught some incredible waves at Uluwatu and explored the vibrant surf culture of Bali.',
    accommodations: [
      { name: 'Surf Camp Canggu', location: 'Canggu', type: 'Surf Camp', nights: 5 },
      { name: 'Beachside Villa Uluwatu', location: 'Uluwatu', type: 'Villa', nights: 5 },
    ],
    routes: [
      { name: 'Coastal Drive Canggu-Uluwatu', distance: '45 km', difficulty: 'Easy', time: '1.5 hours' },
    ],
    activities: [
      { name: 'Surfing', days: '8 days' },
      { name: 'Beach Exploration', days: '2 days' },
    ],
    restaurants: [
      { name: 'Warung Dandelion', location: 'Canggu', cuisine: 'Indonesian', highlight: 'Fresh seafood' },
      { name: 'Single Fin', location: 'Uluwatu', cuisine: 'International', highlight: 'Sunset views' },
      { name: 'La Brisa', location: 'Canggu', cuisine: 'Beach Club', highlight: 'Perfect vibes' },
    ],
  },
  '3': {
    userName: 'Emma Wilson',
    userAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
    title: 'Cycling through the Amalfi Coast',
    location: 'Amalfi Coast, Italy',
    duration: '12 days',
    images: [
      'https://images.unsplash.com/photo-1534113414509-0bd4d016608c?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1523906630133-f6934a1ab2b9?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1523428818904-07c084a9a6e0?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1498307833015-e7b400441eb8?w=800&h=800&fit=crop',
    ],
    description: 'A dream come true cycling adventure. Every turn had a postcard view!',
    accommodations: [
      { name: 'Hotel Positano', location: 'Positano', type: 'Hotel', nights: 4 },
      { name: 'Villa Ravello', location: 'Ravello', type: 'Villa', nights: 4 },
      { name: 'B&B Amalfi Centro', location: 'Amalfi', type: 'B&B', nights: 4 },
    ],
    routes: [
      { name: 'Positano to Praiano', distance: '18 km', difficulty: 'Moderate', time: '2.5 hours' },
      { name: 'Ravello to Amalfi', distance: '12 km', difficulty: 'Moderate', time: '2 hours' },
      { name: 'Coastal Loop Full Route', distance: '65 km', difficulty: 'Challenging', time: '8 hours' },
    ],
    activities: [
      { name: 'Road Cycling', days: '10 days' },
      { name: 'Beach Swimming', days: '2 days' },
    ],
    restaurants: [
      { name: 'La Sponda', location: 'Positano', cuisine: 'Italian Fine Dining', highlight: 'Michelin-starred' },
      { name: 'Ristorante Pizzeria Vittoria', location: 'Ravello', cuisine: 'Pizza & Pasta', highlight: 'Terrace views' },
      { name: 'Da Adolfo', location: 'Positano Beach', cuisine: 'Seafood', highlight: 'Beach dining' },
    ],
  },
  '4': {
    userName: 'Mike Johnson',
    userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
    title: 'Kayaking through Norwegian fjords',
    location: 'Sognefjord, Norway',
    duration: '8 days',
    images: [
      'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=800&fit=crop',
    ],
    description: 'Pure magic and tranquility paddling through the majestic Norwegian fjords.',
    accommodations: [
      { name: 'Fjord View Lodge', location: 'Flåm', type: 'Lodge', nights: 4 },
      { name: 'Mountain Cabin', location: 'Gudvangen', type: 'Cabin', nights: 4 },
    ],
    routes: [
      { name: 'Nærøyfjord Paddle', distance: '25 km', difficulty: 'Moderate', time: '6 hours' },
      { name: 'Sognefjord Main Route', distance: '35 km', difficulty: 'Challenging', time: '8 hours' },
    ],
    activities: [
      { name: 'Sea Kayaking', days: '6 days' },
      { name: 'Fjord Hiking', days: '2 days' },
    ],
    restaurants: [
      { name: 'Ægir Brewery & Pub', location: 'Flåm', cuisine: 'Norwegian', highlight: 'Viking-style hall' },
      { name: 'Fretheim Hotel Restaurant', location: 'Flåm', cuisine: 'Fine Dining', highlight: 'Local ingredients' },
    ],
  },
};

export function TripDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<'stays' | 'routes' | 'activities' | 'dining'>('stays');

  const trip = id ? TRIP_DATA[id] : null;

  if (!trip) {
    return (
      <div className="min-h-screen bg-white max-w-[390px] mx-auto flex items-center justify-center">
        <p style={{ fontFamily: 'Archivo, sans-serif' }}>Trip not found</p>
      </div>
    );
  }

  const sliderSettings = {
    dots: true,
    infinite: false,
    speed: 300,
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: false,
    dotsClass: 'slick-dots custom-dots',
  };

  return (
    <div className="min-h-screen bg-white max-w-[390px] mx-auto pb-20">
      {/* Header Image Carousel */}
      <div className="relative">
        <Slider {...sliderSettings}>
          {trip.images.map((image: string, index: number) => (
            <div key={index}>
              <img
                src={image}
                alt={`${trip.title} - ${index + 1}`}
                className="w-full h-80 object-cover"
              />
            </div>
          ))}
        </Slider>
        <button
          onClick={() => navigate('/app')}
          className="absolute top-8 left-6 bg-white p-2 shadow-md"
        >
          <ArrowLeft size={24} />
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-8">
        {/* Info Card */}
        <div className="bg-[#dadccb] p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Archivo, sans-serif' }}>
            {trip.title}
          </h1>
          
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex gap-2">
              <span className="text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
                Location:
              </span>
              <span className="font-semibold" style={{ fontFamily: 'Archivo, sans-serif' }}>
                {trip.location}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
                Duration:
              </span>
              <span className="font-semibold" style={{ fontFamily: 'Archivo, sans-serif' }}>
                {trip.duration}
              </span>
            </div>
          </div>
        </div>

        {/* Posted by */}
        <div className="bg-[#dadccb] p-4 flex gap-4 mb-6">
          <div className="w-12 h-12 bg-[#212121]">
            <img
              src={trip.userAvatar}
              alt={trip.userName}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <p className="font-semibold text-sm" style={{ fontFamily: 'Archivo, sans-serif' }}>
              {trip.userName}
            </p>
            <p className="text-xs text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
              Posted 2 days ago
            </p>
          </div>
          <Button variant="ghost" className="py-2 px-4 text-sm">
            Follow
          </Button>
        </div>

        {/* Description */}
        <div>
          <h2 className="font-bold mb-2" style={{ fontFamily: 'Archivo, sans-serif' }}>
            About This Trip
          </h2>
          <p className="text-sm text-[#212121] leading-relaxed" style={{ fontFamily: 'Archivo, sans-serif' }}>
            {trip.description}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-6">
          <button
            className={`py-2 px-4 text-sm ${
              activeTab === 'stays' ? 'bg-[#212121] text-white' : 'bg-[#dadccb] text-[#212121]'
            }`}
            onClick={() => setActiveTab('stays')}
          >
            <Hotel size={16} className="mr-1" />
            Stays
          </button>
          <button
            className={`py-2 px-4 text-sm ${
              activeTab === 'routes' ? 'bg-[#212121] text-white' : 'bg-[#dadccb] text-[#212121]'
            }`}
            onClick={() => setActiveTab('routes')}
          >
            <Route size={16} className="mr-1" />
            Routes
          </button>
          <button
            className={`py-2 px-4 text-sm ${
              activeTab === 'activities' ? 'bg-[#212121] text-white' : 'bg-[#dadccb] text-[#212121]'
            }`}
            onClick={() => setActiveTab('activities')}
          >
            <Activity size={16} className="mr-1" />
            Activities
          </button>
          <button
            className={`py-2 px-4 text-sm ${
              activeTab === 'dining' ? 'bg-[#212121] text-white' : 'bg-[#dadccb] text-[#212121]'
            }`}
            onClick={() => setActiveTab('dining')}
          >
            <Utensils size={16} className="mr-1" />
            Dining
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-4">
          {activeTab === 'stays' && (
            <div>
              <h3 className="font-bold mb-2" style={{ fontFamily: 'Archivo, sans-serif' }}>
                Accommodations
              </h3>
              {trip.accommodations.map((accommodation: any, index: number) => (
                <div key={index} className="bg-[#dadccb] p-4 mb-2">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-[#212121]">
                      <Hotel size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ fontFamily: 'Archivo, sans-serif' }}>
                        {accommodation.name}
                      </p>
                      <p className="text-xs text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
                        {accommodation.location}, {accommodation.type} - {accommodation.nights} nights
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'routes' && (
            <div>
              <h3 className="font-bold mb-2" style={{ fontFamily: 'Archivo, sans-serif' }}>
                Routes
              </h3>
              {trip.routes.map((route: any, index: number) => (
                <div key={index} className="bg-[#dadccb] p-4 mb-2">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-[#212121]">
                      <Route size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ fontFamily: 'Archivo, sans-serif' }}>
                        {route.name}
                      </p>
                      <p className="text-xs text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
                        {route.distance}, {route.difficulty} - {route.time}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'activities' && (
            <div>
              <h3 className="font-bold mb-2" style={{ fontFamily: 'Archivo, sans-serif' }}>
                Activities
              </h3>
              {trip.activities.map((activity: any, index: number) => (
                <div key={index} className="bg-[#dadccb] p-4 mb-2">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-[#212121]">
                      <Activity size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ fontFamily: 'Archivo, sans-serif' }}>
                        {activity.name}
                      </p>
                      <p className="text-xs text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
                        {activity.days}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'dining' && (
            <div>
              <h3 className="font-bold mb-2" style={{ fontFamily: 'Archivo, sans-serif' }}>
                Dining
              </h3>
              {trip.restaurants.map((restaurant: any, index: number) => (
                <div key={index} className="bg-[#dadccb] p-4 mb-2">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-[#212121]">
                      <Utensils size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ fontFamily: 'Archivo, sans-serif' }}>
                        {restaurant.name}
                      </p>
                      <p className="text-xs text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
                        {restaurant.location}, {restaurant.cuisine} - {restaurant.highlight}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}