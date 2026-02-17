import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Shooting star component - random occasional effect
export function ShootingStar() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ startX: 20, startY: 15, angle: 40 });

  useEffect(() => {
    let hideTimeout: ReturnType<typeof setTimeout>;
    let scheduleTimeout: ReturnType<typeof setTimeout>;

    const triggerStar = () => {
      setPosition({
        startX: 10 + Math.random() * 40,
        startY: 5 + Math.random() * 25,
        angle: 25 + Math.random() * 35,
      });
      setVisible(true);
      hideTimeout = setTimeout(() => setVisible(false), 800);
    };

    // Random interval between 6-12 seconds
    const scheduleNext = () => {
      const delay = 6000 + Math.random() * 6000;
      scheduleTimeout = setTimeout(() => {
        if (Math.random() > 0.4) triggerStar();
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => {
      clearTimeout(hideTimeout);
      clearTimeout(scheduleTimeout);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="absolute pointer-events-none z-20"
          style={{
            left: `${position.startX}%`,
            top: `${position.startY}%`,
            width: 50,
            height: 2,
            background: 'linear-gradient(90deg, transparent 0%, hsl(0 0% 100% / 0.9) 20%, hsl(var(--cosmic-shooting-star) / 0.8) 100%)',
            borderRadius: 1,
            transformOrigin: 'left center',
          }}
          initial={{
            scaleX: 0,
            opacity: 0,
            rotate: position.angle,
            x: 0,
            y: 0,
          }}
          animate={{
            scaleX: [0, 1, 1, 0.5],
            opacity: [0, 1, 0.8, 0],
            x: [0, 60, 100],
            y: [0, 40, 70],
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      )}
    </AnimatePresence>
  );
}
