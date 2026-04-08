import { addMinutes } from 'date-fns';
import { formatInTimeZone, toDate } from 'date-fns-tz';

export const BOOKING_TZ = 'America/New_York';

export function etYmdNow(): string {
  return formatInTimeZone(new Date(), BOOKING_TZ, 'yyyy-MM-dd');
}

/** Interpret ymd + hh:mm as a wall-clock instant in Eastern Time → UTC Date */
export function etWallToUtc(ymd: string, hhmm: string): Date {
  const parts = hhmm.split(':');
  const h = (parts[0] ?? '0').padStart(2, '0');
  const m = (parts[1] ?? '0').padStart(2, '0');
  const s = `${ymd}T${h}:${m}:00`;
  return toDate(s, { timeZone: BOOKING_TZ });
}

/** Sunday = 0 … Saturday = 6 (calendar date ymd in Eastern) */
export function weekdaySun0Et(ymd: string): number {
  const noon = etWallToUtc(ymd, '12:00');
  const iso = parseInt(formatInTimeZone(noon, BOOKING_TZ, 'i'), 10);
  return iso === 7 ? 0 : iso;
}

export type WeekdayRule = {
  weekday: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
};

export type SlotInterval = 15 | 30 | 60;

function timeToMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

export function buildSlotsForDay(
  ymd: string,
  rule: WeekdayRule | undefined,
  intervalMin: SlotInterval,
  booked: { start: Date; end: Date }[],
): { startsAt: Date; endsAt: Date }[] {
  if (!rule?.enabled) return [];

  const startM = timeToMinutes(rule.start_time);
  const endM = timeToMinutes(rule.end_time);
  if (endM <= startM) return [];

  const slots: { startsAt: Date; endsAt: Date }[] = [];
  for (let cur = startM; cur + intervalMin <= endM; cur += intervalMin) {
    const hh = String(Math.floor(cur / 60)).padStart(2, '0');
    const mm = String(cur % 60).padStart(2, '0');
    const startsAt = etWallToUtc(ymd, `${hh}:${mm}`);
    const endsAt = addMinutes(startsAt, intervalMin);

    const startMs = startsAt.getTime();
    const endMs = endsAt.getTime();
    const now = Date.now();
    if (startMs < now - 60 * 1000) continue;

    const overlap = booked.some(
      (b) => startMs < b.end.getTime() && endMs > b.start.getTime(),
    );
    if (overlap) continue;

    slots.push({ startsAt, endsAt });
  }
  return slots;
}

export function formatEtSlot(d: Date): string {
  return formatInTimeZone(d, BOOKING_TZ, "EEE MMM d, yyyy 'at' h:mm a zzz");
}
