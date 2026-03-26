"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Sparkles, Send } from "lucide-react";
import Link from "next/link";
import { AdventurePlanCard } from "./AdventurePlanCard";
import type {
  GeneratedAdventure,
  DayAlternativesMap,
} from "../lib/agent/adventure-agent";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TextMessage {
  kind: "text";
  role: "ai" | "user";
  text: string;
  time: string;
}

interface AdventureMessage {
  kind: "adventure";
  adventure: GeneratedAdventure;
  dayAlternatives: DayAlternativesMap;
  adventureId: string | null;
  time: string;
}

type Message = TextMessage | AdventureMessage;

// Conversation history for the API (plain role/content)
interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

function formatTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const INITIAL_MESSAGE: TextMessage = {
  kind: "text",
  role: "ai",
  text: "Hi! I'm your TruthStay adventure planner. I specialise in sport-first holidays — cycling, hiking, trail running, climbing, and more. What activity are you planning for?",
  time: formatTime(),
};

// ─── Component ────────────────────────────────────────────────────────────────

export function DiscoverChat() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [history, setHistory] = useState<ChatTurn[]>([]); // sent to /api/adventures/chat
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

    const userMsg: TextMessage = { kind: "text", role: "user", text, time: formatTime() };
    setMessages((prev) => [...prev, userMsg]);

    // Build updated history for the API
    const updatedHistory: ChatTurn[] = [...history, { role: "user", content: text }];
    setLoading(true);

    try {
      const res = await fetch("/api/adventures/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedHistory }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || err.error || "Something went wrong");
      }

      const data = await res.json();

      if (data.type === "adventure") {
        // Add the adventure card to the chat
        setMessages((prev) => [
          ...prev,
          {
            kind: "adventure",
            adventure: data.adventure,
            dayAlternatives: data.day_alternatives ?? {},
            adventureId: data.adventure_id ?? null,
            time: formatTime(),
          },
        ]);
        // Don't add adventure JSON to history — keep conversation clean
        setHistory(updatedHistory);
      } else {
        // Follow-up question
        const aiText: string = data.text ?? "Could you tell me a bit more?";
        setMessages((prev) => [
          ...prev,
          { kind: "text", role: "ai", text: aiText, time: formatTime() },
        ]);
        setHistory([...updatedHistory, { role: "assistant", content: aiText }]);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          kind: "text",
          role: "ai",
          text: `Sorry, something went wrong.\n\n${detail}`,
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
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-4 pb-24">
        {messages.map((msg, i) => {
          if (msg.kind === "adventure") {
            return (
              <div key={i} className="flex justify-start">
                <div className="w-full max-w-[340px]">
                  <AdventurePlanCard
                    adventure={msg.adventure}
                    dayAlternatives={msg.dayAlternatives}
                    adventureId={msg.adventureId}
                  />
                  <p suppressHydrationWarning className="text-xs mt-2 text-[#717182]">
                    {msg.time}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] px-4 py-3 text-sm ${
                  msg.role === "ai"
                    ? "bg-[#e9ebef] text-[#212121]"
                    : "bg-black text-white"
                }`}
              >
                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                <p
                  suppressHydrationWarning
                  className={`text-xs mt-2 ${msg.role === "ai" ? "text-[#717182]" : "text-white/60"}`}
                >
                  {msg.time}
                </p>
              </div>
            </div>
          );
        })}

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
          placeholder="Type a message…"
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
