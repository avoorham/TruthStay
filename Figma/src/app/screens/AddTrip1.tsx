import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

export function AddTrip1() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    location: '',
    startDate: '',
    endDate: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/trip/add/step2');
  };

  return (
    <div className="min-h-screen bg-white max-w-[390px] mx-auto">
      <div className="px-6 pt-16 pb-6 border-b border-[#dadccb] flex items-center gap-4">
        <button onClick={() => navigate('/app')} className="text-black">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold" style={{ fontFamily: 'Archivo, sans-serif' }}>
          Add Trip
        </h1>
      </div>

      <div className="px-6 py-8">
        <p className="text-sm text-[#212121] mb-6" style={{ fontFamily: 'Archivo, sans-serif' }}>
          Step 1 of 2
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Input
            label="Trip Title"
            type="text"
            placeholder="e.g., Swiss Alps Adventure"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
          
          <Input
            label="Location"
            type="text"
            placeholder="e.g., Switzerland"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            required
          />
          
          <Input
            label="Start Date"
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            required
          />
          
          <Input
            label="End Date"
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            required
          />

          <Button type="submit" fullWidth className="mt-4">
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
