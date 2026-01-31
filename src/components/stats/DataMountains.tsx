/**
 * DataMountains - "Річка Даних" (Data River)
 *
 * Trend visualization as mountain landscape with:
 * - Mountains representing data peaks
 * - Animated water/river at the bottom
 * - Weather icons above peaks
 * - Parallax depth effect
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface DataPoint {
  label: string;
  value: number;
  date?: string;
}

interface DataMountainsProps {
  data: DataPoint[];
  maxValue?: number;
  title?: string;
  color?: 'mood' | 'habits' | 'focus';
  className?: string;
}

// Animated water wave
function WaterWave({ delay, opacity }: { delay: number; opacity: number }) {
  return (
    <motion.path
      d="M0 8 Q25 4 50 8 T100 8 T150 8 T200 8 T250 8 T300 8 T350 8 T400 8 V20 H0 Z"
      fill={`rgba(59, 130, 246, ${opacity})`}
      animate={{ x: [-50, 0] }}
      transition={{
        duration: 3 + delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

// Cloud component
function Cloud({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  return (
    <motion.g
      transform={`translate(${x}, ${y}) scale(${size})`}
      animate={{ x: [0, 15, 0] }}
      transition={{
        duration: 20 + delay * 5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <ellipse cx="0" cy="0" rx="12" ry="6" fill="rgba(255, 255, 255, 0.15)" />
      <ellipse cx="10" cy="-2" rx="8" ry="5" fill="rgba(255, 255, 255, 0.12)" />
      <ellipse cx="-8" cy="2" rx="6" ry="4" fill="rgba(255, 255, 255, 0.1)" />
    </motion.g>
  );
}

// Weather icon based on value
function WeatherIcon({ value, maxValue }: { value: number; maxValue: number }) {
  const ratio = value / maxValue;

  if (ratio >= 0.8) {
    // Sunny
    return (
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      >
        <circle r="6" fill="#fbbf24" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <line
            key={angle}
            x1="0" y1="-9"
            x2="0" y2="-12"
            stroke="#fbbf24"
            strokeWidth="2"
            strokeLinecap="round"
            transform={`rotate(${angle})`}
          />
        ))}
      </motion.g>
    );
  } else if (ratio >= 0.6) {
    // Partly cloudy
    return (
      <g>
        <circle cx="4" cy="-2" r="5" fill="#fbbf24" opacity="0.8" />
        <ellipse cx="-2" cy="2" rx="8" ry="4" fill="rgba(255,255,255,0.6)" />
        <ellipse cx="4" cy="4" rx="6" ry="3" fill="rgba(255,255,255,0.5)" />
      </g>
    );
  } else if (ratio >= 0.4) {
    // Cloudy
    return (
      <g>
        <ellipse cx="0" cy="0" rx="10" ry="5" fill="rgba(156, 163, 175, 0.6)" />
        <ellipse cx="6" cy="2" rx="7" ry="4" fill="rgba(156, 163, 175, 0.5)" />
      </g>
    );
  } else {
    // Rainy
    return (
      <g>
        <ellipse cx="0" cy="-2" rx="10" ry="5" fill="rgba(107, 114, 128, 0.6)" />
        {[-4, 0, 4].map((x, i) => (
          <motion.line
            key={i}
            x1={x} y1="4"
            x2={x - 1} y2="10"
            stroke="rgba(59, 130, 246, 0.6)"
            strokeWidth="1.5"
            strokeLinecap="round"
            animate={{ opacity: [0.3, 0.8, 0.3], y: [0, 2, 0] }}
            transition={{
              duration: 0.6,
              delay: i * 0.2,
              repeat: Infinity,
            }}
          />
        ))}
      </g>
    );
  }
}

export function DataMountains({
  data,
  maxValue: providedMax,
  title,
  color = 'mood',
  className,
}: DataMountainsProps) {
  const { t } = useLanguage();

  const maxValue = providedMax || Math.max(...data.map(d => d.value), 1);

  // Colors based on type
  const colorConfig = {
    mood: {
      mountain: ['#7c3aed', '#8b5cf6', '#a78bfa'],
      sky: 'from-indigo-900 via-purple-900 to-violet-800',
      water: 'rgba(99, 102, 241, 0.3)',
    },
    habits: {
      mountain: ['#059669', '#10b981', '#34d399'],
      sky: 'from-emerald-900 via-teal-900 to-cyan-800',
      water: 'rgba(20, 184, 166, 0.3)',
    },
    focus: {
      mountain: ['#2563eb', '#3b82f6', '#60a5fa'],
      sky: 'from-blue-900 via-indigo-900 to-sky-800',
      water: 'rgba(59, 130, 246, 0.3)',
    },
  }[color];

  // Generate mountain path from data
  const mountainPath = useMemo(() => {
    if (data.length < 2) return '';

    const width = 100;
    const height = 60;
    const points: string[] = [];

    data.forEach((point, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (point.value / maxValue) * (height - 10);

      if (i === 0) {
        points.push(`M0 ${height}`);
        points.push(`L0 ${y}`);
      }

      // Create smooth peaks
      if (i > 0) {
        const prevX = ((i - 1) / (data.length - 1)) * width;
        const cpX = (prevX + x) / 2;
        points.push(`Q${cpX} ${y - 5} ${x} ${y}`);
      }

      if (i === data.length - 1) {
        points.push(`L${width} ${height}`);
        points.push('Z');
      }
    });

    return points.join(' ');
  }, [data, maxValue]);

  // Background mountains (parallax effect)
  const bgMountainPath = useMemo(() => {
    return 'M0 70 L0 45 Q15 35 30 42 Q50 30 70 38 Q85 28 100 40 L100 70 Z';
  }, []);

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      {/* Sky gradient background */}
      <div className={cn("absolute inset-0 bg-gradient-to-b", colorConfig.sky)} />

      {/* Stars */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-0.5 h-0.5 rounded-full bg-white"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 40}%`,
            }}
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{
              duration: 2 + Math.random() * 2,
              delay: Math.random() * 2,
              repeat: Infinity,
            }}
          />
        ))}
      </div>

      {/* Title */}
      {title && (
        <motion.h4
          className="absolute top-3 left-4 text-sm font-medium text-white/80 z-10"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
        >
          {title}
        </motion.h4>
      )}

      {/* SVG Visualization */}
      <svg
        viewBox="0 0 100 70"
        className="w-full h-full"
        preserveAspectRatio="none"
        style={{ minHeight: 180 }}
      >
        {/* Clouds */}
        <Cloud x={15} y={12} size={0.8} delay={0} />
        <Cloud x={70} y={8} size={0.6} delay={2} />
        <Cloud x={45} y={15} size={0.7} delay={1} />

        {/* Background mountain layer (darker, further) */}
        <motion.path
          d={bgMountainPath}
          fill={colorConfig.mountain[0]}
          opacity={0.4}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 0.4 }}
          transition={{ duration: 1 }}
        />

        {/* Main data mountain */}
        <motion.path
          d={mountainPath}
          fill={`url(#mountainGradient-${color})`}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
        />

        {/* Mountain gradient definition */}
        <defs>
          <linearGradient id={`mountainGradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colorConfig.mountain[2]} />
            <stop offset="50%" stopColor={colorConfig.mountain[1]} />
            <stop offset="100%" stopColor={colorConfig.mountain[0]} />
          </linearGradient>
        </defs>

        {/* Weather icons above peaks */}
        {data.map((point, i) => {
          const x = (i / (data.length - 1)) * 100;
          const y = 60 - (point.value / maxValue) * 50 - 15;
          return (
            <g key={i} transform={`translate(${x}, ${y})`}>
              <WeatherIcon value={point.value} maxValue={maxValue} />
            </g>
          );
        })}

        {/* Water at bottom */}
        <g transform="translate(0, 60)">
          <WaterWave delay={0} opacity={0.3} />
          <WaterWave delay={1} opacity={0.2} />
          <WaterWave delay={2} opacity={0.15} />
        </g>

        {/* Reflection on water */}
        <rect
          x="0" y="62" width="100" height="8"
          fill="url(#waterReflection)"
        />
        <defs>
          <linearGradient id="waterReflection" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>

      {/* Data labels */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-between px-4">
        {data.length > 0 && (
          <>
            <span className="text-xs text-white/50">{data[0].label}</span>
            <span className="text-xs text-white/50">{data[data.length - 1].label}</span>
          </>
        )}
      </div>

      {/* Glow overlay */}
      <div
        className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at bottom, ${colorConfig.water} 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}

export default DataMountains;
