import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

export function LogIn() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/app');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-[390px] mx-auto">
      <div className="px-8 pt-16 pb-8">
        <Logo variant="full" size="md" />
      </div>

      <div className="flex-1 px-8 py-8">
        <h1 className="text-2xl font-bold mb-8" style={{ fontFamily: 'Archivo, sans-serif' }}>
          Welcome Back
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Input
            label="Email"
            type="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          
          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />

          <button 
            type="button"
            onClick={() => {/* TODO: Navigate to forgot password page */}} 
            className="text-sm text-[#212121] hover:text-black underline text-right -mt-3"
            style={{ fontFamily: 'Archivo, sans-serif' }}
          >
            Forgot password?
          </button>

          <Button type="submit" fullWidth className="mt-4">
            Log In
          </Button>

          <p className="text-center text-sm text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
            Don't have an account?{' '}
            <button 
              type="button"
              onClick={() => navigate('/signup')} 
              className="underline text-black font-semibold"
            >
              Sign Up
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}