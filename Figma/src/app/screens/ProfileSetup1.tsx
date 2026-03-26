import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Camera } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

export function ProfileSetup1() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: 'Alex Johnson',
    bio: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/setup/activities');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-[390px] mx-auto">
      <div className="px-8 pt-16 pb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Archivo, sans-serif' }}>
          Set Up Your Profile
        </h1>
        <p className="text-sm text-[#212121] mt-2" style={{ fontFamily: 'Archivo, sans-serif' }}>
          Step 1 of 2
        </p>
      </div>

      <div className="flex-1 px-8 py-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          {/* Business card layout: photo left, text right */}
          <div className="bg-[#dadccb] p-4 flex gap-4">
            <div className="w-24 h-24 flex-shrink-0 bg-[#212121] flex items-center justify-center">
              <Camera size={32} className="text-white" />
            </div>
            <div className="flex-1 flex flex-col justify-center gap-2">
              <p className="text-xs text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
                Upload Photo
              </p>
              <button 
                type="button"
                className="text-xs text-left underline font-semibold" 
                style={{ fontFamily: 'Archivo, sans-serif' }}
              >
                Choose File
              </button>
            </div>
          </div>

          <Input
            label="Name"
            type="text"
            placeholder="Your name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <div>
            <label className="block mb-2 text-sm" style={{ fontFamily: 'Archivo, sans-serif' }}>
              Bio (Optional)
            </label>
            <textarea
              className="w-full px-4 py-3 border border-[#212121] focus:outline-none focus:border-black resize-none"
              style={{ fontFamily: 'Archivo, sans-serif' }}
              rows={4}
              placeholder="Tell us about yourself..."
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            />
          </div>

          <Button type="submit" fullWidth className="mt-auto">
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
