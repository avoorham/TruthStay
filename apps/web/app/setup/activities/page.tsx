"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActivityChip } from "../../../components/ActivityChip";
import { Button } from "../../../components/Button";

const ACTIVITIES = [
  "Hiking", "Climbing", "Cycling", "Kayaking",
  "Surfing", "Winter Sports", "Scuba Diving", "Canyoneering",
];

export default function ActivitiesSetupPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (a: string) =>
    setSelected((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);

  return (
    <div className="min-h-screen bg-white flex flex-col max-w-[390px] mx-auto">
      <div className="px-8 pt-16 pb-8">
        <h1 className="text-2xl font-bold">Your Activities</h1>
        <p className="text-sm text-[#717182] mt-2">Step 2 of 2 · Select all that apply</p>
      </div>

      <div className="flex-1 px-8 py-8 flex flex-col">
        <div className="flex flex-wrap gap-3 mb-8">
          {ACTIVITIES.map((a) => (
            <ActivityChip key={a} label={a} selected={selected.includes(a)} onClick={() => toggle(a)} />
          ))}
        </div>
        <Button fullWidth onClick={() => router.push("/feed")} className="mt-auto">
          Complete Setup
        </Button>
      </div>
    </div>
  );
}
