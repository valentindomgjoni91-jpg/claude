const PERM_KEY = 'craftsman_notif_enabled';

export function getNotificationsEnabled(): boolean {
  return localStorage.getItem(PERM_KEY) === '1';
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'denied') return false;

  if (Notification.permission !== 'granted') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') return false;
  }

  localStorage.setItem(PERM_KEY, '1');
  return true;
}

export function disableNotifications(): void {
  localStorage.removeItem(PERM_KEY);
}

export function showNotification(title: string, body?: string): void {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!getNotificationsEnabled()) return;
  try {
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
    });
  } catch {
    // Notification may fail in some environments — silent
  }
}
