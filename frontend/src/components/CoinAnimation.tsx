import { useEffect, useState } from 'react';

export function CoinAnimation() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation on component mount
    setIsVisible(true);
  }, []);

  const coins = Array.from({ length: 8 }, (_, i) => {
    // Calculate angle for each coin (spread evenly around 360 degrees)
    const angle = (i / 8) * Math.PI * 2;
    const distance = 300;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    return { id: i, x, y, angle };
  });

  return (
    <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-30 overflow-hidden">
      {isVisible && coins.map((coin) => (
        <div
          key={coin.id}
          className="coin-animation"
          style={{
            '--coin-delay': `${coin.id * 0.08}s`,
            '--tx': `${coin.x}px`,
            '--ty': `${coin.y}px`,
          } as React.CSSProperties}
        >
          <svg
            className="w-12 h-12 md:w-20 md:h-20 lg:w-24 lg:h-24 text-yellow-400"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="10" fill="url(#goldGradient)" />
            <defs>
              <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#FCD34D', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#FBBF24', stopOpacity: 1 }} />
              </linearGradient>
            </defs>
            <text
              x="12"
              y="15"
              textAnchor="middle"
              fontSize="14"
              fontWeight="bold"
              fill="#92400e"
            >
              ¥
            </text>
          </svg>
        </div>
      ))}

      <style>{`
        @keyframes coinBurst {
          0% {
            opacity: 1;
            transform: translate(0, 0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(var(--tx), var(--ty)) scale(0);
          }
        }

        .coin-animation {
          position: fixed;
          top: 50px;
          left: 50%;
          transform: translateX(-50%);
          animation: coinBurst 1.4s ease-out forwards;
          animation-delay: var(--coin-delay);
          filter: drop-shadow(0 0 12px rgba(250, 204, 21, 0.9));
        }

        @media (min-width: 768px) {
          .coin-animation {
            top: 100px;
          }
        }

        @media (min-width: 1024px) {
          .coin-animation {
            top: 140px;
          }
        }
      `}</style>
    </div>
  );
}
