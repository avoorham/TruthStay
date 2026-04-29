"use client";
import { useState } from "react";
import {
  Instagram, Twitter, ToggleLeft, ToggleRight,
  Heart, MessageCircle, Share2, ExternalLink, Settings,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";

// ─── Static social data ───────────────────────────────────────────────────────

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Calendar posts: [dayIndex, slot, platform, caption]
const CALENDAR_POSTS = [
  { day: 0, slot: "10:00", platform: "instagram", caption: "Top 5 hidden gems in Lisbon 🇵🇹", id: "p1" },
  { day: 1, slot: "18:30", platform: "tiktok",    caption: "Watch: planning a trip from scratch in 60 seconds", id: "p2" },
  { day: 2, slot: "12:00", platform: "twitter",   caption: "The 'best hotel' lists are lying to you. Here's why TruthStay is different.", id: "p3" },
  { day: 3, slot: "09:00", platform: "instagram", caption: "User review of the week — Barcelona 🏖️", id: "p4" },
  { day: 4, slot: "17:00", platform: "tiktok",    caption: "POV: Your friends already booked the trip without you", id: "p5" },
  { day: 5, slot: "11:00", platform: "instagram", caption: "Weekend inspo: Amalfi Coast hidden spots from our community", id: "p6" },
  { day: 6, slot: "14:00", platform: "twitter",   caption: "Referral feature is live — invite friends and both get a discount 🎉", id: "p7" },
];

const PLATFORM_COLOR: Record<string, string> = {
  instagram: "bg-lavender text-purple-700",
  tiktok:    "bg-pink-100 text-pink-700",
  twitter:   "bg-blue-light text-blue",
};

const PUBLISHED_POSTS = [
  { id: "pp1", platform: "instagram", caption: "How we vetted 1,000+ hotels for our app launch",     date: "2d ago", likes: 847, comments: 63, shares: 124, clicks: 312 },
  { id: "pp2", platform: "tiktok",    caption: "Never trust a 5-star rating again (here's what to do)", date: "3d ago", likes: 3421, comments: 218, shares: 891, clicks: 1204 },
  { id: "pp3", platform: "twitter",   caption: "Truthful reviews beat sponsored content every time",   date: "4d ago", likes: 194,  comments: 28,  shares: 47,  clicks: 183 },
  { id: "pp4", platform: "instagram", caption: "Community spotlight: @mariastravels in Kyoto",        date: "5d ago", likes: 1102, comments: 87,  shares: 203, clicks: 441 },
  { id: "pp5", platform: "tiktok",    caption: "Trip planning with TruthStay — full walkthrough",     date: "6d ago", likes: 2184, comments: 156, shares: 542, clicks: 873 },
  { id: "pp6", platform: "twitter",   caption: "New: Trip Invitation feature lets your squad plan together", date: "1w ago", likes: 312, comments: 44, shares: 89, clicks: 267 },
];

const PLATFORM_STATS = [
  { platform: "Instagram", followers: "12.4K", posts: 48, eng_rate: "4.8%", growth: "+2.1K this month" },
  { platform: "TikTok",    followers: "8.7K",  posts: 31, eng_rate: "9.2%", growth: "+3.4K this month" },
  { platform: "X / Twitter", followers: "4.2K", posts: 62, eng_rate: "1.9%", growth: "+380 this month" },
];

// Optimal posting times heatmap (hour 6–22, days Mon–Sun)
const HEATMAP_HOURS = [8, 10, 12, 14, 16, 18, 20, 22];
const HEATMAP_DATA: Record<string, Record<number, number>> = {
  Mon: { 8: 2, 10: 5, 12: 7, 14: 6, 16: 4, 18: 8, 20: 6, 22: 3 },
  Tue: { 8: 3, 10: 6, 12: 8, 14: 7, 16: 5, 18: 9, 20: 7, 22: 4 },
  Wed: { 8: 2, 10: 5, 12: 9, 14: 8, 16: 6, 18: 7, 20: 5, 22: 2 },
  Thu: { 8: 4, 10: 7, 12: 8, 14: 9, 16: 7, 18: 8, 20: 6, 22: 3 },
  Fri: { 8: 3, 10: 6, 12: 7, 14: 8, 16: 9, 18: 10, 20: 8, 22: 5 },
  Sat: { 8: 5, 10: 8, 12: 9, 14: 7, 16: 6, 18: 7, 20: 9, 22: 6 },
  Sun: { 8: 6, 10: 9, 12: 8, 14: 6, 16: 5, 18: 7, 20: 8, 22: 4 },
};

function heatColor(val: number): string {
  if (val >= 9)  return "bg-teal text-white";
  if (val >= 7)  return "bg-teal/60 text-teal-dark";
  if (val >= 5)  return "bg-teal/30 text-teal-dark";
  if (val >= 3)  return "bg-teal/10 text-grey-500";
  return "bg-grey-50 text-grey-300";
}

type Tab = "calendar" | "published" | "performance" | "settings";

const PLATFORM_ICON_CLASS: Record<string, string> = {
  instagram: "text-purple-600",
  tiktok:    "text-pink-600",
  twitter:   "text-blue",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SocialPage() {
  const [tab, setTab] = useState<Tab>("calendar");
  const [autoPost, setAutoPost] = useState(true);
  const [postsPerWeek, setPostsPerWeek] = useState({ instagram: 5, tiktok: 3, twitter: 7 });

  const TABS: { key: Tab; label: string }[] = [
    { key: "calendar",    label: "Content Calendar" },
    { key: "published",   label: "Published" },
    { key: "performance", label: "Performance" },
    { key: "settings",    label: "Settings" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Social Media" description="AI-generated content calendar, performance, and platform settings." />

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-grey-300">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              tab === key ? "border-blue text-blue" : "border-transparent text-grey-700 hover:text-dark"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Calendar ── */}
      {tab === "calendar" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-grey-100">
            {WEEK_DAYS.map(d => (
              <div key={d} className="px-3 py-2 text-xs font-semibold text-grey-500 text-center border-r border-grey-100 last:border-r-0">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 min-h-[320px]">
            {WEEK_DAYS.map((d, di) => {
              const dayPosts = CALENDAR_POSTS.filter(p => p.day === di);
              return (
                <div key={d} className="border-r border-grey-50 last:border-r-0 p-2 space-y-2 min-h-[240px]">
                  {dayPosts.map(p => (
                    <div key={p.id} className={`rounded-lg px-2 py-1.5 text-[10px] font-medium leading-snug ${PLATFORM_COLOR[p.platform] ?? "bg-grey-100 text-grey-700"}`}>
                      <p className="font-semibold">{p.slot}</p>
                      <p className="mt-0.5 line-clamp-2 opacity-80">{p.caption}</p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 px-4 py-3 border-t border-grey-100">
            {[
              { label: "Instagram", color: "bg-lavender" },
              { label: "TikTok",    color: "bg-pink-100" },
              { label: "X / Twitter", color: "bg-blue-light" },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-sm ${color}`} />
                <span className="text-xs text-grey-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Published ── */}
      {tab === "published" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PUBLISHED_POSTS.map(post => (
            <div key={post.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${PLATFORM_COLOR[post.platform]}`}>
                  {post.platform}
                </span>
                <span className="text-xs text-grey-400">{post.date}</span>
              </div>
              <p className="text-sm text-dark leading-snug line-clamp-3">{post.caption}</p>
              <div className="grid grid-cols-4 gap-2 pt-1 border-t border-grey-50">
                {[
                  { icon: Heart,          val: post.likes.toLocaleString(),    label: "Likes" },
                  { icon: MessageCircle,  val: post.comments.toLocaleString(), label: "Comments" },
                  { icon: Share2,         val: post.shares.toLocaleString(),   label: "Shares" },
                  { icon: ExternalLink,   val: post.clicks.toLocaleString(),   label: "Clicks" },
                ].map(({ icon: Icon, val, label }) => (
                  <div key={label} className="text-center">
                    <Icon size={12} className="mx-auto text-grey-400 mb-0.5" />
                    <p className="text-xs font-semibold text-dark">{val}</p>
                    <p className="text-[9px] text-grey-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Performance ── */}
      {tab === "performance" && (
        <div className="space-y-6">
          {/* Per-platform KPI cards */}
          <div className="grid grid-cols-3 gap-6">
            {PLATFORM_STATS.map(p => (
              <div key={p.platform} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <p className="text-xs font-semibold text-grey-500 uppercase tracking-widest mb-3">{p.platform}</p>
                <p className="text-3xl font-bold text-dark tracking-tight">{p.followers}</p>
                <p className="text-xs text-grey-500 mt-1">{p.growth}</p>
                <div className="flex gap-4 mt-4 pt-4 border-t border-grey-100">
                  <div>
                    <p className="text-xs text-grey-500">Posts</p>
                    <p className="text-sm font-semibold text-dark">{p.posts}</p>
                  </div>
                  <div>
                    <p className="text-xs text-grey-500">Eng. rate</p>
                    <p className="text-sm font-semibold text-dark">{p.eng_rate}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Posting time heatmap */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-grey-500 uppercase tracking-widest mb-5">Optimal posting times — engagement score</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left pr-4 py-1 text-grey-400 font-medium w-12"></th>
                    {HEATMAP_HOURS.map(h => (
                      <th key={h} className="text-center px-1 py-1 text-grey-400 font-medium">{h}:00</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {WEEK_DAYS.map(day => (
                    <tr key={day}>
                      <td className="pr-4 py-1 text-grey-500 font-medium">{day}</td>
                      {HEATMAP_HOURS.map(h => (
                        <td key={h} className="px-1 py-1">
                          <div className={`w-full h-8 rounded flex items-center justify-center text-[10px] font-semibold ${heatColor(HEATMAP_DATA[day]?.[h] ?? 0)}`}>
                            {HEATMAP_DATA[day]?.[h] ?? 0}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings ── */}
      {tab === "settings" && (
        <div className="space-y-4 max-w-2xl">
          {/* Connection status */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-semibold text-dark">Platform Connections</h3>
            {[
              { platform: "Instagram",   connected: true,  handle: "@truthstay" },
              { platform: "TikTok",      connected: true,  handle: "@truthstay_app" },
              { platform: "X / Twitter", connected: false, handle: "" },
            ].map(p => (
              <div key={p.platform} className="flex items-center justify-between py-2 border-b border-grey-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-dark">{p.platform}</p>
                  {p.connected && p.handle && <p className="text-xs text-grey-500">{p.handle}</p>}
                </div>
                {p.connected
                  ? <span className="text-xs font-semibold text-green-dark bg-green-light px-2.5 py-0.5 rounded-full">Connected</span>
                  : <button className="text-xs font-semibold text-blue border border-blue px-3 py-1 rounded-lg hover:bg-blue-light transition">Connect</button>}
              </div>
            ))}
          </div>

          {/* Posts per week targets */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-semibold text-dark">Posts Per Week Targets</h3>
            {(["instagram", "tiktok", "twitter"] as const).map(pl => (
              <div key={pl} className="flex items-center justify-between gap-4">
                <label className="text-sm text-grey-700 capitalize">{pl === "twitter" ? "X / Twitter" : pl}</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPostsPerWeek(p => ({ ...p, [pl]: Math.max(0, p[pl] - 1) }))}
                    className="w-7 h-7 rounded-lg border border-grey-300 flex items-center justify-center text-grey-700 hover:bg-grey-100 transition text-sm font-bold">−</button>
                  <span className="w-8 text-center text-sm font-semibold text-dark">{postsPerWeek[pl]}</span>
                  <button onClick={() => setPostsPerWeek(p => ({ ...p, [pl]: p[pl] + 1 }))}
                    className="w-7 h-7 rounded-lg border border-grey-300 flex items-center justify-center text-grey-700 hover:bg-grey-100 transition text-sm font-bold">+</button>
                </div>
              </div>
            ))}
          </div>

          {/* Brand voice + auto-post */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-semibold text-dark">Brand Voice</h3>
            <textarea
              defaultValue="Friendly, honest, and inspiring. Always community-first. Avoid corporate jargon. Use emojis sparingly. Reference real user experiences."
              rows={4}
              className="w-full border border-grey-300 rounded-xl px-3 py-2 text-sm text-grey-700 focus:outline-none focus:border-blue/60 resize-none"
            />
            <div className="flex items-center justify-between pt-2 border-t border-grey-100">
              <div>
                <p className="text-sm font-medium text-dark">Auto-post enabled</p>
                <p className="text-xs text-grey-500">Agent will post on schedule without manual approval</p>
              </div>
              <button onClick={() => setAutoPost(v => !v)}>
                {autoPost
                  ? <ToggleRight size={24} className="text-teal" />
                  : <ToggleLeft size={24} className="text-grey-300" />}
              </button>
            </div>
            <button className="w-full bg-blue text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-dark transition">
              Save settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
