import { createClient } from "../../../lib/supabase/server";
import { Settings, Users } from "lucide-react";
import { ActivityChip } from "../../../components/ActivityChip";

const TRIPS = [
  { id: "1", image: "https://images.unsplash.com/photo-1673505413397-0cd0dc4f5854?w=400&h=300&fit=crop", title: "Swiss Alps" },
  { id: "2", image: "https://images.unsplash.com/photo-1566382161144-66fe8f840f34?w=400&h=300&fit=crop", title: "Italian Coast" },
];

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-white">
      <div className="px-6 pt-16 pb-6 flex justify-between items-start">
        <h1 className="text-2xl font-bold">Profile</h1>
        <div className="flex gap-3">
          <button className="text-black"><Users size={24} /></button>
          <button className="text-black"><Settings size={24} /></button>
        </div>
      </div>

      {/* Business card */}
      <div className="mx-6 mb-6 bg-[#dadccb] p-4 flex gap-4">
        <div className="w-24 h-24 bg-[#212121] flex-shrink-0" />
        <div className="flex-1 flex flex-col justify-center gap-2">
          <h2 className="font-bold">{user?.user_metadata?.display_name || user?.email?.split("@")[0]}</h2>
          <p className="text-xs text-[#717182]">Adventure seeker · {TRIPS.length} trips</p>
        </div>
      </div>

      {/* Activities */}
      <div className="px-6 mb-6">
        <h3 className="text-sm font-semibold mb-3">Activities</h3>
        <div className="flex flex-wrap gap-2">
          <ActivityChip label="Hiking" selected />
          <ActivityChip label="Cycling" selected />
          <ActivityChip label="Climbing" selected />
        </div>
      </div>

      {/* Trips grid */}
      <div className="border-t border-[#dadccb] px-6 pt-6">
        <div className="grid grid-cols-2 gap-4">
          {TRIPS.map((trip) => (
            <div key={trip.id} className="bg-[#dadccb] overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={trip.image} alt={trip.title} className="w-full h-32 object-cover" />
              <div className="p-3">
                <p className="font-semibold text-sm">{trip.title}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
