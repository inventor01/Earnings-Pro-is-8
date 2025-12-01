import { useState, useEffect } from 'react';
import { useTheme } from '../lib/themeContext';

interface MilestoneAlertProps {
  milestone: 25 | 50 | 75 | 100;
  isVisible: boolean;
  onClose: () => void;
}

const MILESTONE_MESSAGES = {
  25: {
    title: '🔥 Quarter Way There!',
    message: 'You\'re crushing it! 25% of the way to your goal!',
    emoji: '🎯'
  },
  50: {
    title: '⚡ Halfway to Victory!',
    message: 'Amazing! You\'re already 50% toward your goal!',
    emoji: '💪'
  },
  75: {
    title: '🚀 Almost There!',
    message: 'Just 25% left! You\'re so close to reaching your goal!',
    emoji: '🌟'
  },
  100: {
    title: '🏆 Goal Achieved!',
    message: 'Legendary! You\'ve reached your daily goal!',
    emoji: '🎉'
  }
};

export function MilestoneAlert({ milestone, isVisible, onClose }: MilestoneAlertProps) {
  const { config } = useTheme();
  const isDarkTheme = config.name !== 'ninja-green';
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setTimeout(onClose, 300);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const data = MILESTONE_MESSAGES[milestone];

  return (
    <>
      <style>{`
        @keyframes milestone-pop-in {
          0% {
            opacity: 0;
            transform: scale(0.5) rotateZ(-5deg);
          }
          50% {
            transform: scale(1.05) rotateZ(2deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotateZ(0deg);
          }
        }

        @keyframes milestone-pop-out {
          0% {
            opacity: 1;
            transform: scale(1) rotateZ(0deg);
          }
          100% {
            opacity: 0;
            transform: scale(0.5) rotateZ(5deg);
          }
        }

        @keyframes confetti-fall {
          0% {
            opacity: 1;
            transform: translateY(0) rotateZ(0deg);
          }
          100% {
            opacity: 0;
            transform: translateY(100px) rotateZ(360deg);
          }
        }

        .milestone-alert-enter {
          animation: milestone-pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .milestone-alert-exit {
          animation: milestone-pop-out 0.3s ease-in forwards;
        }

        .milestone-confetti {
          position: absolute;
          pointer-events: none;
        }

        .confetti-piece {
          animation: confetti-fall 2s ease-out forwards;
        }
      `}</style>

      {/* Confetti pieces */}
      {isAnimating && (
        <>
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="milestone-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '50%',
                animation: `confetti-fall ${1.5 + Math.random() * 0.5}s ease-out ${i * 0.05}s forwards`,
              }}
            >
              <div
                className="confetti-piece text-2xl"
                style={{
                  transform: `rotateZ(${Math.random() * 360}deg)`,
                }}
              >
                {['🎉', '🎊', '⭐', '✨', '🌟'][Math.floor(Math.random() * 5)]}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Alert modal */}
      <div
        className={`fixed inset-0 flex items-center justify-center z-50 pointer-events-auto ${
          isAnimating ? 'milestone-alert-enter' : 'milestone-alert-exit'
        }`}
        onClick={onClose}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 ${
            isDarkTheme
              ? 'bg-black/50 backdrop-blur-sm'
              : 'bg-white/50 backdrop-blur-sm'
          }`}
          onClick={onClose}
        />

        {/* Alert card */}
        <div
          className={`relative mx-4 p-8 rounded-3xl shadow-2xl max-w-sm text-center ${
            isDarkTheme
              ? 'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 border-2 border-lime-500'
              : 'bg-gradient-to-br from-lime-50 to-yellow-50 border-2 border-lime-400'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glow effect for dark theme */}
          {isDarkTheme && (
            <div className="absolute inset-0 rounded-3xl bg-lime-500/20 blur-2xl pointer-events-none" />
          )}

          {/* Content */}
          <div className="relative z-10 space-y-4">
            {/* Large emoji */}
            <div className="text-6xl animate-bounce">{data.emoji}</div>

            {/* Title */}
            <h2
              className={`text-3xl font-black tracking-tight ${
                isDarkTheme ? 'text-lime-400' : 'text-lime-700'
              }`}
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {data.title}
            </h2>

            {/* Message */}
            <p
              className={`text-lg font-semibold ${
                isDarkTheme ? 'text-slate-300' : 'text-gray-700'
              }`}
            >
              {data.message}
            </p>

            {/* Milestone indicator */}
            <div className="flex justify-center gap-2 pt-4">
              {[25, 50, 75, 100].map((m) => (
                <div
                  key={m}
                  className={`w-3 h-3 rounded-full transition-all ${
                    m <= milestone
                      ? isDarkTheme
                        ? 'bg-lime-500 scale-125'
                        : 'bg-lime-500 scale-125'
                      : isDarkTheme
                        ? 'bg-slate-600'
                        : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
