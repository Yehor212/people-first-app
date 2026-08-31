package com.zenflow.app;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Activity-local ownership snapshot for the Android Back bridge.
 *
 * A recreated Activity initially delegates Back to Android. JavaScript first
 * attaches its non-retaining listener, then republishes the hydrated owner.
 * This prevents a pre-listener Back from being trapped or replayed later.
 */
public final class AndroidBackNavigationState {

    private final AtomicBoolean canConsume = new AtomicBoolean(false);
    private final AtomicBoolean hasVisibleLayer = new AtomicBoolean(false);
    private final AtomicLong revision = new AtomicLong(0);

    public boolean canConsume() {
        return canConsume.get();
    }

    public boolean hasVisibleLayer() {
        return hasVisibleLayer.get();
    }

    public long revision() {
        return revision.get();
    }

    public long update(boolean nextCanConsume, boolean nextHasVisibleLayer) {
        canConsume.set(nextCanConsume);
        hasVisibleLayer.set(nextHasVisibleLayer);
        return revision.incrementAndGet();
    }
}
