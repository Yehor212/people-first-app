package com.zenflow.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class AndroidBackNavigationStateTest {

    @Test
    public void startsDelegatedUntilJavaScriptPublishesHydratedState() {
        AndroidBackNavigationState state = new AndroidBackNavigationState();

        assertFalse(state.canConsume());
        assertFalse(state.hasVisibleLayer());
        assertEquals(0, state.revision());
    }

    @Test
    public void rootDelegatesAndAnOverlayReenablesConsumption() {
        AndroidBackNavigationState state = new AndroidBackNavigationState();

        assertEquals(1, state.update(false, false));
        assertFalse(state.canConsume());
        assertEquals(2, state.update(true, true));
        assertTrue(state.canConsume());
        assertTrue(state.hasVisibleLayer());
    }

    @Test
    public void recreationDelegatesUntilJavaScriptRepublishesOwnership() {
        AndroidBackNavigationState priorActivity = new AndroidBackNavigationState();
        priorActivity.update(false, false);

        AndroidBackNavigationState recreatedActivity = new AndroidBackNavigationState();

        assertFalse(recreatedActivity.canConsume());
        assertFalse(recreatedActivity.hasVisibleLayer());
        assertEquals(0, recreatedActivity.revision());
    }
}
