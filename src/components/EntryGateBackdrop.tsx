import { motion } from "framer-motion";

interface EntryGateBackdropProps {
  animated: boolean;
}

const orbs = [
  { left: "9%", top: "18%", size: 8, color: "hsl(var(--zf-role-body) / 0.42)", delay: 0 },
  { left: "82%", top: "15%", size: 6, color: "hsl(var(--zf-role-focus) / 0.36)", delay: 0.6 },
  { left: "71%", top: "43%", size: 4, color: "hsl(var(--primary) / 0.28)", delay: 0.9 },
  { left: "31%", top: "91%", size: 5, color: "hsl(var(--zf-role-energy) / 0.32)", delay: 1.1 },
  { left: "16%", top: "62%", size: 5, color: "hsl(var(--zf-role-diary) / 0.28)", delay: 1.5 },
  { left: "54%", top: "79%", size: 7, color: "hsl(var(--zf-role-body) / 0.24)", delay: 1.9 },
  { left: "91%", top: "68%", size: 4, color: "hsl(var(--zf-role-focus) / 0.3)", delay: 2.3 },
];

const ripples = [
  { left: "18%", top: "12%", width: 92, height: 46, delay: 0.1, rotate: -18 },
  { left: "76%", top: "34%", width: 84, height: 40, delay: 0.8, rotate: 22 },
  { left: "44%", top: "74%", width: 112, height: 50, delay: 1.4, rotate: -9 },
];

const ribbons = [
  { left: "-12%", top: "8%", width: 360, height: 92, delay: 0.2, rotate: -22, tone: "body" },
  { left: "58%", top: "0%", width: 300, height: 84, delay: 0.9, rotate: 34, tone: "focus" },
  { left: "4%", top: "66%", width: 340, height: 86, delay: 1.5, rotate: -32, tone: "energy" },
];

export function EntryGateBackdrop({ animated }: EntryGateBackdropProps) {
  return (
    <>
      <div
        aria-hidden="true"
        className="entry-gate-aurora"
        data-testid="entry-gate-aurora"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        data-testid="entry-gate-backdrop"
      >
        {ribbons.map((ribbon) => {
          const toneVar =
            ribbon.tone === "focus"
              ? "--zf-role-focus"
              : ribbon.tone === "energy"
                ? "--zf-role-energy"
                : "--zf-role-body";

          return (
            <motion.span
              key={`${ribbon.left}-${ribbon.top}`}
              className="entry-gate-flow-ribbon absolute rounded-full"
              data-testid="entry-gate-backdrop-ribbon"
              style={{
                left: ribbon.left,
                top: ribbon.top,
                width: ribbon.width,
                height: ribbon.height,
                rotate: `${ribbon.rotate}deg`,
                background: `linear-gradient(90deg, transparent, hsl(var(${toneVar}) / 0.16), hsl(var(--primary) / 0.08), transparent)`,
              }}
              animate={
                animated
                  ? {
                      opacity: [0.08, 0.24, 0.12],
                      x: [0, 16, -8, 0],
                      y: [0, -10, 4, 0],
                    }
                  : undefined
              }
              transition={{
                duration: 12,
                delay: ribbon.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          );
        })}

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

        {ripples.map((ripple) => (
          <motion.span
            key={`${ripple.left}-${ripple.top}`}
            className="absolute rounded-full"
            data-testid="entry-gate-backdrop-ripple"
            style={{
              left: ripple.left,
              top: ripple.top,
              width: ripple.width,
              height: ripple.height,
              rotate: `${ripple.rotate}deg`,
              border: "1px solid hsl(var(--primary) / 0.12)",
              background:
                "radial-gradient(ellipse at center, hsl(var(--primary) / 0.1), transparent 68%)",
              boxShadow: "0 0 34px hsl(var(--primary) / 0.08)",
            }}
            animate={
              animated
                ? {
                    opacity: [0.1, 0.3, 0.14],
                    scale: [0.96, 1.08, 1],
                    y: [0, -8, 2, 0],
                  }
                : undefined
            }
            transition={{ duration: 7.4, delay: ripple.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
    </>
  );
}
