import { useNavigate } from 'react-router';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';

export function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-[390px] mx-auto">
      <div 
        className="flex-1 bg-cover bg-center flex items-end justify-center pb-12"
        style={{ 
          backgroundImage: 'url(https://images.unsplash.com/photo-1605271998276-db59cb8455bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjeWNsaW5nJTIwcm9hZCUyMGJpa2UlMjBvdXRkb29yJTIwc3BvcnR8ZW58MXx8fHwxNzc0NTE4MzQwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral)',
          minHeight: '50vh'
        }}
      >
        <div className="bg-white bg-opacity-30 p-8 mx-6">
          <Logo variant="full" size="lg" />
        </div>
      </div>
      
      <div className="px-8 py-12 flex flex-col gap-6">
        <p className="text-center text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
          Share real trips with friends
        </p>
        
        <div className="flex flex-col gap-3">
          <Button onClick={() => navigate('/signup')} fullWidth>
            Get Started
          </Button>
          <Button onClick={() => navigate('/login')} variant="ghost" fullWidth>
            Log In
          </Button>
        </div>
      </div>
    </div>
  );
}