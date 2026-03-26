import { useNavigate, useLocation } from 'react-router';
import { Home, Compass, Sparkles, Map, User } from 'lucide-react';

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Feed', path: '/app' },
    { icon: Compass, label: 'Explore', path: '/app/explore' },
    { icon: Sparkles, label: 'Discover', path: '/app/discover' },
    { icon: Map, label: 'My Trips', path: '/app/mytrips' },
    { icon: User, label: 'Profile', path: '/app/profile' },
  ];

  const isActive = (path: string) => {
    if (path === '/app') {
      return location.pathname === '/app';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#dadccb] flex justify-around items-center h-16 max-w-[390px] mx-auto">
      {navItems.map(({ icon: Icon, label, path }) => (
        <button
          key={path}
          onClick={() => navigate(path)}
          className={`flex flex-col items-center justify-center gap-1 ${
            isActive(path) ? 'text-black' : 'text-[#212121]'
          }`}
        >
          <Icon size={20} />
          <span className="text-xs" style={{ fontFamily: 'Archivo, sans-serif' }}>
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}