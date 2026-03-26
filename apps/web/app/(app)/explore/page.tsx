import { SlidersHorizontal } from "lucide-react";
import { ExploreMapLoader } from "../../../components/ExploreMapLoader";

export default function ExplorePage() {
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 4rem)" }}>
      {/* Header card */}
      <div className="px-4 pt-12 pb-3 bg-white border-b border-[#dadccb]">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#212121]">Adventures in map area</h1>
            <p className="text-xs text-[#717182] mt-0.5">All activities · All durations</p>
          </div>
          <button className="p-2 border border-[#dadccb]">
            <SlidersHorizontal size={18} className="text-[#212121]" />
          </button>
        </div>
      </div>

      {/* Map — takes remaining height */}
      <div className="flex-1 relative">
        <ExploreMapLoader />
      </div>

      {/* Bottom CTA */}
      <div className="bg-white border-t border-[#dadccb] px-4 py-3">
        <button className="w-full bg-black text-white py-3 text-sm font-semibold">
          14 adventures
        </button>
      </div>
    </div>
  );
}
