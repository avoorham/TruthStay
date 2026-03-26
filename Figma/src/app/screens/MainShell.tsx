import { Outlet } from 'react-router';
import { BottomNav } from '../components/BottomNav';

export function MainShell() {
  return (
    <div className="min-h-screen bg-white max-w-[390px] mx-auto pb-16">
      <Outlet />
      <BottomNav />
    </div>
  );
}
