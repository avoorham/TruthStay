import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { ArrowLeft } from 'lucide-react';

export function SignUpDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';
  
  const [formData, setFormData] = useState({
    name: '',
    password: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/setup/profile');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-[390px] mx-auto">
      <div className="px-8 pt-16 pb-8 flex items-center gap-4">
        <button 
          onClick={() => navigate('/signup')}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft size={24} color="#000000" />
        </button>
        <Logo variant="full" size="md" />
      </div>

      <div className="flex-1 px-8 py-8">
        <h1 className="text-2xl font-bold mb-8" style={{ fontFamily: 'Archivo, sans-serif' }}>
          Complete Your Profile
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Input
            label="Name"
            type="text"
            placeholder="Enter your name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          
          <Input
            label="Password"
            type="password"
            placeholder="Create a password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />

          <Input
            label="Email"
            type="email"
            placeholder="Email"
            value={email}
            disabled
          />

          <Button type="submit" fullWidth className="mt-4">
            Create Account
          </Button>
        </form>
      </div>
    </div>
  );
}