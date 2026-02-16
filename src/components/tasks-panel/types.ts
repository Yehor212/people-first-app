import type { Task, PrioritizedTask } from '@/lib/taskMomentum';

export type { Task, PrioritizedTask };

export interface TasksPanelProps {
  onClose?: () => void;
  onAwardXp?: (source: string, amount: number) => void;
  onEarnTreats?: (source: string, amount: number, reason: string) => void;
}
