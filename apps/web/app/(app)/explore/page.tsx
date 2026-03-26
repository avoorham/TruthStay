import { Compass } from "lucide-react";

export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="px-6 pt-16 pb-6 border-b border-[#dadccb]">
        <h1 className="text-2xl font-bold">Explore</h1>
        <p className="text-sm text-[#717182] mt-1">Discover routes and places near you</p>
      </div>
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-[#717182]">
        <Compass size={48} strokeWidth={1} />
        <p className="text-sm">Map view coming soon</p>
      </div>
    </div>
  );
}
