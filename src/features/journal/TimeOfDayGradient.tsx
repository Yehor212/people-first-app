import { useState, useEffect, memo } from "react";
import { cn } from "@/lib/utils";

type TimePeriod = "morning" | "afternoon" | "evening" | "night";

const GRADIENTS: Record<TimePeriod, string> = {
  morning: "from-amber-500/8 via-yellow-500/5 to-transparent",
  afternoon: "from-sky-500/8 via-blue-500/5 to-transparent",
  evening: "from-orange-500/8 via-purple-500/5 to-transparent",
  night: "from-indigo-500/8 via-violet-500/5 to-transparent",
};

function getTimePeriod(hour: number): TimePeriod {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

/** Returns blend factor 0-1 for the 30-min transition zone */
function getBlendFactor(hour: number, minute: number): { from: TimePeriod; to: TimePeriod; factor: number } | null {
  const zones = [
    { boundary: 6, from: "night" as TimePeriod, to: "morning" as TimePeriod },
    { boundary: 12, from: "morning" as TimePeriod, to: "afternoon" as TimePeriod },
    { boundary: 17, from: "afternoon" as TimePeriod, to: "evening" as TimePeriod },
    { boundary: 21, from: "evening" as TimePeriod, to: "night" as TimePeriod },
  ];

  for (const zone of zones) {
    const totalMinutes = hour * 60 + minute;
    const boundaryMinutes = zone.boundary * 60;
    const diff = totalMinutes - boundaryMinutes;
    // Blend zone: -30 to +30 minutes around boundary
    if (diff >= -30 && diff <= 30) {
      return { from: zone.from, to: zone.to, factor: (diff + 30) / 60 };
    }
  }
  return null;
}

export const TimeOfDayGradient = memo(function TimeOfDayGradient() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 15 * 60 * 1000); // 15 min
    return () => clearInterval(interval);
  }, []);

  const hour = now.getHours();
  const minute = now.getMinutes();
  const blend = getBlendFactor(hour, minute);
  const currentPeriod = getTimePeriod(hour);

  return (
    <>
      {/* Primary gradient */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br pointer-events-none transition-opacity duration-[30000ms] ease-linear",
          GRADIENTS[blend ? blend.from : currentPeriod]
        )}
        style={{ opacity: blend ? 1 - blend.factor : 1 }}
      />
      {/* Blend target gradient (only during transitions) */}
      {blend && (
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br pointer-events-none",
            GRADIENTS[blend.to]
          )}
          style={{ opacity: blend.factor }}
        />
      )}
    </>
  );
});
