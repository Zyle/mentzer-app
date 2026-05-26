import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Controls how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ── Permission + token registration ──────────────────────────────────────────
// Call once after the user authenticates.
//
// Option B upgrade path: uncomment the token lines and pass userId,
// then save the token to profiles.push_token — the edge function handles
// scheduling from there and you can remove scheduleRecoveryNotifications().
export async function registerForPushNotifications(/* userId */) {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('recovery', {
      name: 'Recovery Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      sound: true,
    });
  }

  // Option B: uncomment to capture and persist the Expo push token
  // const { data: token } = await Notifications.getExpoPushTokenAsync();
  // await supabase.from('profiles').update({ push_token: token }).eq('id', userId);

  return true;
}

// ── Schedule local recovery notifications ────────────────────────────────────
// Call when the user finishes a workout. Replaces any previously scheduled
// notifications so multiple workouts never stack up.
//
// Option B upgrade path: delete this function entirely. The edge function
// running on pg_cron takes over responsibility for sending at these windows.
export async function scheduleRecoveryNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = Date.now();

  // Day 4 — 96h — Mentzer minimum ready
  await Notifications.scheduleNotificationAsync({
    identifier: 'recovery-day4',
    content: {
      title: "YOU'RE READY TO TRAIN",
      body: 'Day 4 reached. Mentzer minimum recovery complete. Get back in the gym.',
      sound: true,
    },
    trigger: { type: 'date', date: new Date(now + 96 * 3_600_000) },
  });

  // Day 5.5 — 132h — Peak supercompensation
  await Notifications.scheduleNotificationAsync({
    identifier: 'recovery-peak',
    content: {
      title: 'PEAK SUPERCOMPENSATION',
      body: 'Your muscles are at peak strength. Train today for maximum gains.',
      sound: true,
    },
    trigger: { type: 'date', date: new Date(now + 132 * 3_600_000) },
  });
}

// Cancel all pending recovery notifications (e.g. if user deletes account)
export async function cancelRecoveryNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
