import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Settings, Users } from 'lucide-react';
import { ActivityChip } from '../components/ActivityChip';

const MY_TRIPS = [
  {
    id: '1',
    image: 'https://images.unsplash.com/photo-1673505413397-0cd0dc4f5854?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3VudGFpbiUyMGhpa2luZyUyMGFkdmVudHVyZSUyMGxhbmRzY2FwZXxlbnwxfHx8fDE3NzQ1MTc3NjN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    title: 'Swiss Alps',
  },
  {
    id: '2',
    image: 'https://images.unsplash.com/photo-1566382161144-66fe8f840f34?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxldXJvcGVhbiUyMGNpdHklMjB0cmF2ZWwlMjBhcmNoaXRlY3R1cmV8ZW58MXx8fHwxNzc0NDg1OTYwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    title: 'Italian Coast',
  },
];

export function Profile() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'trips' | 'saved'>('trips');

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="px-6 pt-16 pb-6 flex justify-between items-start">
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Archivo, sans-serif' }}>
            Profile
          </h1>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate('/app/friends')} className="text-black">
            <Users size={24} />
          </button>
          <button className="text-black">
            <Settings size={24} />
          </button>
        </div>
      </div>

      {/* Profile Card - Business card layout */}
      <div className="mx-6 mb-6 bg-[#dadccb] p-4 flex gap-4">
        <div className="w-24 h-24 bg-[#212121] flex-shrink-0"></div>
        <div className="flex-1 flex flex-col justify-center gap-2">
          <h2 className="font-bold" style={{ fontFamily: 'Archivo, sans-serif' }}>
            Alex Johnson
          </h2>
          <p className="text-xs text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
            Adventure seeker · 12 trips
          </p>
        </div>
      </div>

      {/* Activities */}
      <div className="px-6 mb-6">
        <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: 'Archivo, sans-serif' }}>
          Activities
        </h3>
        <div className="flex flex-wrap gap-2">
          <ActivityChip label="Hiking" selected />
          <ActivityChip label="Surfing" selected />
          <ActivityChip label="Cycling" selected />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#dadccb]">
        <div className="px-6 flex gap-8">
          <button
            onClick={() => setActiveTab('trips')}
            className={`pb-3 font-semibold ${
              activeTab === 'trips'
                ? 'border-b-2 border-black text-black'
                : 'text-[#212121]'
            }`}
            style={{ fontFamily: 'Archivo, sans-serif' }}
          >
            My Trips
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`pb-3 font-semibold ${
              activeTab === 'saved'
                ? 'border-b-2 border-black text-black'
                : 'text-[#212121]'
            }`}
            style={{ fontFamily: 'Archivo, sans-serif' }}
          >
            Saved
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="p-6 grid grid-cols-2 gap-4">
        {MY_TRIPS.map(trip => (
          <div key={trip.id} className="bg-[#dadccb] overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
            <img src={trip.image} alt={trip.title} className="w-full h-32 object-cover" />
            <div className="p-3">
              <p className="font-semibold text-sm" style={{ fontFamily: 'Archivo, sans-serif' }}>
                {trip.title}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
