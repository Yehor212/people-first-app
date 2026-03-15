import { motion } from 'framer-motion';
import { PremiumLoader } from './PremiumLoader';

interface SplashScreenProps {
  loadingFadeOut: boolean;
  subtitle: string;
}

export function SplashScreen({ loadingFadeOut, subtitle }: SplashScreenProps) {
  return (
    <motion.div
      key="loading"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-background overflow-hidden will-change-transform"
      animate={{
        opacity: loadingFadeOut ? 0 : 1,
        scale: loadingFadeOut ? 1.02 : 1,
      }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      {/* Aurora ambient layer 1 — CSS-driven for battery savings */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 30%, hsl(var(--primary) / 0.10) 0%, transparent 70%)',
          animation: 'zen-glow-breathe 4s ease-in-out infinite',
          '--zen-glow-min': '0.4',
          '--zen-glow-max': '0.8',
        } as React.CSSProperties}
      />

      {/* Aurora ambient layer 2 — CSS-driven */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 50% 40% at 50% 70%, hsl(var(--accent) / 0.05) 0%, transparent 70%)',
          animation: 'zen-glow-breathe 5s ease-in-out 1.5s infinite',
          '--zen-glow-min': '0.3',
          '--zen-glow-max': '0.6',
        } as React.CSSProperties}
      />

      {/* Floating bokeh orbs */}
      <div className="absolute w-24 h-24 rounded-full bg-primary/[0.05] blur-[20px] animate-float top-[20%] left-[15%] [animation-duration:6s]" />
      <div className="absolute w-16 h-16 rounded-full bg-primary/[0.07] blur-[20px] animate-float top-[15%] right-[20%] [animation-duration:7s] [animation-delay:-2s]" />
      <div className="absolute w-20 h-20 rounded-full bg-primary/[0.04] blur-[20px] animate-float bottom-[25%] left-[20%] [animation-duration:5s] [animation-delay:-1s]" />
      <div className="absolute w-14 h-14 rounded-full bg-primary/[0.06] blur-[20px] animate-float bottom-[20%] right-[15%] [animation-duration:8s] [animation-delay:-3s]" />
      <div className="absolute w-10 h-10 rounded-full bg-primary/[0.08] blur-[20px] animate-float top-[45%] left-[10%] [animation-duration:6.5s] [animation-delay:-4s]" />
      <div className="absolute w-12 h-12 rounded-full bg-primary/[0.05] blur-[20px] animate-float top-[40%] right-[10%] [animation-duration:7.5s] [animation-delay:-2.5s]" />

      {/* Glow ring behind logo — CSS-driven pulse for battery savings */}
      <div
        className="absolute rounded-full w-[120px] h-[120px] blur-[10px]"
        style={{
          background: 'radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 70%)',
          animation: 'zen-pulse 3s ease-in-out 0.3s infinite, zen-glow-breathe 3s ease-in-out 0.3s infinite',
          '--zen-pulse-scale': '1.15',
          '--zen-glow-min': '0.15',
          '--zen-glow-max': '0.25',
        } as React.CSSProperties}
      />

      {/* Logo SVG */}
      <motion.div
        className="mb-6 relative"
        initial={{ scale: 0, rotate: -15 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.1 }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="80" height="80" className="drop-shadow-lg" role="img" aria-label="ZenFlow">
          <defs>
            <linearGradient id="splashBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1a6b52" />
              <stop offset="50%" stopColor="#2a9d6e" />
              <stop offset="100%" stopColor="#3dbd80" />
            </linearGradient>
            <radialGradient id="splashHighlight" cx="35%" cy="35%" r="60%">
              <stop offset="0%" stopColor="white" stopOpacity="0.12" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="splashLeafGlow" cx="50%" cy="45%" r="35%">
              <stop offset="0%" stopColor="white" stopOpacity="0.2" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="16" y="16" width="480" height="480" rx="100" ry="100" fill="url(#splashBgGrad)" />
          <rect x="16" y="16" width="480" height="480" rx="100" ry="100" fill="url(#splashHighlight)" />
          <ellipse cx="256" cy="240" rx="130" ry="130" fill="url(#splashLeafGlow)" />
          <g transform="translate(106, 96) scale(12.5)">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"
              fill="white" fillOpacity="0.2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"
              fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <circle cx="340" cy="140" r="3" fill="white" opacity="0.4" />
          <circle cx="345" cy="135" r="1.5" fill="white" opacity="0.6" />
        </svg>
      </motion.div>

      {/* Brand name */}
      <motion.h1
        className="text-3xl font-bold text-foreground tracking-[0.15em]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5, ease: 'easeOut' }}
      >
        ZenFlow
      </motion.h1>

      {/* Localized subtitle */}
      <motion.p
        className="text-sm text-muted-foreground mt-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      >
        {subtitle}
      </motion.p>

      {/* Zen Infinity Draw — premium SVG loader */}
      <motion.div
        className="mt-8 flex items-center justify-center min-h-[130px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0 }}
      >
        <PremiumLoader size="xl" label="Loading" />
      </motion.div>
    </motion.div>
  );
}
