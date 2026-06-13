import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface EntryGateBackdropProps {
  animated: boolean;
}

const orbs = [
  { left: "9%", top: "18%", size: 8, color: "hsl(var(--zf-role-body) / 0.42)", delay: 0 },
  { left: "82%", top: "15%", size: 6, color: "hsl(var(--zf-role-focus) / 0.36)", delay: 0.6 },
  { left: "31%", top: "91%", size: 5, color: "hsl(var(--zf-role-energy) / 0.32)", delay: 1.1 },
];

const stars = [
  { left: "22%", top: "11%", delay: 0.1 },
  { left: "78%", top: "34%", delay: 0.8 },
];

export function EntryGateBackdrop({ animated }: EntryGateBackdropProps) {
  return (
    <>
      <div aria-hidden="true" className="entry-gate-aurora" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        data-testid="entry-gate-backdrop"
      >
        {orbs.map((orb) => (
          <motion.span
            key={`${orb.left}-${orb.top}`}
            className="absolute rounded-full"
            data-testid="entry-gate-backdrop-orb"
            style={{
              left: orb.left,
              top: orb.top,
              width: orb.size,
              height: orb.size,
              background: orb.color,
              boxShadow: `0 0 ${orb.size * 5}px ${orb.color}`,
            }}
            animate={animated ? { opacity: [0.22, 0.72, 0.28], scale: [1, 1.45, 1] } : undefined}
            transition={{ duration: 5.5, delay: orb.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}

        {stars.map((star) => (
          <motion.span
            key={`${star.left}-${star.top}`}
            className="absolute"
            data-testid="entry-gate-backdrop-star"
            style={{
              left: star.left,
              top: star.top,
              display: "grid",
              width: 32,
              height: 32,
              placeItems: "center",
              color: "hsl(var(--primary) / 0.45)",
            }}
            animate={animated ? { opacity: [0.24, 0.76, 0.3], rotate: [0, 12, -6, 0] } : undefined}
            transition={{ duration: 6.8, delay: star.delay, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="h-4 w-4" />
          </motion.span>
        ))}
      </div>
    </>
  );
}
