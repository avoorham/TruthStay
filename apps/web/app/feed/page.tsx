import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";
import { logout } from "../auth/actions";
import { Logo } from "../../components/Logo";
import { BottomNav } from "../../components/BottomNav";
import { FeedPost } from "../../components/FeedPost";

const FEED_POSTS = [
  {
    id: "1",
    userName: "Sarah Chen",
    userAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
    tripTitle: "Two weeks exploring the Swiss Alps — incredible hiking trails and mountain views!",
    location: "Swiss Alps, Switzerland",
    images: [
      "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1434725039720-aaad6dd32dfe?w=800&h=800&fit=crop",
    ],
    likes: 142,
    comments: [
      { userName: "Mike Johnson", text: "This looks amazing! Which trail was your favourite?" },
      { userName: "Emma Wilson", text: "Adding this to my bucket list 🏔️" },
    ],
  },
  {
    id: "2",
    userName: "Alex Rivera",
    userAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
    tripTitle: "Cycling through the Amalfi Coast was a dream come true. Every turn had a postcard view!",
    location: "Amalfi Coast, Italy",
    images: [
      "https://images.unsplash.com/photo-1534113414509-0bd4d016608c?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1523906630133-f6934a1ab2b9?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=800&h=800&fit=crop",
    ],
    likes: 215,
    comments: [
      { userName: "Sarah Chen", text: "So beautiful! I need to do this route." },
    ],
  },
  {
    id: "3",
    userName: "Emma Wilson",
    userAvatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
    tripTitle: "Kayaking through Norwegian fjords — pure magic and tranquility.",
    location: "Sognefjord, Norway",
    images: [
      "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800&h=800&fit=crop",
      "https://images.unsplash.com/photo-1449034446853-66c86144b0ad?w=800&h=800&fit=crop",
    ],
    likes: 127,
    comments: [],
  },
];

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-white max-w-[390px] mx-auto pb-16">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#dadccb] sticky top-0 bg-white z-10 flex items-center justify-between">
        <Logo variant="full" size="md" />
        <form action={logout}>
          <button type="submit" className="text-xs text-[#717182] border border-[#dadccb] px-3 py-1.5">
            Sign out
          </button>
        </form>
      </div>

      <div className="flex flex-col">
        {FEED_POSTS.map((post) => (
          <FeedPost key={post.id} {...post} />
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
