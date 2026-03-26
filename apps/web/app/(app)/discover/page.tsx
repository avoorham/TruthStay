import { Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "../../../components/Button";

export default function DiscoverPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="px-6 pt-16 pb-6 border-b border-[#dadccb]">
        <h1 className="text-2xl font-bold">Discover</h1>
        <p className="text-sm text-[#717182] mt-1">AI-generated adventures built from real reviews</p>
      </div>
      <div className="flex flex-col items-center justify-center py-16 px-8 gap-6 text-center">
        <Sparkles size={48} strokeWidth={1} className="text-[#717182]" />
        <div>
          <h2 className="text-lg font-bold mb-2">Your next adventure awaits</h2>
          <p className="text-sm text-[#717182]">
            Tell us where you want to go and what you love doing — our AI will build a personalised itinerary using honest reviews from the community.
          </p>
        </div>
        <Link href="/discover/generate" className="w-full">
          <Button fullWidth>Generate Adventure</Button>
        </Link>
      </div>
    </div>
  );
}
