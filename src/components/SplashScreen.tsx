import { motion } from 'framer-motion';

interface SplashScreenProps {
  loadingFadeOut: boolean;
  subtitle: string;
}

export function SplashScreen({ loadingFadeOut, subtitle }: SplashScreenProps) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <motion.div
      key="loading"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background overflow-hidden will-change-transform"
      animate={{
        opacity: loadingFadeOut ? 0 : 1,
        scale: loadingFadeOut ? 1.02 : 1,
      }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      {/* Aurora ambient layer 1 — CSS-driven for battery savings */}
      {!prefersReducedMotion && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 30%, hsl(var(--primary) / 0.10) 0%, transparent 70%)',
            animation: 'zen-glow-breathe 4s ease-in-out infinite',
            '--zen-glow-min': '0.4',
            '--zen-glow-max': '0.8',
          } as React.CSSProperties}
        />
      )}

      {/* Aurora ambient layer 2 — CSS-driven */}
      {!prefersReducedMotion && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 50% 40% at 50% 70%, hsl(var(--accent) / 0.05) 0%, transparent 70%)',
            animation: 'zen-glow-breathe 5s ease-in-out 1.5s infinite',
            '--zen-glow-min': '0.3',
            '--zen-glow-max': '0.6',
          } as React.CSSProperties}
        />
      )}

      {/* Floating bokeh orbs */}
      {!prefersReducedMotion && (
        <>
          <div className="absolute w-24 h-24 rounded-full bg-primary/[0.05] blur-[20px] animate-float" style={{ top: '20%', left: '15%', animationDuration: '6s' }} />
          <div className="absolute w-16 h-16 rounded-full bg-primary/[0.07] blur-[20px] animate-float" style={{ top: '15%', right: '20%', animationDuration: '7s', animationDelay: '-2s' }} />
          <div className="absolute w-20 h-20 rounded-full bg-primary/[0.04] blur-[20px] animate-float" style={{ bottom: '25%', left: '20%', animationDuration: '5s', animationDelay: '-1s' }} />
          <div className="absolute w-14 h-14 rounded-full bg-primary/[0.06] blur-[20px] animate-float" style={{ bottom: '20%', right: '15%', animationDuration: '8s', animationDelay: '-3s' }} />
          <div className="absolute w-10 h-10 rounded-full bg-primary/[0.08] blur-[20px] animate-float" style={{ top: '45%', left: '10%', animationDuration: '6.5s', animationDelay: '-4s' }} />
          <div className="absolute w-12 h-12 rounded-full bg-primary/[0.05] blur-[20px] animate-float" style={{ top: '40%', right: '10%', animationDuration: '7.5s', animationDelay: '-2.5s' }} />
        </>
      )}

      {/* Glow ring behind logo — CSS-driven pulse for battery savings */}
      <div
        className="absolute rounded-full"
        style={{
          width: 120, height: 120,
          background: 'radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 70%)',
          filter: 'blur(10px)',
          ...(prefersReducedMotion
            ? { opacity: 0.15 }
            : {
                animation: 'zen-pulse 3s ease-in-out 0.3s infinite, zen-glow-breathe 3s ease-in-out 0.3s infinite',
                '--zen-pulse-scale': '1.15',
                '--zen-glow-min': '0.15',
                '--zen-glow-max': '0.25',
              }),
        } as React.CSSProperties}
      />

      {/* Logo SVG */}
      <motion.div
        className="mb-6 relative"
        initial={prefersReducedMotion ? {} : { scale: 0, rotate: -15 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={prefersReducedMotion ? {} : { type: 'spring', stiffness: 180, damping: 14, delay: 0.1 }}
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
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? {} : { delay: 0.5, duration: 0.5, ease: 'easeOut' }}
      >
        ZenFlow
      </motion.h1>

      {/* Localized subtitle */}
      <motion.p
        className="text-sm text-muted-foreground mt-3"
        initial={prefersReducedMotion ? {} : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={prefersReducedMotion ? {} : { delay: 0.8, duration: 0.5 }}
      >
        {subtitle}
      </motion.p>

      {/* Zen Glow Ring — premium SVG loader with gradient strokes + neon glow */}
      <motion.div
        className="mt-8 flex items-center justify-center"
        style={{ minHeight: 120 }}
        initial={prefersReducedMotion ? {} : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={prefersReducedMotion ? {} : { delay: 1.0 }}
      >
        <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true" className="pointer-events-none">
          <defs>
            <linearGradient id="zen-ring-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="120">
              <stop offset="0%" stopColor="#1a6b52" />
              <stop offset="40%" stopColor="#2a9d6e" />
              <stop offset="70%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#2dd4bf" />
            </linearGradient>
          </defs>

          {/* Outer glow ring — pulsing neon drop-shadow */}
          <circle cx="60" cy="60" r="48" fill="none"
            stroke="url(#zen-ring-grad)" strokeWidth="3" strokeLinecap="round"
            opacity="0.5"
            style={!prefersReducedMotion ? {
              animation: 'zen-ring-rotate 2s linear infinite, zen-ring-dash 2.5s cubic-bezier(0.35,0,0.25,1) infinite, zen-ring-glow 3s cubic-bezier(0.4,0,0.6,1) infinite',
              transformOrigin: 'center',
            } : { strokeDasharray: '150 301.6' }}
            className="zen-ring-animated"
          />

          {/* Main ring — crisp gradient stroke */}
          <circle cx="60" cy="60" r="48" fill="none"
            stroke="url(#zen-ring-grad)" strokeWidth="2" strokeLinecap="round"
            style={!prefersReducedMotion ? {
              animation: 'zen-ring-rotate 2s linear infinite, zen-ring-dash 2.5s cubic-bezier(0.35,0,0.25,1) infinite',
              transformOrigin: 'center',
            } : { strokeDasharray: '150 301.6' }}
            className="zen-ring-animated"
          />

          {/* Inner counter-rotating ring — adds depth */}
          <circle cx="60" cy="60" r="36" fill="none"
            stroke="url(#zen-ring-grad)" strokeWidth="1.5" strokeLinecap="round"
            opacity="0.35"
            style={!prefersReducedMotion ? {
              animation: 'zen-ring-rotate-reverse 3s linear infinite, zen-ring-dash-inner 3s cubic-bezier(0.35,0,0.25,1) infinite',
              transformOrigin: 'center',
            } : { strokeDasharray: '80 226.2' }}
            className="zen-ring-animated"
          />

          {/* Center breathing dot — bouncy overshoot easing */}
          <circle cx="60" cy="60" r="4" fill="#3dbd80"
            style={!prefersReducedMotion ? {
              animation: 'zen-ring-center 2.5s cubic-bezier(0.68,-0.55,0.265,1.55) infinite',
              transformOrigin: 'center',
            } : undefined}
            className="zen-ring-animated"
          />
        </svg>
      </motion.div>
    </motion.div>
  );
}
