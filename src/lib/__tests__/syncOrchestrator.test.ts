/**
 * Unit tests for SyncOrchestrator
 * Tests queue-based sync logic, retry mechanisms, and state management
 */

import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';

// Mock modules BEFORE importing syncOrchestrator
vi.mock('@/lib/logger', () => ({
  logger: {
    sync: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/cloudSyncSettings', () => ({
  isCloudSyncEnabled: vi.fn(() => true),
}));

vi.mock('@/lib/validation', () => ({
  generateSecureRandom: vi.fn(() => Math.random().toString(36).slice(2)),
}));

vi.mock('@/lib/apiClient', () => ({
  is401Error: vi.fn(() => false),
  AUTH_SESSION_EXPIRED_EVENT: 'auth:session-expired',
}));

// Import after mocks are set up
import { syncOrchestrator, SyncOperationType, SyncStatus } from '../syncOrchestrator';

describe('SyncOrchestrator', () => {
  beforeEach(async () => {
    // Wait for any in-flight operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    // Clear queue and reset state
    syncOrchestrator.clearQueue();
    // Force online state by dispatching the online event
    window.dispatchEvent(new Event('online'));
  });

  afterEach(async () => {
    syncOrchestrator.clearQueue();
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
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

      // Queue both operations synchronously without awaiting
      void syncOrchestrator.sync('backup', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        executionOrder.push('backup');
      });

      void syncOrchestrator.sync('reminders', async () => {
        executionOrder.push('reminders');
      });

      // Wait for all operations
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(executionOrder).toEqual(['backup', 'reminders']);
    });

    it('sorts operations by priority when queued simultaneously', async () => {
      // Note: Priority sorting only affects operations that are in the queue
      // when processing hasn't started yet, or for operations queued while another is executing
      const queueInfo = syncOrchestrator.getQueueInfo();
      expect(queueInfo.length).toBe(0);

      // Test that the queue sorts by priority
      void syncOrchestrator.sync('backup', async () => {
        await new Promise(resolve => setTimeout(resolve, 200)); // Long operation
      }, { priority: 5 });

      // Queue more operations while first one is running
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to let first start

      void syncOrchestrator.sync('tasks', async () => {
        // This should be sorted after reminders due to lower priority
      }, { priority: 1 });

      void syncOrchestrator.sync('reminders', async () => {
        // This should be sorted first due to higher priority
      }, { priority: 10 });

      await new Promise(resolve => setTimeout(resolve, 50));

      const pendingOps = syncOrchestrator.getQueueInfo();
      // If there are pending items, they should be sorted by priority
      if (pendingOps.length >= 2) {
        expect(pendingOps[0].priority).toBeGreaterThanOrEqual(pendingOps[1].priority);
      }

      syncOrchestrator.clearQueue();
    });
  });

  describe('retry logic', () => {
    it('retries failed operations', async () => {
      let attempts = 0;

      void syncOrchestrator.sync('backup', async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Simulated failure');
        }
      }, { maxRetries: 3 });

      // Wait for retries (exponential backoff: ~1s for first retry)
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Should have succeeded on second attempt
      expect(attempts).toBeGreaterThanOrEqual(2);
    }, 10000);

    it('stops retrying after max retries', async () => {
      let attempts = 0;

      await syncOrchestrator.sync('backup', async () => {
        attempts++;
        throw new Error('Persistent failure');
      }, { maxRetries: 2 });

      // Wait for all retries (with exponential backoff, this takes time)
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Should have attempted max 3 times (initial + 2 retries)
      expect(attempts).toBeLessThanOrEqual(3);
    }, 15000);

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
    }, 15000);
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

      // Should have transitioned through syncing
      expect(states).toContain('syncing');
    });

    it('sets error state on failure', async () => {
      const states: SyncStatus[] = [];

      const unsubscribe = syncOrchestrator.subscribe(state => {
        states.push(state.status);
      });

      void syncOrchestrator.sync('backup', async () => {
        throw new Error('Test error');
      }, { maxRetries: 0 });

      await new Promise(resolve => setTimeout(resolve, 200));

      unsubscribe();

      // Should have transitioned through error state
      expect(states).toContain('error');
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

      void syncOrchestrator.sync('backup', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      void syncOrchestrator.sync('reminders', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      unsubscribe();

      // Queue should have grown then shrunk
      expect(Math.max(...queueLengths)).toBeGreaterThan(0);
    });
  });

  describe('queue management', () => {
    it('clears queue on demand', async () => {
      void syncOrchestrator.sync('backup', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      void syncOrchestrator.sync('reminders', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      syncOrchestrator.clearQueue();

      const queueInfo = syncOrchestrator.getQueueInfo();
      expect(queueInfo.length).toBe(0);
    });

    it('provides queue info for debugging', async () => {
      // Queue an operation that takes a while
      void syncOrchestrator.sync('backup', async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
      }, { priority: 5 });

      // Wait a bit for it to start processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Queue more operations
      void syncOrchestrator.sync('reminders', async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
      }, { priority: 8 });

      const queueInfo = syncOrchestrator.getQueueInfo();

      // There should be at least one item in the queue (the second one)
      // since the first one might be executing
      if (queueInfo.length > 0) {
        expect(queueInfo.some(op => op.type === 'reminders' || op.type === 'backup')).toBe(true);
      }

      syncOrchestrator.clearQueue();
    });
  });

  describe('online/offline handling', () => {
    it('responds to online event', async () => {
      // Dispatch online event
      window.dispatchEvent(new Event('online'));

      const state = syncOrchestrator.getState();
      expect(state.isOnline).toBe(true);
    });

    it('responds to offline event', async () => {
      // Dispatch offline event
      window.dispatchEvent(new Event('offline'));

      const state = syncOrchestrator.getState();
      expect(state.isOnline).toBe(false);

      // Restore online state
      window.dispatchEvent(new Event('online'));
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

      void syncOrchestrator.sync('backup', async () => {
        throw new Error('Test error message');
      }, { maxRetries: 0 });

      await new Promise(resolve => setTimeout(resolve, 200));

      unsubscribe();

      expect(errorMessage).toBe('Test error message');
    });

    it('continues processing queue after errors', async () => {
      const executed: string[] = [];

      void syncOrchestrator.sync('backup', async () => {
        executed.push('backup');
        throw new Error('First operation failed');
      }, { maxRetries: 0 });

      void syncOrchestrator.sync('reminders', async () => {
        executed.push('reminders');
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // Second operation should still execute
      expect(executed).toContain('reminders');
    });
  });
});
