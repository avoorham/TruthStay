"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";

export interface FeedPostProps {
  id: string;
  userName: string;
  userAvatar: string;
  tripTitle: string;
  location: string;
  images: string[];
  likes: number;
  comments: Array<{ userName: string; text: string }>;
}

export function FeedPost({
  id,
  userName,
  userAvatar,
  tripTitle,
  location,
  images,
  likes: initialLikes,
  comments,
}: FeedPostProps) {
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [postComments, setPostComments] = useState(comments);
  const [newComment, setNewComment] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleLike = () => {
    setIsLiked((prev) => !prev);
    setLikes((prev) => (isLiked ? prev - 1 : prev + 1));
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      setPostComments((prev) => [...prev, { userName: "You", text: newComment }]);
      setNewComment("");
    }
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    setCurrentSlide(Math.round(scrollLeft / clientWidth));
  };

  return (
    <div className="bg-white border-b border-[#dadccb]">
      {/* User header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-[#dadccb]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
        </div>
        <div>
          <p className="font-bold text-sm">{userName}</p>
          <p className="text-xs text-[#717182]">{location}</p>
        </div>
      </div>

      {/* Image carousel */}
      <Link href={`/trip/${id}`} className="block relative">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          {images.map((image, index) => (
            <div key={index} className="flex-none w-full snap-start aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={`${tripTitle} — ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>

        {/* Dot indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === currentSlide ? "bg-white" : "bg-white/50"}`}
              />
            ))}
          </div>
        )}
      </Link>

      {/* Actions */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={handleLike} className="hover:opacity-60 transition-opacity">
            <Heart
              size={24}
              fill={isLiked ? "#000" : "none"}
              stroke="#000"
              strokeWidth={1.5}
            />
          </button>
          <button
            onClick={() => setShowComments((v) => !v)}
            className="hover:opacity-60 transition-opacity"
          >
            <MessageCircle size={24} stroke="#000" strokeWidth={1.5} />
          </button>
        </div>

        <p className="font-bold text-sm mb-1">{likes} {likes === 1 ? "like" : "likes"}</p>

        <Link href={`/trip/${id}`} className="block text-sm mb-1 hover:opacity-70 transition-opacity">
          <span className="font-bold">{userName}</span>{" "}
          <span>{tripTitle}</span>
        </Link>

        {postComments.length > 0 && !showComments && (
          <button
            onClick={() => setShowComments(true)}
            className="text-sm text-[#717182]"
          >
            View all {postComments.length} {postComments.length === 1 ? "comment" : "comments"}
          </button>
        )}

        {showComments && (
          <div className="mt-2">
            <div className="flex flex-col gap-2 mb-3">
              {postComments.map((comment, idx) => (
                <p key={idx} className="text-sm">
                  <span className="font-bold">{comment.userName}</span>{" "}
                  {comment.text}
                </p>
              ))}
            </div>
            <form onSubmit={handleAddComment} className="flex gap-2 pt-2 border-t border-[#dadccb]">
              <input
                type="text"
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 text-sm outline-none bg-transparent"
              />
              {newComment.trim() && (
                <button type="submit" className="text-sm font-bold">
                  Post
                </button>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
