import { motion } from "framer-motion";
import type { ComponentProps } from "react";

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

const caustics = [
  { left: "7%", top: "31%", width: 168, height: 86, delay: 0.4, rotate: -12, tone: "body" },
  { left: "58%", top: "22%", width: 184, height: 92, delay: 1.1, rotate: 16, tone: "focus" },
  { left: "28%", top: "68%", width: 212, height: 104, delay: 1.8, rotate: -8, tone: "energy" },
];

const currents = [
  { left: "12%", top: "7%", width: 220, delay: 0.2, rotate: -8, tone: "body" },
  { left: "56%", top: "18%", width: 200, delay: 0.8, rotate: 11, tone: "focus" },
  { left: "9%", top: "48%", width: 260, delay: 1.4, rotate: -15, tone: "primary" },
  { left: "48%", top: "81%", width: 230, delay: 2.0, rotate: 9, tone: "energy" },
];

function entryToneVar(tone: string) {
  if (tone === "focus") {
    return "--zf-role-focus";
  }

  if (tone === "energy") {
    return "--zf-role-energy";
  }

  if (tone === "primary") {
    return "--primary";
  }

  return "--zf-role-body";
}

type MotionSpanProps = ComponentProps<typeof motion.span>;

function BackdropSpan({ animated, animate, transition, ...props }: MotionSpanProps & { animated: boolean }) {
  if (!animated) {
    return <span {...(props as ComponentProps<"span">)} />;
  }

  return <motion.span {...props} animate={animate} transition={transition} />;
}

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
        <BackdropSpan
          animated={animated}
          className="entry-gate-horizon zf-entry-gate-horizon-position absolute"
          data-testid="entry-gate-backdrop-horizon"
          animate={{ opacity: [0.18, 0.34, 0.22], scaleX: [0.98, 1.02, 1] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />

        {ribbons.map((ribbon) => {
          const toneVar = entryToneVar(ribbon.tone);

          return (
            <BackdropSpan
              animated={animated}
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
              animate={{
                opacity: [0.08, 0.24, 0.12],
                x: [0, 16, -8, 0],
                y: [0, -10, 4, 0],
              }}
              transition={{
                duration: 12,
                delay: ribbon.delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          );
        })}

        {caustics.map((caustic) => {
          const toneVar = entryToneVar(caustic.tone);

          return (
            <BackdropSpan
              animated={animated}
              key={`${caustic.left}-${caustic.top}`}
              className="entry-gate-caustic absolute rounded-full"
              data-testid="entry-gate-backdrop-caustic"
              style={{
                left: caustic.left,
                top: caustic.top,
                width: caustic.width,
                height: caustic.height,
                rotate: `${caustic.rotate}deg`,
                background: `radial-gradient(ellipse at 35% 45%, hsl(var(${toneVar}) / 0.13), transparent 58%), radial-gradient(ellipse at 68% 52%, hsl(var(--primary) / 0.09), transparent 64%)`,
              }}
              animate={{
                opacity: [0.1, 0.26, 0.14],
                scale: [0.98, 1.05, 1],
                x: [0, 8, -4, 0],
              }}
              transition={{ duration: 9.2, delay: caustic.delay, repeat: Infinity, ease: "easeInOut" }}
            />
          );
        })}

        {currents.map((current) => {
          const toneVar = entryToneVar(current.tone);

          return (
            <BackdropSpan
              animated={animated}
              key={`${current.left}-${current.top}`}
              className="entry-gate-current absolute"
              data-testid="entry-gate-backdrop-current"
              style={{
                left: current.left,
                top: current.top,
                width: current.width,
                rotate: `${current.rotate}deg`,
                background: `linear-gradient(90deg, transparent, hsl(var(${toneVar}) / 0.2), hsl(var(--primary) / 0.08), transparent)`,
              }}
              animate={{
                opacity: [0.08, 0.22, 0.12],
                x: [0, 18, -6, 0],
              }}
              transition={{ duration: 10.5, delay: current.delay, repeat: Infinity, ease: "easeInOut" }}
            />
          );
        })}

        {orbs.map((orb) => (
          <BackdropSpan
            animated={animated}
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
            animate={{ opacity: [0.22, 0.72, 0.28], scale: [1, 1.45, 1] }}
            transition={{ duration: 5.5, delay: orb.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}

        {ripples.map((ripple) => (
          <BackdropSpan
            animated={animated}
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
            animate={{
              opacity: [0.1, 0.3, 0.14],
              scale: [0.96, 1.08, 1],
              y: [0, -8, 2, 0],
            }}
            transition={{ duration: 7.4, delay: ripple.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
    </>
  );
}
