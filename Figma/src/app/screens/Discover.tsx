import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Send, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface TripSuggestion {
  id: string;
  title: string;
  location: string;
  duration: string;
  activities: string[];
  highlights: string[];
  image: string;
  reasoning: string;
}

export function Discover() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your TruthStay AI travel assistant. I'll help you discover your next perfect vacation based on your preferences and past trips. What kind of experience are you looking for?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<TripSuggestion[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const generateAIResponse = (userMessage: string): { message: string; suggestions?: TripSuggestion[] } => {
    const lowerMessage = userMessage.toLowerCase();

    // Check for different types of queries
    if (lowerMessage.includes('beach') || lowerMessage.includes('ocean') || lowerMessage.includes('surf')) {
      return {
        message: "Based on your interest in beaches and your past 5-star ratings for coastal destinations, I've found some perfect matches for you. These trips combine the best elements from your favorite vacations.",
        suggestions: [
          {
            id: 'suggest-1',
            title: 'Bali Beach & Culture',
            location: 'Bali, Indonesia',
            duration: '10 days',
            activities: ['Surfing', 'Temple visits', 'Beach relaxation'],
            highlights: [
              'Uluwatu Beach - Based on your love of pristine beaches',
              'Seminyak Surf Lessons - Similar to your rated surf experience',
              'Tanah Lot Temple - Cultural element you enjoyed in Thailand',
            ],
            image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&h=300&fit=crop',
            reasoning: 'Combines your top-rated beach destinations with cultural experiences',
          },
          {
            id: 'suggest-2',
            title: 'Amalfi Coast Escape',
            location: 'Italy',
            duration: '8 days',
            activities: ['Coastal drives', 'Fine dining', 'Beach clubs'],
            highlights: [
              'Positano Beach Club - Matches your preference for upscale beach experiences',
              'Coastal road trips - Based on your 5-star road trip ratings',
              'Fresh seafood dining - Similar to your favorite Greek island meals',
            ],
            image: 'https://images.unsplash.com/photo-1534113414509-0bd4d016608c?w=400&h=300&fit=crop',
            reasoning: 'Perfect blend of luxury and natural beauty from your preferences',
          },
        ],
      };
    }

    if (lowerMessage.includes('mountain') || lowerMessage.includes('hiking') || lowerMessage.includes('adventure')) {
      return {
        message: "I see you're drawn to mountain adventures! Based on your highest-rated hiking experiences and activity preferences, here are some trips tailored for you.",
        suggestions: [
          {
            id: 'suggest-3',
            title: 'Swiss Alps Trekking',
            location: 'Switzerland',
            duration: '12 days',
            activities: ['Alpine hiking', 'Mountain photography', 'Local cuisine'],
            highlights: [
              'Jungfrau region trails - Matches your 5-star mountain hikes',
              'Swiss chalets - Based on your love of authentic accommodations',
              'Cheese & chocolate experiences - Similar to your rated food tours',
            ],
            image: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=400&h=300&fit=crop',
            reasoning: 'Built on your passion for challenging hikes and authentic experiences',
          },
          {
            id: 'suggest-4',
            title: 'Patagonia Explorer',
            location: 'Argentina & Chile',
            duration: '14 days',
            activities: ['Trekking', 'Wildlife watching', 'Camping'],
            highlights: [
              'Torres del Paine Circuit - Your ideal difficulty level',
              'Glacier hiking - New adventure similar to your rated experiences',
              'Remote camping - Matches your preference for off-grid stays',
            ],
            image: 'https://images.unsplash.com/photo-1434725039720-aaad6dd32dfe?w=400&h=300&fit=crop',
            reasoning: 'Combines rugged adventure with stunning landscapes you love',
          },
        ],
      };
    }

    if (lowerMessage.includes('city') || lowerMessage.includes('urban') || lowerMessage.includes('culture')) {
      return {
        message: "Urban explorer detected! I've curated city experiences based on your top-rated cultural activities and dining preferences.",
        suggestions: [
          {
            id: 'suggest-5',
            title: 'Tokyo Modern & Traditional',
            location: 'Tokyo, Japan',
            duration: '9 days',
            activities: ['City exploration', 'Food tours', 'Temple visits'],
            highlights: [
              'Shibuya & Shinjuku - Based on your love of vibrant neighborhoods',
              'Izakaya food tours - Matches your 5-star street food experiences',
              'Traditional temples - Similar to your rated cultural sites',
            ],
            image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=300&fit=crop',
            reasoning: 'Perfect mix of modern and traditional based on your ratings',
          },
        ],
      };
    }

    // Default response for general queries
    return {
      message: "I'd love to help you find the perfect trip! Tell me more about what you're interested in:\n\n• Beach relaxation or adventure activities?\n• Mountains or cities?\n• How many days do you have?\n• Are you traveling solo, with a partner, or with friends?\n\nOr just describe your ideal vacation and I'll find matches based on your past ratings!",
    };
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI thinking delay
    setTimeout(() => {
      const response = generateAIResponse(inputValue);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);

      if (response.suggestions) {
        setSuggestions(response.suggestions);
      }
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-white max-w-[390px] mx-auto flex flex-col pb-16">
      {/* Header */}
      <div className="px-6 pt-16 pb-4 border-b border-[#dadccb] flex items-center gap-4 bg-white sticky top-0 z-10">
        <button onClick={() => navigate('/app')} className="text-black">
          <ArrowLeft size={24} />
        </button>
        <div className="flex items-center gap-2">
          <Sparkles size={20} className="text-black" />
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Archivo, sans-serif' }}>
            Discover
          </h1>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[280px] px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-black text-white'
                  : 'bg-[#dadccb] text-black'
              }`}
              style={{ fontFamily: 'Archivo, sans-serif' }}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p
                className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-white/70' : 'text-[#212121]'
                }`}
              >
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-[#dadccb] px-4 py-3">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-[#212121] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-[#212121] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-[#212121] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Trip Suggestions */}
        {suggestions.length > 0 && (
          <div className="pt-4 space-y-4">
            <p className="text-sm font-bold" style={{ fontFamily: 'Archivo, sans-serif' }}>
              Personalized Recommendations
            </p>
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="border border-[#dadccb] bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/app/trip/${suggestion.id}`)}
              >
                <img
                  src={suggestion.image}
                  alt={suggestion.title}
                  className="w-full h-48 object-cover"
                />
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-base mb-1" style={{ fontFamily: 'Archivo, sans-serif' }}>
                        {suggestion.title}
                      </h3>
                      <p className="text-sm text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
                        {suggestion.location} • {suggestion.duration}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {suggestion.activities.map((activity) => (
                      <span
                        key={activity}
                        className="px-3 py-1 bg-[#dadccb] text-xs"
                        style={{ fontFamily: 'Archivo, sans-serif' }}
                      >
                        {activity}
                      </span>
                    ))}
                  </div>

                  <div className="bg-[#dadccb] p-3 mb-3">
                    <p className="text-xs font-bold mb-2" style={{ fontFamily: 'Archivo, sans-serif' }}>
                      Why this matches you:
                    </p>
                    <p className="text-xs italic" style={{ fontFamily: 'Archivo, sans-serif' }}>
                      {suggestion.reasoning}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-bold" style={{ fontFamily: 'Archivo, sans-serif' }}>
                      Top Highlights:
                    </p>
                    {suggestion.highlights.map((highlight, index) => (
                      <p key={index} className="text-xs text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
                        • {highlight}
                      </p>
                    ))}
                  </div>

                  <button
                    className="w-full bg-black text-white py-3 mt-4 font-bold text-sm"
                    style={{ fontFamily: 'Archivo, sans-serif' }}
                  >
                    View Full Itinerary
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-[#dadccb] p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1 border border-[#dadccb] bg-white">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe your ideal vacation..."
              className="w-full px-4 py-3 text-sm resize-none outline-none"
              style={{ fontFamily: 'Archivo, sans-serif' }}
              rows={1}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim()}
            className={`p-3 ${
              inputValue.trim() ? 'bg-black text-white' : 'bg-[#dadccb] text-[#212121]'
            }`}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
