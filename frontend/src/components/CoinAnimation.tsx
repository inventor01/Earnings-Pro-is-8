import { useEffect, useState } from 'react';

export function CoinAnimation() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation on component mount
    setIsVisible(true);
  }, []);

  const coins = Array.from({ length: 8 }, (_, i) => i);

  return (
    <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-30">
      {isVisible && coins.map((coin) => (
        <div
          key={coin}
          className="coin-animation"
          style={{
            '--coin-delay': `${coin * 0.1}s`,
          } as React.CSSProperties}
        >
          <svg
            className="w-8 h-8 md:w-12 md:h-12 text-yellow-400"
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
          --tx: ${Math.cos(Math.random() * Math.PI * 2) * 200}px;
          --ty: ${Math.sin(Math.random() * Math.PI * 2) * 200}px;
          position: fixed;
          top: 80px;
          left: 80px;
          animation: coinBurst 1.2s ease-out forwards;
          animation-delay: var(--coin-delay);
          filter: drop-shadow(0 0 8px rgba(250, 204, 21, 0.8));
        }

        @media (min-width: 768px) {
          .coin-animation {
            top: 120px;
            left: 120px;
          }
        }

        @media (min-width: 1024px) {
          .coin-animation {
            top: 160px;
            left: 160px;
          }
        }
      `}</style>
    </div>
  );
}
