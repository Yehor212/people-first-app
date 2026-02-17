import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { GratitudeEntry } from '@/types';

interface RecentEntriesProps {
  entries: GratitudeEntry[];
  label: string;
}

export function RecentEntries({ entries, label }: RecentEntriesProps) {
  if (entries.length === 0) return null;

  return (
    <div className="px-4 pb-4 space-y-2">
      <p className="text-sm text-muted-foreground">{label}:</p>
      {entries.map((entry, index) => (
        <motion.div
          key={entry.id}
          className={cn(
            'p-3 rounded-xl text-sm relative overflow-hidden cursor-default',
            'bg-gradient-to-r from-pink-500/12 via-pink-500/5 to-transparent',
            'border-s-2 border-pink-500/50'
          )}
          initial={{ opacity: 0, x: -15, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{
            delay: index * 0.08,
            type: 'spring',
            stiffness: 200,
            damping: 20,
          }}
          whileHover={{
            x: 4,
            backgroundColor: 'rgba(236, 72, 153, 0.12)',
            transition: { duration: 0.2 },
          }}
        >
          <motion.span
            className="text-pink-400 me-2"
            animate={{ scale: [1, 1.15, 1], rotate: [0, 8, -8, 0] }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              delay: index * 0.25,
              ease: 'easeInOut',
            }}
          >
            ✨
          </motion.span>
          <span className="text-foreground/80 line-clamp-2">{entry.text}</span>
        </motion.div>
      ))}
    </div>
  );
}
