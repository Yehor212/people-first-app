package com.zenflow.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class AndroidBackNavigationStateTest {

    @Test
    public void startsConservativeUntilJavaScriptPublishesState() {
        AndroidBackNavigationState state = new AndroidBackNavigationState();
        assertTrue(state.canConsume());
        assertFalse(state.hasVisibleLayer());
    }

    @Test
    public void rootDelegatesToSystemAndOverlayReEnablesConsumption() {
        AndroidBackNavigationState state = new AndroidBackNavigationState();
        state.update(false);
        assertFalse(state.canConsume());
        state.update(true, true);
        assertTrue(state.canConsume());
        assertTrue(state.hasVisibleLayer());
    }

    @Test
    public void recreationReturnsToConservativeStateUntilJavaScriptHydrates() {
        AndroidBackNavigationState priorActivity = new AndroidBackNavigationState();
        priorActivity.update(false);

        AndroidBackNavigationState recreatedActivity = new AndroidBackNavigationState();
        assertTrue(recreatedActivity.canConsume());
        assertFalse(recreatedActivity.hasVisibleLayer());
    }
}
