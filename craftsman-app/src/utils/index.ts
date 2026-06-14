import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd.MM.yyyy', { locale: de });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd.MM.yyyy HH:mm', { locale: de });
}

export function formatTime(time: string): string {
  return time.slice(0, 5);
}

export function calcTotalHours(startTime: string, endTime: string, breakMinutes = 0): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const rawMins = endMins - startMins;
  // Handle midnight-crossing shifts (e.g. 22:00 → 06:00)
  const adjustedMins = rawMins < 0 ? rawMins + 24 * 60 : rawMins;
  const totalMins = Math.max(0, adjustedMins - breakMinutes);
  return Math.round((totalMins / 60) * 100) / 100;
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h${m > 0 ? ` ${m}m` : ''}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function currentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export const WEATHER_LABELS: Record<string, string> = {
  sunny: '☀️ Sonnig',
  cloudy: '⛅ Bewölkt',
  rainy: '🌧️ Regnerisch',
  stormy: '⛈️ Stürmisch',
  foggy: '🌫️ Neblig',
  snowy: '❄️ Schnee',
};

export const UNITS = ['Stk', 'm', 'm²', 'm³', 'kg', 'to', 'l', 'h', 'Psch'];
