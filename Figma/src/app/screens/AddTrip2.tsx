import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Upload } from 'lucide-react';
import { Button } from '../components/Button';
import { ActivityChip } from '../components/ActivityChip';

const ACTIVITIES = ['Hiking', 'Climbing', 'Cycling', 'Kayaking', 'Surfing', 'Winter Sports', 'Scuba Diving', 'Canyoneering'];
const BUDGETS = ['$', '$$', '$$$'];

export function AddTrip2() {
  const navigate = useNavigate();
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [budget, setBudget] = useState<string>('');

  const toggleActivity = (activity: string) => {
    setSelectedActivities(prev =>
      prev.includes(activity) ? prev.filter(a => a !== activity) : [...prev, activity]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/app');
  };

  return (
    <div className="min-h-screen bg-white max-w-[390px] mx-auto">
      <div className="px-6 pt-16 pb-6 border-b border-[#dadccb] flex items-center gap-4">
        <button onClick={() => navigate('/trip/add/step1')} className="text-black">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold" style={{ fontFamily: 'Archivo, sans-serif' }}>
          Add Trip
        </h1>
      </div>

      <div className="px-6 py-8">
        <p className="text-sm text-[#212121] mb-6" style={{ fontFamily: 'Archivo, sans-serif' }}>
          Step 2 of 2
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          {/* Activities */}
          <div>
            <label className="block mb-3 font-semibold" style={{ fontFamily: 'Archivo, sans-serif' }}>
              Activities
            </label>
            <div className="flex flex-wrap gap-2">
              {ACTIVITIES.map(activity => (
                <ActivityChip
                  key={activity}
                  label={activity}
                  selected={selectedActivities.includes(activity)}
                  onClick={() => toggleActivity(activity)}
                />
              ))}
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block mb-3 font-semibold" style={{ fontFamily: 'Archivo, sans-serif' }}>
              Budget
            </label>
            <div className="flex gap-3">
              {BUDGETS.map(b => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBudget(b)}
                  className={`px-6 py-2 border ${
                    budget === b
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-black border-[#212121]'
                  }`}
                  style={{ fontFamily: 'Archivo, sans-serif' }}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Photos */}
          <div>
            <label className="block mb-3 font-semibold" style={{ fontFamily: 'Archivo, sans-serif' }}>
              Photos
            </label>
            <div className="border-2 border-dashed border-[#212121] p-8 flex flex-col items-center gap-2">
              <Upload size={32} className="text-[#212121]" />
              <p className="text-sm text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
                Upload photos from your trip
              </p>
            </div>
          </div>

          <Button type="submit" fullWidth>
            Publish Trip
          </Button>
        </form>
      </div>
    </div>
  );
}
