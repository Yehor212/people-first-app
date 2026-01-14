// Task Momentum Algorithm for ADHD-friendly task prioritization
// Prioritizes tasks based on urgency, duration, and interest level

export interface Task {
  id: string;
  name: string;
  description?: string;
  urgent: boolean;
  estimatedMinutes: number;
  userRating?: number; // 1-10 interest level
  completed: boolean;
  dueDate?: string;
  category?: string;
}

export interface PrioritizedTask extends Task {
  momentumScore: number;
  reasoning: string;
  encouragement: string;
}

/**
 * Prioritize tasks using ADHD-friendly algorithm
 *
 * Algorithm weights:
 * 1. Urgency: 10 points for urgent tasks
 * 2. Duration: Up to 30 points (shorter tasks score higher)
 * 3. Interest: Up to 10 points (user rating)
 *
 * This creates "quick wins" to build momentum
 */
export function prioritizeForADHD(tasks: Task[]): PrioritizedTask[] {
  const incompleteTasks = tasks.filter(t => !t.completed);

  return incompleteTasks
    .map(task => {
      // 1. Urgency score (weight: 10)
      const urgencyScore = task.urgent ? 10 : 0;

      // 2. Duration score (weight: up to 30)
      // Shorter tasks get higher scores (ADHD-friendly "quick wins")
      const maxMinutes = 120; // 2 hours
      const duration = Math.min(task.estimatedMinutes, maxMinutes);
      const durationScore = Math.max(0, 30 - (duration / maxMinutes) * 30);

      // 3. Interest score (weight: up to 10)
      // Higher interest = more dopamine = better for ADHD
      const interestScore = task.userRating || 5;

      // 4. Due date proximity score (weight: up to 15)
      let dueDateScore = 0;
      if (task.dueDate) {
        const daysUntilDue = getDaysUntilDue(task.dueDate);
        if (daysUntilDue <= 1) {
          dueDateScore = 15; // Due today or tomorrow
        } else if (daysUntilDue <= 3) {
          dueDateScore = 10; // Due this week
        } else if (daysUntilDue <= 7) {
          dueDateScore = 5; // Due next week
        }
      }

      // Final momentum score
      const momentumScore = urgencyScore + durationScore + interestScore + dueDateScore;

      // Generate reasoning
      const reasoning = generateReasoning(task, {
        urgencyScore,
        durationScore,
        interestScore,
        dueDateScore,
      });

      // Generate encouragement
      const encouragement = generateEncouragement(task, momentumScore);

      return {
        ...task,
        momentumScore,
        reasoning,
        encouragement,
      };
    })
    .sort((a, b) => b.momentumScore - a.momentumScore);
}

/**
 * Get suggested "next 3 tasks" for ADHD focus
 */
export function getNextThreeTasks(tasks: Task[]): PrioritizedTask[] {
  const prioritized = prioritizeForADHD(tasks);
  return prioritized.slice(0, 3);
}

/**
 * Get "quick win" tasks (under 15 minutes)
 */
export function getQuickWins(tasks: Task[]): PrioritizedTask[] {
  const prioritized = prioritizeForADHD(tasks);
  return prioritized.filter(t => t.estimatedMinutes <= 15);
}

/**
 * Calculate momentum bonus based on consecutive completions
 */
export function calculateMomentumBonus(consecutiveCompletions: number): {
  xpBonus: number;
  streakMultiplier: number;
  message: string;
} {
  if (consecutiveCompletions === 0) {
    return {
      xpBonus: 0,
      streakMultiplier: 1,
      message: 'Start your momentum streak!',
    };
  }

  if (consecutiveCompletions >= 10) {
    return {
      xpBonus: 100,
      streakMultiplier: 3,
      message: '🔥 UNSTOPPABLE! 10+ tasks in a row!',
    };
  }

  if (consecutiveCompletions >= 5) {
    return {
      xpBonus: 50,
      streakMultiplier: 2,
      message: '⚡ ON FIRE! Keep the momentum going!',
    };
  }

  if (consecutiveCompletions >= 3) {
    return {
      xpBonus: 25,
      streakMultiplier: 1.5,
      message: '💪 Great momentum! You\'re crushing it!',
    };
  }

  return {
    xpBonus: 10,
    streakMultiplier: 1.2,
    message: '✨ Building momentum! Keep going!',
  };
}

/**
 * Helper: Calculate days until due date
 */
function getDaysUntilDue(dueDate: string): number {
  const due = new Date(dueDate);
  const today = new Date();
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Helper: Generate reasoning for task priority
 */
function generateReasoning(
  task: Task,
  scores: {
    urgencyScore: number;
    durationScore: number;
    interestScore: number;
    dueDateScore: number;
  }
): string {
  const reasons: string[] = [];

  if (scores.urgencyScore > 0) {
    reasons.push('Marked as urgent');
  }

  if (task.estimatedMinutes <= 15) {
    reasons.push('Quick win (under 15 min)');
  } else if (task.estimatedMinutes <= 30) {
    reasons.push('Short task (under 30 min)');
  }

  if (task.userRating && task.userRating >= 8) {
    reasons.push('High interest level');
  }

  if (task.dueDate) {
    const days = getDaysUntilDue(task.dueDate);
    if (days <= 1) {
      reasons.push('Due today/tomorrow');
    } else if (days <= 3) {
      reasons.push('Due this week');
    }
  }

  if (reasons.length === 0) {
    return 'Good task to tackle';
  }

  return reasons.join(' • ');
}

/**
 * Helper: Generate ADHD-friendly encouragement
 */
function generateEncouragement(task: Task, score: number): string {
  if (task.estimatedMinutes <= 5) {
    return '⚡ Just 5 minutes! You got this!';
  }

  if (task.estimatedMinutes <= 15) {
    return '💪 Quick win incoming! Let\'s do this!';
  }

  if (task.urgent) {
    return '🎯 Time to crush this! You can handle it!';
  }

  if (task.userRating && task.userRating >= 8) {
    return '✨ This one sounds fun! Enjoy the process!';
  }

  if (score >= 50) {
    return '🔥 Perfect task for right now! Go for it!';
  }

  if (score >= 30) {
    return '👍 Good choice! You\'re building momentum!';
  }

  return '🌟 One step at a time. You\'re doing great!';
}

/**
 * Get tasks grouped by "2-minute rule" principle
 */
export function getTwoMinuteTasks(tasks: Task[]): {
  immediate: PrioritizedTask[]; // Under 2 minutes
  quick: PrioritizedTask[]; // 2-15 minutes
  focused: PrioritizedTask[]; // 15-60 minutes
  deep: PrioritizedTask[]; // 60+ minutes
} {
  const prioritized = prioritizeForADHD(tasks);

  return {
    immediate: prioritized.filter(t => t.estimatedMinutes <= 2),
    quick: prioritized.filter(t => t.estimatedMinutes > 2 && t.estimatedMinutes <= 15),
    focused: prioritized.filter(t => t.estimatedMinutes > 15 && t.estimatedMinutes <= 60),
    deep: prioritized.filter(t => t.estimatedMinutes > 60),
  };
}

/**
 * Suggest best task based on current time and energy
 */
export function suggestTaskForNow(
  tasks: Task[],
  currentHour: number,
  energyLevel: 'low' | 'medium' | 'high'
): PrioritizedTask | null {
  const prioritized = prioritizeForADHD(tasks);

  if (prioritized.length === 0) {
    return null;
  }

  // Morning (6-12): High-priority tasks
  if (currentHour >= 6 && currentHour < 12) {
    const urgentTasks = prioritized.filter(t => t.urgent);
    if (urgentTasks.length > 0) {
      return urgentTasks[0];
    }
  }

  // Afternoon (12-18): Medium tasks
  if (currentHour >= 12 && currentHour < 18) {
    const mediumTasks = prioritized.filter(
      t => t.estimatedMinutes >= 15 && t.estimatedMinutes <= 45
    );
    if (mediumTasks.length > 0) {
      return mediumTasks[0];
    }
  }

  // Evening (18-22): Quick tasks or high-interest tasks
  if (currentHour >= 18 && currentHour < 22) {
    if (energyLevel === 'low') {
      const quickTasks = prioritized.filter(t => t.estimatedMinutes <= 15);
      if (quickTasks.length > 0) {
        return quickTasks[0];
      }
    }
    const funTasks = prioritized.filter(t => (t.userRating || 0) >= 7);
    if (funTasks.length > 0) {
      return funTasks[0];
    }
  }

  // Default: Return highest priority task
  return prioritized[0];
}
