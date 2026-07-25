/**
 * PremiumChart - Animated SVG chart with glow effects
 */

import { useId } from "react";
import { motion } from "framer-motion";
import { easings } from "@/lib/motion";
import type { DayData } from "./types";

// Premium animated chart with glow effects
export function PremiumChart({
  data,
  color,
  glowColor,
  dayNames,
}: {
  data: DayData[];
  color: string;
  glowColor: string;
  dayNames: string[];
}) {
  const uid = useId();
  const gradientId = `chartGradient-${uid}`;
  const filterId = `chartGlow-${uid}`;

  if (data.length < 2) return null;

  const values = data.map((d) => (Number.isFinite(d.value) ? d.value : 0));
  const max = Math.max(...values, 100);
  const height = 148;
  const width = 360;
  const padding = { top: 44, bottom: 34, left: 18, right: 18 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = values.map((value, i) => ({
    x: padding.left + (i / (values.length - 1)) * chartWidth,
    y: padding.top + chartHeight - (value / max) * chartHeight,
    value,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;

  // Guard: if path contains NaN (bad data), don't render SVG
  if (pathD.includes("NaN")) return null;

  const dayLabels = data.map((d) => {
    const dayOfWeek = new Date(d.date).getDay();
    return dayNames[dayOfWeek]?.slice(0, 1) || "";
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto min-w-[24rem] w-full max-w-none overflow-visible"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Area fill with gradient */}
      <motion.path
        d={areaD}
        fill={`url(#${gradientId})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: easings.standard }}
      />

      {/* Glow line */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={glowColor}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="blur-sm"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: easings.emphasizedDecelerate }}
      />

      {/* Main line */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: easings.emphasizedDecelerate }}
      />

      {/* Data points with animation */}
      {points.map((point, i) => (
        <motion.g key={i}>
          {/* Outer glow ring */}
          <motion.circle
            cx={point.x}
            cy={point.y}
            r="8"
            fill={glowColor}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.3 }}
            transition={{ delay: 0.8 + i * 0.08 }}
          />
          {/* Inner dot */}
          <motion.circle
            cx={point.x}
            cy={point.y}
            r="5"
            fill="white"
            stroke={color}
            strokeWidth="2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.8 + i * 0.08, type: "spring" }}
          />
          {/* Value label for last point */}
          {i === points.length - 1 && (
            <motion.g
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
            >
              <rect x={point.x - 28} y={point.y - 38} width="56" height="28" rx="14" fill={color} />
              <text
                x={point.x}
                y={point.y - 19}
                textAnchor="middle"
                className="text-xs font-bold fill-white"
              >
                {Math.round(point.value)}%
              </text>
            </motion.g>
          )}
        </motion.g>
      ))}

      {/* Day labels */}
      {dayLabels.map((label, i) => (
        <text
          key={i}
          x={points[i]?.x || 0}
          y={height - 9}
          textAnchor="middle"
          className="text-xs font-medium fill-muted-foreground"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}
