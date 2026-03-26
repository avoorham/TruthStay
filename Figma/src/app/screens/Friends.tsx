import { useNavigate } from 'react-router';
import { ArrowLeft, Search } from 'lucide-react';
import { Button } from '../components/Button';

const USERS = [
  { id: '1', name: 'Sarah Chen', trips: 8, following: false },
  { id: '2', name: 'Mike Torres', trips: 15, following: true },
  { id: '3', name: 'Emma Wilson', trips: 6, following: false },
  { id: '4', name: 'James Kim', trips: 12, following: true },
];

export function Friends() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white max-w-[390px] mx-auto">
      <div className="px-6 pt-16 pb-6 border-b border-[#dadccb] flex items-center gap-4">
        <button onClick={() => navigate('/app/profile')} className="text-black">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold" style={{ fontFamily: 'Archivo, sans-serif' }}>
          Friends
        </h1>
      </div>

      {/* Search */}
      <div className="px-6 py-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#212121]" size={20} />
          <input
            type="text"
            placeholder="Search users..."
            className="w-full pl-12 pr-4 py-3 border border-[#212121] focus:outline-none focus:border-black"
            style={{ fontFamily: 'Archivo, sans-serif' }}
          />
        </div>
      </div>

      {/* Users List */}
      <div className="px-6 py-4 flex flex-col gap-3">
        {USERS.map(user => (
          <div key={user.id} className="bg-[#dadccb] p-4 flex gap-4 items-center">
            <div className="w-12 h-12 bg-[#212121] flex-shrink-0"></div>
            <div className="flex-1">
              <p className="font-semibold text-sm" style={{ fontFamily: 'Archivo, sans-serif' }}>
                {user.name}
              </p>
              <p className="text-xs text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
                {user.trips} trips
              </p>
            </div>
            <Button 
              variant={user.following ? 'secondary' : 'primary'} 
              className="py-2 px-4 text-sm"
            >
              {user.following ? 'Following' : 'Follow'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
