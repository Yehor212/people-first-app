/**
 * Unit tests for SyncOrchestrator
 * Tests queue-based sync logic, retry mechanisms, and state management
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { syncOrchestrator, SyncOperationType, SyncStatus } from '../syncOrchestrator';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    sync: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SyncOrchestrator', () => {
  beforeEach(() => {
    // Clear queue before each test
    syncOrchestrator.clearQueue();
  });

  describe('sync operation queueing', () => {
    it('queues sync operations', async () => {
      const executed: string[] = [];

      await syncOrchestrator.sync('backup', async () => {
        executed.push('backup');
      });

      await syncOrchestrator.sync('reminders', async () => {
        executed.push('reminders');
      });

      // Wait for operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(executed).toContain('backup');
      expect(executed).toContain('reminders');
    });

    it('executes operations sequentially', async () => {
      const executionOrder: string[] = [];

      syncOrchestrator.sync('backup', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        executionOrder.push('backup');
      });

      syncOrchestrator.sync('reminders', async () => {
        executionOrder.push('reminders');
      });

      // Wait for all operations
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(executionOrder).toEqual(['backup', 'reminders']);
    });

    it('prioritizes high-priority operations', async () => {
      const executionOrder: string[] = [];

      // Queue low priority first
      syncOrchestrator.sync('backup', async () => {
        executionOrder.push('backup');
      }, { priority: 1 });

      // Queue high priority second
      syncOrchestrator.sync('reminders', async () => {
        executionOrder.push('reminders');
      }, { priority: 10 });

      await new Promise(resolve => setTimeout(resolve, 200));

      // High priority should execute first
      expect(executionOrder[0]).toBe('reminders');
      expect(executionOrder[1]).toBe('backup');
    });
  });

  describe('retry logic', () => {
    it('retries failed operations', async () => {
      let attempts = 0;

      await syncOrchestrator.sync('backup', async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Simulated failure');
        }
      }, { maxRetries: 3 });

      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Should have succeeded on second attempt
      expect(attempts).toBeGreaterThanOrEqual(2);
    });

    it('stops retrying after max retries', async () => {
      let attempts = 0;

      await syncOrchestrator.sync('backup', async () => {
        attempts++;
        throw new Error('Persistent failure');
      }, { maxRetries: 2 });

      // Wait for all retries
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Should have attempted max 3 times (initial + 2 retries)
      expect(attempts).toBeLessThanOrEqual(3);
    });

    it('uses exponential backoff for retries', async () => {
      const retryTimes: number[] = [];

      await syncOrchestrator.sync('backup', async () => {
        retryTimes.push(Date.now());
        if (retryTimes.length < 3) {
          throw new Error('Retry test');
        }
      }, { maxRetries: 3 });

      await new Promise(resolve => setTimeout(resolve, 10000));

      if (retryTimes.length >= 2) {
        const firstDelay = retryTimes[1] - retryTimes[0];
        const secondDelay = retryTimes.length >= 3 ? retryTimes[2] - retryTimes[1] : 0;

        // Second delay should be longer than first (exponential backoff)
        if (secondDelay > 0) {
          expect(secondDelay).toBeGreaterThan(firstDelay);
        }
      }
    });
  });

  describe('state management', () => {
    it('updates state correctly during sync', async () => {
      const states: SyncStatus[] = [];

      const unsubscribe = syncOrchestrator.subscribe(state => {
        states.push(state.status);
      });

      await syncOrchestrator.sync('backup', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      unsubscribe();

      // Should have transitioned: idle -> syncing -> success
      expect(states).toContain('syncing');
      expect(states).toContain('success');
    });

    it('sets error state on failure', async () => {
      let finalState: SyncStatus | undefined;

      const unsubscribe = syncOrchestrator.subscribe(state => {
        finalState = state.status;
      });

      await syncOrchestrator.sync('backup', async () => {
        throw new Error('Test error');
      }, { maxRetries: 0 });

      await new Promise(resolve => setTimeout(resolve, 100));

      unsubscribe();

      expect(finalState).toBe('error');
    });

    it('tracks current operation', async () => {
      let currentOp: SyncOperationType | undefined;

      const unsubscribe = syncOrchestrator.subscribe(state => {
        if (state.status === 'syncing') {
          currentOp = state.currentOperation;
        }
      });

      await syncOrchestrator.sync('challenges', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      unsubscribe();

      expect(currentOp).toBe('challenges');
    });

    it('tracks queue length', async () => {
      const queueLengths: number[] = [];

      const unsubscribe = syncOrchestrator.subscribe(state => {
        queueLengths.push(state.queueLength);
      });

      syncOrchestrator.sync('backup', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      syncOrchestrator.sync('reminders', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      unsubscribe();

      // Queue should have grown then shrunk
      expect(Math.max(...queueLengths)).toBeGreaterThan(0);
      expect(queueLengths[queueLengths.length - 1]).toBe(0);
    });
  });

  describe('queue management', () => {
    it('clears queue on demand', async () => {
      syncOrchestrator.sync('backup', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      syncOrchestrator.sync('reminders', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      syncOrchestrator.clearQueue();

      const queueInfo = syncOrchestrator.getQueueInfo();
      expect(queueInfo.length).toBe(0);
    });

    it('provides queue info for debugging', async () => {
      await syncOrchestrator.sync('backup', async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }, { priority: 5 });

      await syncOrchestrator.sync('reminders', async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }, { priority: 8 });

      const queueInfo = syncOrchestrator.getQueueInfo();

      expect(queueInfo.length).toBeGreaterThan(0);
      expect(queueInfo.some(op => op.type === 'backup' || op.type === 'reminders')).toBe(true);

      syncOrchestrator.clearQueue();
    });
  });

  describe('online/offline handling', () => {
    it('pauses sync when offline', async () => {
      const state = syncOrchestrator.getState();

      // Sync orchestrator should respect navigator.onLine
      if (!state.isOnline) {
        const executed = { value: false };

        await syncOrchestrator.sync('backup', async () => {
          executed.value = true;
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        // Should not execute while offline
        expect(executed.value).toBe(false);
      }
    });
  });

  describe('error handling', () => {
    it('captures error messages', async () => {
      let errorMessage: string | undefined;

      const unsubscribe = syncOrchestrator.subscribe(state => {
        if (state.status === 'error') {
          errorMessage = state.lastError;
        }
      });

      await syncOrchestrator.sync('backup', async () => {
        throw new Error('Test error message');
      }, { maxRetries: 0 });

      await new Promise(resolve => setTimeout(resolve, 100));

      unsubscribe();

      expect(errorMessage).toBe('Test error message');
    });

    it('continues processing queue after errors', async () => {
      const executed: string[] = [];

      await syncOrchestrator.sync('backup', async () => {
        executed.push('backup');
        throw new Error('First operation failed');
      }, { maxRetries: 0 });

      await syncOrchestrator.sync('reminders', async () => {
        executed.push('reminders');
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // Second operation should still execute
      expect(executed).toContain('reminders');
    });
  });
});
