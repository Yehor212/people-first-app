/**
 * Unit tests for SyncOrchestrator
 * Tests queue-based sync logic, retry mechanisms, and state management
 *
 * IMPORTANT: The SyncOrchestrator is a singleton with fire-and-forget processing.
 * Tests that queue long-running executors will block `isProcessing` until the
 * executor completes or the 45s operation timeout fires. Tests are ordered to
 * minimize interference between test groups.
 */

import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';

const authState = vi.hoisted<{ ownerUserId: string | null }>(() => ({
  ownerUserId: 'account-a',
}));

// Mock modules BEFORE importing syncOrchestrator
vi.mock('@/lib/logger', () => ({
  logger: {
    sync: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
  },
}));

vi.mock('@/lib/sentry', () => ({
  addCategorizedBreadcrumb: vi.fn(),
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

vi.mock('@/lib/supabaseClient', () => ({
  getCurrentSessionUserId: vi.fn(async () => authState.ownerUserId),
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
    },
  },
}));

// Import after mocks are set up
import { isCloudSyncEnabled } from '../cloudSyncSettings';
import { syncOrchestrator, type SyncOperationType, type SyncStatus } from '../syncOrchestrator';

/** Utility: wait for async processing to settle */
const settle = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms));

describe('SyncOrchestrator', () => {
  beforeEach(async () => {
    // Wait for any in-flight operations from previous tests
    await settle(100);
    // Clear queue and reset state
    syncOrchestrator.clearQueue();
    // Force online state
    window.dispatchEvent(new Event('online'));
    // Ensure cloud sync is enabled
    vi.mocked(isCloudSyncEnabled).mockReturnValue(true);
    authState.ownerUserId = 'account-a';
    (
      syncOrchestrator as unknown as { resumeAfterAccountBoundary?: () => void }
    ).resumeAfterAccountBoundary?.();
  });

  afterEach(async () => {
    syncOrchestrator.clearQueue();
    await syncOrchestrator.suspendForAccountBoundary();
    syncOrchestrator.resumeAfterAccountBoundary();
    vi.useRealTimers();
  });

  // ─── Queue Enqueue & Processing ───────────────────────────────

  describe('sync operation queueing', () => {
    it('queues sync operations', async () => {
      const executed: string[] = [];

      await syncOrchestrator.sync('backup', async () => {
        executed.push('backup');
      });

      await syncOrchestrator.sync('reminders', async () => {
        executed.push('reminders');
      });

      await settle(100);

      expect(executed).toContain('backup');
      expect(executed).toContain('reminders');
    });

    it('executes operations sequentially', async () => {
      const executionOrder: string[] = [];

      void syncOrchestrator.sync('backup', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        executionOrder.push('backup');
      }).catch(() => undefined);

      void syncOrchestrator.sync('reminders', async () => {
        executionOrder.push('reminders');
      }).catch(() => undefined);

      await settle(200);

      expect(executionOrder).toEqual(['backup', 'reminders']);
    });

    it('sorts operations by priority when queued simultaneously', async () => {
      const queueInfo = syncOrchestrator.getQueueInfo();
      expect(queueInfo.length).toBe(0);

      void syncOrchestrator.sync('backup', async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      }, { priority: 5 }).catch(() => undefined);

      await settle(10);

      void syncOrchestrator.sync('tasks', async () => {
        // low priority
      }, { priority: 1 }).catch(() => undefined);

      void syncOrchestrator.sync('reminders', async () => {
        // high priority
      }, { priority: 10 }).catch(() => undefined);

      await settle(50);

      const pendingOps = syncOrchestrator.getQueueInfo();
      if (pendingOps.length >= 2) {
        expect(pendingOps[0].priority).toBeGreaterThanOrEqual(pendingOps[1].priority);
      }

      syncOrchestrator.clearQueue();
    });

    it('skips sync when cloud sync is disabled', async () => {
      vi.mocked(isCloudSyncEnabled).mockReturnValue(false);

      const executed: string[] = [];
      await syncOrchestrator.sync('backup', async () => {
        executed.push('backup');
      });

      expect(executed).toEqual([]);
    });
  });

  // ─── State Management ─────────────────────────────────────────

  describe('state management', () => {
    it('updates state correctly during sync', async () => {
      const states: SyncStatus[] = [];

      const unsubscribe = syncOrchestrator.subscribe(state => {
        states.push(state.status);
      });

      await syncOrchestrator.sync('backup', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      await settle(200);

      unsubscribe();

      expect(states).toContain('syncing');
    });

    it('sets error state on failure', async () => {
      const states: SyncStatus[] = [];

      const unsubscribe = syncOrchestrator.subscribe(state => {
        states.push(state.status);
      });

      void syncOrchestrator.sync('backup', async () => {
        throw new Error('Test error');
      }, { maxRetries: 0 }).catch(() => undefined);

      await settle(200);

      unsubscribe();

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

      await settle(200);

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
      }).catch(() => undefined);

      void syncOrchestrator.sync('reminders', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      }).catch(() => undefined);

      await settle(300);

      unsubscribe();

      expect(Math.max(...queueLengths)).toBeGreaterThan(0);
    });
  });

  // ─── Subscriber Notification ──────────────────────────────────

  describe('subscriber notification', () => {
    it('immediately notifies new subscriber with current state', () => {
      const listener = vi.fn();
      const unsubscribe = syncOrchestrator.subscribe(listener);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ status: 'idle' }));

      unsubscribe();
    });

    it('stops notifying after unsubscribe', async () => {
      const listener = vi.fn();
      const unsubscribe = syncOrchestrator.subscribe(listener);

      unsubscribe();
      listener.mockClear();

      await syncOrchestrator.sync('backup', async () => {
        // no-op
      });

      await settle(200);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ─── Error Handling ───────────────────────────────────────────

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
      }, { maxRetries: 0 }).catch(() => undefined);

      await settle(200);

      unsubscribe();

      expect(errorMessage).toBe('Test error message');
    });

    it('continues processing queue after errors', async () => {
      const executed: string[] = [];

      void syncOrchestrator.sync('backup', async () => {
        executed.push('backup');
        throw new Error('First operation failed');
      }, { maxRetries: 0 }).catch(() => undefined);

      void syncOrchestrator.sync('reminders', async () => {
        executed.push('reminders');
      }).catch(() => undefined);

      await settle(200);

      expect(executed).toContain('reminders');
    });
  });

  // ─── Online/Offline Handling ──────────────────────────────────

  describe('online/offline handling', () => {
    it('responds to online event', () => {
      window.dispatchEvent(new Event('online'));
      expect(syncOrchestrator.getState().isOnline).toBe(true);
    });

    it('responds to offline event', () => {
      window.dispatchEvent(new Event('offline'));
      expect(syncOrchestrator.getState().isOnline).toBe(false);

      // Restore
      window.dispatchEvent(new Event('online'));
    });
  });

  // ─── Retry Logic ──────────────────────────────────────────────

  describe('retry logic', () => {
    it('retries failed operations', async () => {
      let attempts = 0;

      void syncOrchestrator.sync('backup', async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Simulated failure');
        }
      }, { maxRetries: 3 }).catch(() => undefined);

      // Wait for retries (exponential backoff: ~1s for first retry + jitter)
      await settle(4000);

      expect(attempts).toBeGreaterThanOrEqual(2);
    }, 10000);

    it('stops retrying after max retries', async () => {
      let attempts = 0;

      await expect(
        syncOrchestrator.sync('backup', async () => {
          attempts++;
          throw new Error('Persistent failure');
        }, { maxRetries: 2 })
      ).rejects.toThrow('Persistent failure');

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

      if (retryTimes.length >= 2) {
        const firstDelay = retryTimes[1] - retryTimes[0];
        const secondDelay = retryTimes.length >= 3 ? retryTimes[2] - retryTimes[1] : 0;

        if (secondDelay > 0) {
          expect(secondDelay).toBeGreaterThan(firstDelay);
        }
      }
    }, 15000);

    it('does not retry client errors (4xx, duplicate key, etc.)', async () => {
      let attempts = 0;

      await expect(
        syncOrchestrator.sync('backup', async () => {
          attempts++;
          throw new Error('422 Unprocessable Entity');
        }, { maxRetries: 3 })
      ).rejects.toThrow('422 Unprocessable Entity');

      // Client errors are NOT retried
      expect(attempts).toBe(1);
    }, 5000);
  });

  // ─── Queue Management ─────────────────────────────────────────
  // NOTE: These tests queue long-running executors. They are placed LAST
  // to avoid blocking isProcessing for subsequent tests.

  describe('account-bound operation contract', () => {
    it('rejects work stamped for a different authenticated owner before execution', async () => {
      authState.ownerUserId = 'account-b';
      const executor = vi.fn(async () => undefined);

      await expect(
        syncOrchestrator.sync('backup', executor, {
          expectedOwnerUserId: 'account-a',
          maxRetries: 0,
        })
      ).rejects.toThrow(/account boundary/i);

      expect(executor).not.toHaveBeenCalled();
    });

    it('rejects newly submitted work while account cleanup is suspended', async () => {
      await syncOrchestrator.suspendForAccountBoundary();
      const executor = vi.fn(async () => undefined);

      await expect(
        syncOrchestrator.sync('backup', executor, {
          expectedOwnerUserId: 'account-a',
          maxRetries: 0,
        })
      ).rejects.toThrow(/suspended|cleanup/i);

      expect(executor).not.toHaveBeenCalled();
    });

    it('keeps the sync promise pending until its executor actually completes', async () => {
      let releaseExecutor!: () => void;
      const executorGate = new Promise<void>(resolve => {
        releaseExecutor = resolve;
      });
      let syncSettled = false;

      const result = syncOrchestrator
        .sync('backup', async () => executorGate, {
          expectedOwnerUserId: 'account-a',
          maxRetries: 0,
        })
        .then(() => {
          syncSettled = true;
        });

      await settle(0);
      expect(syncSettled).toBe(false);

      releaseExecutor();
      await result;
      expect(syncSettled).toBe(true);
    });

    it('owner-stamps operations and waits for aborted account A executor unwind before boundary resolves', async () => {
      let context:
        | { ownerUserId: string; generation: number; signal: AbortSignal }
        | undefined;
      let releaseUnwind!: () => void;
      let queuedAccountAStarted = false;

      const activeOutcome = syncOrchestrator
        .sync(
          'backup',
          async executionContext => {
            context = executionContext;
            await new Promise<void>((_resolve, reject) => {
              executionContext.signal.addEventListener(
                'abort',
                () => {
                  releaseUnwind = () =>
                    reject(
                      executionContext.signal.reason instanceof Error
                        ? executionContext.signal.reason
                        : new Error('Account boundary aborted sync')
                    );
                },
                { once: true }
              );
            });
          },
          { expectedOwnerUserId: 'account-a', maxRetries: 0 }
        )
        .then(
          () => ({ status: 'fulfilled' as const }),
          error => ({ status: 'rejected' as const, error })
        );

      await vi.waitFor(() => {
        expect(context?.ownerUserId).toBe('account-a');
      });

      const queuedOutcome = syncOrchestrator
        .sync(
          'reminders',
          async () => {
            queuedAccountAStarted = true;
          },
          { expectedOwnerUserId: 'account-a', maxRetries: 0 }
        )
        .then(
          () => ({ status: 'fulfilled' as const }),
          error => ({ status: 'rejected' as const, error })
        );

      authState.ownerUserId = 'account-b';
      let boundarySettled = false;
      const boundary = (
        syncOrchestrator as unknown as { suspendForAccountBoundary: () => Promise<void> }
      )
        .suspendForAccountBoundary()
        .then(() => {
          boundarySettled = true;
        });

      await settle(0);
      expect(context?.signal.aborted).toBe(true);
      expect(boundarySettled).toBe(false);

      releaseUnwind();
      await boundary;

      expect(boundarySettled).toBe(true);
      expect(queuedAccountAStarted).toBe(false);
      await expect(activeOutcome).resolves.toMatchObject({ status: 'rejected' });
      await expect(queuedOutcome).resolves.toMatchObject({ status: 'rejected' });
    });

    it('aborts the executor on timeout and rejects only after the executor unwinds', async () => {
      vi.useFakeTimers();
      try {
        let signal: AbortSignal | undefined;
        let executorUnwound = false;

        const result = syncOrchestrator
          .sync(
            'backup',
            async executionContext => {
              signal = executionContext.signal;
              await new Promise<void>((_resolve, reject) => {
                executionContext.signal.addEventListener(
                  'abort',
                  () => {
                    executorUnwound = true;
                    reject(
                      executionContext.signal.reason instanceof Error
                        ? executionContext.signal.reason
                        : new Error('Timed out sync was aborted')
                    );
                  },
                  { once: true }
                );
              });
            },
            { expectedOwnerUserId: 'account-a', maxRetries: 0 }
          )
          .then(
            () => ({ status: 'fulfilled' as const, error: null }),
            error => ({ status: 'rejected' as const, error })
          );

        await vi.advanceTimersByTimeAsync(45_000);

        await expect(result).resolves.toMatchObject({
          status: 'rejected',
          error: expect.objectContaining({ message: expect.stringMatching(/timed out/i) }),
        });
        expect(signal?.aborted).toBe(true);
        expect(executorUnwound).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('rejects overflow back to the caller instead of silently dropping work', async () => {
      window.dispatchEvent(new Event('offline'));
      const queuedOutcomes: Array<Promise<unknown>> = [];

      for (let index = 0; index < 50; index += 1) {
        queuedOutcomes.push(
          syncOrchestrator
            .sync('tasks', async () => undefined, {
              expectedOwnerUserId: 'account-a',
              maxRetries: 0,
            })
            .catch(error => error)
        );
      }

      await expect(
        syncOrchestrator.sync('quests', async () => undefined, {
          expectedOwnerUserId: 'account-a',
          maxRetries: 0,
        })
      ).rejects.toThrow(/queue.*full|overflow/i);

      syncOrchestrator.clearQueue();
      window.dispatchEvent(new Event('online'));
      await Promise.all(queuedOutcomes);
    });
  });

  describe('queue management', () => {
    it('clears queue on demand', async () => {
      void syncOrchestrator.sync('backup', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      }).catch(() => undefined);

      void syncOrchestrator.sync('reminders', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      }).catch(() => undefined);

      syncOrchestrator.clearQueue();

      const queueInfo = syncOrchestrator.getQueueInfo();
      expect(queueInfo.length).toBe(0);
    });

    it('provides queue info for debugging', async () => {
      void syncOrchestrator.sync('backup', async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
      }, { priority: 5 }).catch(() => undefined);

      await settle(10);

      void syncOrchestrator.sync('reminders', async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
      }, { priority: 8 }).catch(() => undefined);

      const queueInfo = syncOrchestrator.getQueueInfo();

      if (queueInfo.length > 0) {
        expect(queueInfo.some(op => op.type === 'reminders' || op.type === 'backup')).toBe(true);
      }

      syncOrchestrator.clearQueue();
    });

    it('getState returns a copy (not the same reference)', () => {
      const state1 = syncOrchestrator.getState();
      const state2 = syncOrchestrator.getState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });
  });
});
