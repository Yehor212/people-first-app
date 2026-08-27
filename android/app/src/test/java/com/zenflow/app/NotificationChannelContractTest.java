package com.zenflow.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import android.app.NotificationManager;
import org.junit.Test;

public class NotificationChannelContractTest {
    @Test
    public void mapsFurinToAnAudibleVersionedReminderChannel() {
        NotificationChannelContract.Profile profile =
            NotificationChannelContract.profileFor("zenflow_furin_v5");

        assertEquals(NotificationManager.IMPORTANCE_DEFAULT, profile.importance());
        assertTrue(profile.vibration());
        assertEquals("zenflow_furin", profile.soundResourceName());
    }

    @Test
    public void preservesExistingDefaultGentleAndSilentProfiles() {
        NotificationChannelContract.Profile defaultProfile =
            NotificationChannelContract.profileFor("zenflow_default_v4");
        assertEquals(NotificationManager.IMPORTANCE_DEFAULT, defaultProfile.importance());
        assertEquals("default", defaultProfile.soundResourceName());

        NotificationChannelContract.Profile gentleProfile =
            NotificationChannelContract.profileFor("zenflow_gentle_v4");
        assertEquals(NotificationManager.IMPORTANCE_LOW, gentleProfile.importance());
        assertTrue(gentleProfile.vibration());
        assertNull(gentleProfile.soundResourceName());

        NotificationChannelContract.Profile silentProfile =
            NotificationChannelContract.profileFor("zenflow_silent_v4");
        assertEquals(NotificationManager.IMPORTANCE_MIN, silentProfile.importance());
        assertNull(silentProfile.soundResourceName());

        assertThrows(
            IllegalArgumentException.class,
            () -> NotificationChannelContract.profileFor("caller-channel")
        );
    }
}
