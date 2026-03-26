import dynamic from "next/dynamic";
import { Search } from "lucide-react";

const ExploreMap = dynamic(
  () => import("../../../components/ExploreMap").then((m) => m.ExploreMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#ececf0] animate-pulse" /> }
);

export default function ExplorePage() {
  return (
    <div className="relative w-full" style={{ height: "calc(100vh - 4rem)" }}>
      {/* Full-screen map */}
      <ExploreMap />

      {/* Floating search bar */}
      <div className="absolute top-4 left-4 right-4 z-10">
        <div className="bg-white flex items-center gap-3 px-4 py-3 shadow-lg">
          <Search size={18} className="text-[#717182] flex-shrink-0" />
          <input
            type="text"
            placeholder="Search routes, stays, restaurants…"
            className="flex-1 text-sm outline-none placeholder:text-[#717182] bg-transparent"
          />
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-20 left-4 z-10 bg-white shadow-lg p-3">
        <p className="text-xs font-semibold mb-2 text-[#212121]">Map key</p>
        <div className="flex flex-col gap-1.5">
          {[
            { colour: "#16a34a", label: "Route / Trailhead" },
            { colour: "#2563eb", label: "Accommodation" },
            { colour: "#dc2626", label: "Food & Drink" },
            { colour: "#7c3aed", label: "Bike Shop" },
          ].map(({ colour, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colour }} />
              <span className="text-xs text-[#717182]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
