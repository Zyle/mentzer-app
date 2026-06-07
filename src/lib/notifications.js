import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications() {
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

  return true;
}

// ── Recovery notifications ────────────────────────────────────────────────────
export async function scheduleRecoveryNotifications() {
  await Notifications.cancelScheduledNotificationAsync('recovery-day4').catch(() => {});
  await Notifications.cancelScheduledNotificationAsync('recovery-peak').catch(() => {});

  const now = Date.now();

  await Notifications.scheduleNotificationAsync({
    identifier: 'recovery-day4',
    content: {
      title: "YOU'RE READY TO TRAIN",
      body: 'Day 4 reached. Mentzer minimum recovery complete. Get back in the gym.',
      sound: true,
      data: { type: 'recovery' },
    },
    trigger: { type: 'date', date: new Date(now + 96 * 3_600_000) },
  });

  await Notifications.scheduleNotificationAsync({
    identifier: 'recovery-peak',
    content: {
      title: 'PEAK SUPERCOMPENSATION',
      body: 'Your muscles are at peak strength. Train today for maximum gains.',
      sound: true,
      data: { type: 'recovery' },
    },
    trigger: { type: 'date', date: new Date(now + 132 * 3_600_000) },
  });
}

export async function cancelRecoveryNotifications() {
  await Notifications.cancelScheduledNotificationAsync('recovery-day4').catch(() => {});
  await Notifications.cancelScheduledNotificationAsync('recovery-peak').catch(() => {});
}

// ── Bi-weekly weight check-in reminder ───────────────────────────────────────
export async function scheduleWeightCheckinReminder() {
  await Notifications.cancelScheduledNotificationAsync('weight-checkin').catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: 'weight-checkin',
    content: {
      title: 'LOG YOUR WEIGHT',
      body: 'Time for your bi-weekly weigh-in. Keep your nutrition targets accurate.',
      sound: true,
      data: { type: 'checkin' },
    },
    trigger: {
      seconds: 14 * 24 * 60 * 60, // 14 days
      repeats: true,
    },
  });
}

export async function cancelWeightCheckinReminder() {
  await Notifications.cancelScheduledNotificationAsync('weight-checkin').catch(() => {});
}
