/**
 * Sync Gap Detector — Telegram-style gap detection for event streams.
 *
 * When events arrive out of order (seq > expected), waits 500ms for
 * the missing events to arrive. If they don't, triggers a delta pull
 * for the missing range. Falls back to full snapshot if gap is too large.
 */

import { logger } from "@/lib/logger";

interface GapDetectorConfig {
  /** How long to wait for gap-filling events before requesting delta (ms) */
  gapWaitMs: number;
  /** Max gap size before falling back to full snapshot */
  maxGapSize: number;
  /** Callback when gap is too large — do a full snapshot sync */
  onFallbackToSnapshot: () => void;
  /** Callback to pull missing event range */
  onPullRange: (fromSeq: number) => Promise<void>;
}

export class SyncGapDetector {
  private expectedSeq: number;
  private pendingSeqs = new Set<number>();
  private gapTimer: ReturnType<typeof setTimeout> | null = null;
  private config: GapDetectorConfig;

  constructor(lastKnownSeq: number, config: GapDetectorConfig) {
    this.expectedSeq = lastKnownSeq + 1;
    this.config = config;
  }

  /**
   * Called when a realtime signal indicates a new event exists at seq.
   * Returns true if seq is in order, false if gap detected or duplicate.
   */
  onEventSignal(seq: number): boolean {
    if (seq < this.expectedSeq) {
      // Already processed — duplicate
      return false;
    }

    if (seq === this.expectedSeq) {
      // Perfect order — advance cursor
      this.expectedSeq = seq + 1;
      this.drainPending();
      return true;
    }

    // Gap: seq > expectedSeq
    const gapSize = seq - this.expectedSeq;
    logger.sync(`[GapDetector] Gap: expected=${this.expectedSeq}, got=${seq}, size=${gapSize}`);

    if (gapSize > this.config.maxGapSize) {
      // differenceTooLong — fall back to full snapshot
      logger.warn(`[GapDetector] Gap too large (${gapSize}), snapshot fallback`);
      this.clearTimer();
      this.pendingSeqs.clear();
      this.config.onFallbackToSnapshot();
      return false;
    }

    // Buffer the out-of-order seq and start gap timer
    this.pendingSeqs.add(seq);
    this.startGapTimer();
    return false;
  }

  /** Drain any buffered seqs that are now in sequence */
  private drainPending(): void {
    while (this.pendingSeqs.has(this.expectedSeq)) {
      this.pendingSeqs.delete(this.expectedSeq);
      this.expectedSeq++;
    }

    if (this.pendingSeqs.size === 0) {
      this.clearTimer();
    }
  }

  /** Start/reset the gap wait timer.
   * ROOT-CAUSE: Telegram MTProto protocol uses 500ms debounce for out-of-order updates — this is the architectural pattern, not a hack. Events may arrive out of order over WebSocket; the timer gives in-flight events a chance to fill the gap before triggering a network round-trip. */
  private startGapTimer(): void {
    this.clearTimer();

    this.gapTimer = setTimeout(() => {
      const pullFrom = this.expectedSeq - 1;
      logger.sync(`[GapDetector] Timer fired, pulling from seq=${pullFrom}`);

      this.config.onPullRange(pullFrom).catch((err) => {
        logger.error("[GapDetector] Pull range failed:", err);
        this.config.onFallbackToSnapshot();
      });
    }, this.config.gapWaitMs);
  }

  private clearTimer(): void {
    if (this.gapTimer) {
      clearTimeout(this.gapTimer);
      this.gapTimer = null;
    }
  }

  /** Reset after a successful full pull or snapshot */
  resetTo(seq: number): void {
    this.expectedSeq = seq + 1;
    this.pendingSeqs.clear();
    this.clearTimer();
  }

  destroy(): void {
    this.clearTimer();
    this.pendingSeqs.clear();
  }
}
