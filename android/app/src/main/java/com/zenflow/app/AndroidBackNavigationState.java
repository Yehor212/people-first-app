package com.zenflow.app;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Activity-recreation-safe default for the Android Back bridge.
 *
 * A new Activity starts conservative (consuming) until the hydrated JavaScript
 * shell explicitly proves that Android may own root back-to-home.
 */
public final class AndroidBackNavigationState {

    private final AtomicBoolean canConsume = new AtomicBoolean(true);
    private final AtomicBoolean hasVisibleLayer = new AtomicBoolean(false);

    public boolean canConsume() {
        return canConsume.get();
    }

    public void update(boolean nextCanConsume) {
        update(nextCanConsume, false);
    }

    public boolean hasVisibleLayer() {
        return hasVisibleLayer.get();
    }

    public void update(boolean nextCanConsume, boolean nextHasVisibleLayer) {
        canConsume.set(nextCanConsume);
        hasVisibleLayer.set(nextHasVisibleLayer);
    }
}
