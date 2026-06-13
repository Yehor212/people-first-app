import { motion } from "framer-motion";

interface EntryGateBackdropProps {
  animated: boolean;
}

const orbs = [
  { left: "9%", top: "18%", size: 8, color: "hsl(var(--zf-role-body) / 0.42)", delay: 0 },
  { left: "82%", top: "15%", size: 6, color: "hsl(var(--zf-role-focus) / 0.36)", delay: 0.6 },
  { left: "31%", top: "91%", size: 5, color: "hsl(var(--zf-role-energy) / 0.32)", delay: 1.1 },
];

const flowMarks = [
  { left: "22%", top: "11%", delay: 0.1, rotate: -12, scale: 0.96 },
  { left: "78%", top: "34%", delay: 0.8, rotate: 18, scale: 0.84 },
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

        {flowMarks.map((mark) => (
          <motion.span
            key={`${mark.left}-${mark.top}`}
            className="absolute"
            data-testid="entry-gate-backdrop-flow-mark"
            style={{
              left: mark.left,
              top: mark.top,
              display: "grid",
              width: 34,
              height: 34,
              placeItems: "center",
              color: "hsl(var(--primary) / 0.5)",
            }}
            animate={
              animated
                ? {
                    opacity: [0.22, 0.68, 0.28],
                    y: [0, -8, 2, 0],
                  }
                : undefined
            }
            transition={{ duration: 7.4, delay: mark.delay, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg
              className="h-7 w-7"
              viewBox="0 0 32 32"
              fill="none"
              aria-hidden="true"
              style={{ transform: `rotate(${mark.rotate}deg) scale(${mark.scale})` }}
            >
              <path
                d="M7.5 18.2c4.8-9.2 13-10.5 17.2-7.5-.9 7.4-6.8 12.6-15.1 10.2 2.5-1 5.1-2.9 7.4-5.7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8.3 22.6c3.6 3 8.8 3.7 13.6 1.1"
                stroke="currentColor"
                strokeWidth="1.45"
                strokeLinecap="round"
                opacity="0.58"
              />
              <circle cx="23.8" cy="7.6" r="1.35" fill="currentColor" opacity="0.58" />
            </svg>
          </motion.span>
        ))}
      </div>
    </>
  );
}
