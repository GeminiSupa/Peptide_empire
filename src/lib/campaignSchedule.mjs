import { nextWindowOpening, readSendWindow, withinSendWindow } from './broadcastPacing.mjs';

/**
 * A campaign only mails people during Costa Rica sending hours. A time picked
 * outside them used to be saved as typed, shown as "scheduled" for that time,
 * and then quietly pushed to the next morning by the cron when it came due —
 * so the screen promised a time the mail never went out at.
 *
 * This moves the time at save, so what the admin sees is what will happen, and
 * says whether it moved so the screen can tell them.
 *
 * @param {string|null|undefined} iso the requested send time (UTC instant)
 * @param {{startHour?: number, endHour?: number}} hours the sending hours in
 *        Costa Rica time, start inclusive and end exclusive
 * @returns {{scheduledFor: string|null, moved: boolean, window: {start: number, end: number}|null}}
 */
export function sendingWindow({ startHour, endHour } = {}) {
  return readSendWindow({ send_window_start_hour: startHour, send_window_end_hour: endHour });
}

export function fitToSendingHours(iso, hours = {}) {
  const window = sendingWindow(hours);
  const ms = Date.parse(iso);
  if (!iso || !Number.isFinite(ms)) return { scheduledFor: iso || null, moved: false, window };
  if (!window || withinSendWindow(window, ms)) {
    return { scheduledFor: new Date(ms).toISOString(), moved: false, window };
  }
  return { scheduledFor: new Date(nextWindowOpening(window, ms)).toISOString(), moved: true, window };
}
