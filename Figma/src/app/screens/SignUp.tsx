import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

export function SignUp() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/signup/details', { state: { email } });
  };

  const handleSocialSignup = (provider: string) => {
    // In a real app, this would initiate OAuth flow
    console.log(`Sign up with ${provider}`);
    navigate('/setup/profile');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-[390px] mx-auto">
      <div className="px-8 pt-16 pb-8">
        <Logo variant="full" size="md" />
      </div>

      <div className="flex-1 px-8 py-8">
        <h1 className="text-2xl font-bold mb-8" style={{ fontFamily: 'Archivo, sans-serif' }}>
          Create Account
        </h1>

        {/* Social Signup Buttons */}
        <div className="flex flex-col gap-3 mb-8">
          <button
            onClick={() => handleSocialSignup('Google')}
            className="w-full py-3 px-4 border border-[#212121] bg-white text-black flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors"
            style={{ fontFamily: 'Archivo, sans-serif' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z" fill="#4285F4"/>
              <path d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.59A9.996 9.996 0 0010 20z" fill="#34A853"/>
              <path d="M4.405 11.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 000 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59z" fill="#FBBC05"/>
              <path d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0 6.09 0 2.71 2.24 1.064 5.51l3.34 2.59C5.191 5.736 7.396 3.977 10 3.977z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <button
            onClick={() => handleSocialSignup('Facebook')}
            className="w-full py-3 px-4 border border-[#212121] bg-white text-black flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors"
            style={{ fontFamily: 'Archivo, sans-serif' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 10c0-5.523-4.477-10-10-10S0 4.477 0 10c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V10h2.54V7.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V10h2.773l-.443 2.89h-2.33v6.988C16.343 19.128 20 14.991 20 10z" fill="#1877F2"/>
            </svg>
            Continue with Facebook
          </button>

          <button
            onClick={() => handleSocialSignup('Apple')}
            className="w-full py-3 px-4 border border-[#212121] bg-white text-black flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors"
            style={{ fontFamily: 'Archivo, sans-serif' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15.738 10.667c-.024-2.296 1.87-3.403 1.954-3.459-1.065-1.56-2.722-1.774-3.31-1.797-1.41-.143-2.75.83-3.464.83-.714 0-1.817-.81-2.988-.788-1.537.023-2.954.893-3.746 2.27-1.597 2.774-.408 6.88 1.148 9.13.761 1.1 1.668 2.336 2.859 2.292 1.17-.046 1.613-.757 3.028-.757 1.415 0 1.816.757 2.988.733 1.234-.022 2.03-1.115 2.79-2.218.879-1.276 1.24-2.511 1.262-2.575-.027-.012-2.42-.928-2.445-3.68l-.001.019zm-2.264-6.667c.632-.766 1.058-1.83.942-2.89-.91.037-2.012.607-2.666 1.372-.586.68-1.099 1.766-.961 2.808 1.016.079 2.054-.516 2.685-1.29z" fill="black"/>
            </svg>
            Continue with Apple
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-[#dadccb]"></div>
          <span className="text-sm text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
            or continue with email
          </span>
          <div className="flex-1 h-px bg-[#dadccb]"></div>
        </div>

        {/* Email Form */}
        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-6">
          <Input
            label="Email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Button type="submit" fullWidth className="mt-4">
            Continue
          </Button>

          <p className="text-center text-sm text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
            Already have an account?{' '}
            <button 
              type="button"
              onClick={() => navigate('/login')} 
              className="underline text-black font-semibold"
            >
              Log In
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}