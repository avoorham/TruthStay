const SAVED_TRIPS = [
  {
    id: '1',
    image: 'https://images.unsplash.com/photo-1673505413397-0cd0dc4f5854?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3VudGFpbiUyMGhpa2luZyUyMGFkdmVudHVyZSUyMGxhbmRzY2FwZXxlbnwxfHx8fDE3NzQ1MTc3NjN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    title: 'Swiss Alps',
  },
  {
    id: '2',
    image: 'https://images.unsplash.com/photo-1668370478422-b3516d8194dc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdXJmaW5nJTIwb2NlYW4lMjB3YXZlcyUyMHN1bnNldHxlbnwxfHx8fDE3NzQ1MTc3NjN8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    title: 'Bali Surf',
  },
  {
    id: '3',
    image: 'https://images.unsplash.com/photo-1628371217613-714161455f6b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzY3ViYSUyMGRpdmluZyUyMHVuZGVyd2F0ZXIlMjBjb3JhbCUyMHJlZWZ8ZW58MXx8fHwxNzc0NDg4NTQwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    title: 'Great Barrier Reef',
  },
  {
    id: '4',
    image: 'https://images.unsplash.com/photo-1769197047973-265783a7f1f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxrYXlha2luZyUyMGxha2UlMjBuYXR1cmUlMjBhZHZlbnR1cmV8ZW58MXx8fHwxNzc0NTE3NzY0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    title: 'Norwegian Fjords',
  },
];

export function Saved() {
  return (
    <div className="min-h-screen bg-white">
      <div className="px-6 pt-16 pb-6 border-b border-[#dadccb]">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Archivo, sans-serif' }}>
          Saved Trips
        </h1>
      </div>

      <div className="p-6 grid grid-cols-2 gap-4">
        {SAVED_TRIPS.map(trip => (
          <div key={trip.id} className="bg-[#dadccb] overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
            <img src={trip.image} alt={trip.title} className="w-full h-32 object-cover" />
            <div className="p-3">
              <p className="font-semibold text-sm" style={{ fontFamily: 'Archivo, sans-serif' }}>
                {trip.title}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
