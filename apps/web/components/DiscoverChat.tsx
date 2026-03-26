"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Sparkles, Send } from "lucide-react";
import Link from "next/link";

interface Message {
  role: "ai" | "user";
  text: string;
  time: string;
}

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const INITIAL_MESSAGE: Message = {
  role: "ai",
  text: "Hi! I'm your TruthStay AI travel assistant. I'll help you discover your next perfect vacation based on your preferences and past trips. What kind of experience are you looking for?",
  time: formatTime(),
};

export function DiscoverChat() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text, time: formatTime() }]);
    setLoading(true);

    try {
      // Parse the user's message to extract region, activity type, duration
      // For now we do a best-effort extraction and call the generate endpoint
      const res = await fetch("/api/adventures/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: extractRegion(text),
          activityType: extractActivity(text),
          durationDays: extractDuration(text),
          additionalNotes: text,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      const { adventure } = await res.json();

      const reply = formatAdventureReply(adventure);
      setMessages((prev) => [...prev, { role: "ai", text: reply, time: formatTime() }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Sorry, I couldn't generate an adventure right now. Try describing a specific region and activity — for example: \"7-day cycling trip in Mallorca\".",
          time: formatTime(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-[#dadccb]">
        <Link href="/feed" className="text-[#212121]">
          <ArrowLeft size={22} strokeWidth={1.5} />
        </Link>
        <Sparkles size={20} strokeWidth={1.5} className="text-[#212121]" />
        <h1 className="font-bold text-lg">Discover</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 pb-24">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] px-4 py-3 text-sm ${
                msg.role === "ai"
                  ? "bg-[#e9ebef] text-[#212121]"
                  : "bg-black text-white"
              }`}
            >
              <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              <p className={`text-xs mt-2 ${msg.role === "ai" ? "text-[#717182]" : "text-white/60"}`}>
                {msg.time}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#e9ebef] px-4 py-3 text-sm text-[#717182]">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-[#717182] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-[#717182] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-[#717182] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="fixed bottom-16 left-0 right-0 max-w-[390px] mx-auto border-t border-[#dadccb] bg-white px-4 py-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Describe your ideal vacation..."
          className="flex-1 text-sm outline-none placeholder:text-[#717182] border border-[#dadccb] px-3 py-2.5 bg-white"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="bg-[#e9ebef] px-3 py-2.5 disabled:opacity-40 flex items-center justify-center"
        >
          <Send size={18} className="text-[#212121]" />
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractRegion(text: string): string {
  // Common regions mentioned in travel text
  const regions = [
    "Mallorca", "Dolomites", "Alps", "Pyrenees", "Tuscany", "Provence",
    "Corsica", "Sardinia", "Iceland", "Norway", "Scotland", "Andalusia",
    "Algarve", "Madeira", "Canary Islands", "Crete", "Greece",
  ];
  const found = regions.find((r) => text.toLowerCase().includes(r.toLowerCase()));
  return found ?? "Europe";
}

function extractActivity(text: string): string {
  if (/cycl|bike|bik|road/i.test(text)) return "cycling";
  if (/hik|trek|walk/i.test(text)) return "hiking";
  if (/trail.?run|run/i.test(text)) return "trail_running";
  if (/ski|snow/i.test(text)) return "skiing";
  if (/kayak|paddle|canoe/i.test(text)) return "kayaking";
  if (/climb/i.test(text)) return "climbing";
  return "hiking";
}

function extractDuration(text: string): number {
  const match = text.match(/(\d+)\s*(?:day|night|week)/i);
  if (match) {
    const n = parseInt(match[1]);
    if (/week/i.test(match[0] ?? "")) return Math.min(n * 7, 14);
    return Math.min(Math.max(n, 1), 14);
  }
  return 5;
}

function formatAdventureReply(adventure: any): string {
  const lines = [
    `Here's your adventure: **${adventure.title}**`,
    "",
    adventure.description,
    "",
    `📍 ${adventure.region}  ·  ${adventure.duration_days} days  ·  ${adventure.activity_type.replace("_", " ")}`,
    "",
  ];

  adventure.days?.slice(0, 3).forEach((day: any) => {
    lines.push(`Day ${day.day_number}: ${day.title}`);
    if (day.description) lines.push(day.description);
    lines.push("");
  });

  if (adventure.days?.length > 3) {
    lines.push(`…and ${adventure.days.length - 3} more days. Your adventure has been saved — head to My Trips to view it.`);
  }

  return lines.join("\n").trim();
}
