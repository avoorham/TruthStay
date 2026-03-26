import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { ActivityChip } from '../components/ActivityChip';

const ACTIVITIES = [
  'Hiking',
  'Climbing',
  'Cycling',
  'Kayaking',
  'Surfing',
  'Winter Sports',
  'Scuba Diving',
  'Canyoneering',
];

export function ProfileSetup2() {
  const navigate = useNavigate();
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);

  const toggleActivity = (activity: string) => {
    setSelectedActivities(prev =>
      prev.includes(activity)
        ? prev.filter(a => a !== activity)
        : [...prev, activity]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/app');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-[390px] mx-auto">
      <div className="px-8 pt-16 pb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Archivo, sans-serif' }}>
          Your Activities
        </h1>
        <p className="text-sm text-[#212121] mt-2" style={{ fontFamily: 'Archivo, sans-serif' }}>
          Step 2 of 2 · Select all that apply
        </p>
      </div>

      <div className="flex-1 px-8 py-8">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex flex-wrap gap-3 mb-8">
            {ACTIVITIES.map(activity => (
              <ActivityChip
                key={activity}
                label={activity}
                selected={selectedActivities.includes(activity)}
                onClick={() => toggleActivity(activity)}
              />
            ))}
          </div>

          <Button type="submit" fullWidth className="mt-auto">
            Complete Setup
          </Button>
        </form>
      </div>
    </div>
  );
}
