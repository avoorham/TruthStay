import { useState } from 'react';
import { useNavigate } from 'react-router';
import Slider from 'react-slick';
import { Heart, MessageCircle } from 'lucide-react';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

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
  const navigate = useNavigate();
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [postComments, setPostComments] = useState(comments);

  const handleLike = () => {
    if (isLiked) {
      setLikes(likes - 1);
      setIsLiked(false);
    } else {
      setLikes(likes + 1);
      setIsLiked(true);
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      setPostComments([...postComments, { userName: 'You', text: newComment }]);
      setNewComment('');
    }
  };

  const handlePostClick = () => {
    navigate(`/app/trip/${id}`);
  };

  const sliderSettings = {
    dots: true,
    infinite: false,
    speed: 300,
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: false,
    dotsClass: 'slick-dots custom-dots',
  };

  return (
    <div className="bg-white border-b border-[#dadccb] mb-3">
      {/* User Header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full overflow-hidden">
          <img src={userAvatar} alt={userName} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm" style={{ fontFamily: 'Archivo, sans-serif' }}>
            {userName}
          </p>
          <p className="text-xs text-[#212121]" style={{ fontFamily: 'Archivo, sans-serif' }}>
            {location}
          </p>
        </div>
      </div>

      {/* Image Carousel */}
      <div className="relative carousel-container" onClick={handlePostClick}>
        <Slider {...sliderSettings}>
          {images.map((image, index) => (
            <div key={index} className="relative">
              <div className="aspect-square bg-[#dadccb]">
                <img
                  src={image}
                  alt={`${tripTitle} - ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          ))}
        </Slider>
      </div>

      {/* Actions and Info */}
      <div className="px-4 py-3">
        {/* Action Buttons */}
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={handleLike}
            className="hover:opacity-60 transition-opacity"
          >
            <Heart
              size={24}
              fill={isLiked ? '#000000' : 'none'}
              stroke={isLiked ? '#000000' : '#000000'}
              strokeWidth={isLiked ? 2 : 1.5}
            />
          </button>
          <button
            onClick={() => setShowComments(!showComments)}
            className="hover:opacity-60 transition-opacity"
          >
            <MessageCircle size={24} stroke="#000000" strokeWidth={1.5} />
          </button>
        </div>

        {/* Likes Count */}
        <p className="font-bold text-sm mb-2" style={{ fontFamily: 'Archivo, sans-serif' }}>
          {likes} {likes === 1 ? 'like' : 'likes'}
        </p>

        {/* Trip Title - Clickable */}
        <button
          onClick={handlePostClick}
          className="text-left mb-1 hover:opacity-70 transition-opacity w-full"
        >
          <p className="text-sm" style={{ fontFamily: 'Archivo, sans-serif' }}>
            <span className="font-bold">{userName}</span>{' '}
            <span className="text-black">{tripTitle}</span>
          </p>
        </button>

        {/* View Comments */}
        {postComments.length > 0 && !showComments && (
          <button
            onClick={() => setShowComments(true)}
            className="text-sm text-[#212121] mb-2"
            style={{ fontFamily: 'Archivo, sans-serif' }}
          >
            View all {postComments.length} {postComments.length === 1 ? 'comment' : 'comments'}
          </button>
        )}

        {/* Comments Section */}
        {showComments && (
          <div className="mt-2">
            {/* Existing Comments */}
            {postComments.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                {postComments.map((comment, index) => (
                  <p key={index} className="text-sm" style={{ fontFamily: 'Archivo, sans-serif' }}>
                    <span className="font-bold">{comment.userName}</span>{' '}
                    <span className="text-black">{comment.text}</span>
                  </p>
                ))}
              </div>
            )}

            {/* Add Comment Form */}
            <form onSubmit={handleAddComment} className="flex gap-2 pt-2 border-t border-[#dadccb]">
              <input
                type="text"
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 text-sm outline-none"
                style={{ fontFamily: 'Archivo, sans-serif' }}
              />
              {newComment.trim() && (
                <button
                  type="submit"
                  className="text-sm font-bold text-black hover:opacity-70 transition-opacity"
                  style={{ fontFamily: 'Archivo, sans-serif' }}
                >
                  Post
                </button>
              )}
            </form>
          </div>
        )}
      </div>

      <style>{`
        .carousel-container .slick-slider {
          cursor: pointer;
        }
        .custom-dots {
          bottom: 12px;
        }
        .custom-dots li button:before {
          color: white;
          opacity: 0.5;
          font-size: 8px;
        }
        .custom-dots li.slick-active button:before {
          color: white;
          opacity: 1;
        }
      `}</style>
    </div>
  );
}