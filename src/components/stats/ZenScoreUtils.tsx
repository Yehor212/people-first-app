// Extracted from ZenScoreHub to keep under 400 LOC (Law 26)

export const getScoreColor = (score: number) => {
  if (score >= 81)
    return {
      hsl: "158 60% 50%",
      class: "text-[hsl(var(--mood-good))]",
      glow: "hsl(158 60% 50%)",
    };
  if (score >= 61)
    return {
      hsl: "217 91% 60%",
      class: "text-[hsl(var(--chart-focus))]",
      glow: "hsl(217 91% 60%)",
    };
  if (score >= 41)
    return {
      hsl: "45 95% 55%",
      class: "text-[hsl(var(--mood-okay))]",
      glow: "hsl(45 95% 55%)",
    };
  return {
    hsl: "0 72% 51%",
    class: "text-destructive",
    glow: "hsl(0 72% 51%)",
  };
};

export const getScoreLabel = (score: number, t: Record<string, string>) => {
  if (score >= 81) return t.zenScoreExcellent || "Excellent!";
  if (score >= 61) return t.zenScoreGood || "Good";
  if (score >= 41) return t.zenScoreOkay || "Keep going";
  return t.zenScoreNeedsWork || "Needs work";
};

// Mini sparkline for breakdown items - compact 7-point line
export function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const height = 20;
  const width = 40;
  const padding = 2;

  const points = data.slice(-7).map((value, i, arr) => {
    const x = padding + (i / (arr.length - 1)) * (width - padding * 2);
    const y =
      height - padding - ((value - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      className="opacity-60 hover:opacity-100 motion-safe:transition-opacity"
    >
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
