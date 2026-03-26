import { useNavigate } from 'react-router';

interface TripCardProps {
  id: string;
  image: string;
  title: string;
  location: string;
  activity: string;
  duration: string;
  budget: string;
}

export function TripCard({ id, image, title, location, activity, duration, budget }: TripCardProps) {
  const navigate = useNavigate();

  return (
    <div 
      onClick={() => navigate(`/trip/${id}`)}
      className="bg-[#dadccb] flex gap-4 p-3 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="w-24 h-24 flex-shrink-0">
        <img src={image} alt={title} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 flex flex-col justify-center gap-1">
        <h3 className="font-bold text-sm" style={{ fontFamily: 'Archivo, sans-serif' }}>
          {title}
        </h3>
        <p className="text-xs text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
          {location}
        </p>
        <p className="text-xs text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
          {activity} · {duration} · {budget}
        </p>
      </div>
    </div>
  );
}
