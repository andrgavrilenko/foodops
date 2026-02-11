import { AppError, ErrorCodes } from './errors.js';

export function getNextMonday(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysUntilMonday = day === 1 ? 0 : (8 - day) % 7 || 7;
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() + daysUntilMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

export function parseWeekStart(dateStr?: string): Date {
  if (!dateStr) return getNextMonday();

  const date = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(date.getTime())) {
    throw new AppError('Invalid date format', 400, ErrorCodes.MENU_INVALID_WEEK_START);
  }

  // Must be a Monday (0=Sun, 1=Mon, ...)
  if (date.getUTCDay() !== 1) {
    throw new AppError('week_start must be a Monday', 400, ErrorCodes.MENU_INVALID_WEEK_START);
  }

  return date;
}
