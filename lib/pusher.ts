import Pusher from 'pusher';

// Initialize Pusher server instance
export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || '',
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || '',
  secret: process.env.PUSHER_SECRET || '',
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2',
  useTLS: true,
});

let lastTriggerErrorLoggedAt = 0;
const TRIGGER_ERROR_LOG_INTERVAL_MS = 30_000;

/**
 * Broadcast a Pusher event without letting an outage or quota rejection (e.g. a
 * 403 when the app exceeds its message limits) bubble up and turn the request
 * into a 500. Returns true when the event was delivered. Failures are swallowed
 * and logged at most once per interval so a sustained outage can't flood logs
 * with hundreds of identical errors.
 */
export async function safeTrigger(
  channel: string | string[],
  event: string,
  data: unknown,
): Promise<boolean> {
  try {
    await pusher.trigger(channel, event, data);
    return true;
  } catch (error) {
    const now = Date.now();
    if (now - lastTriggerErrorLoggedAt > TRIGGER_ERROR_LOG_INTERVAL_MS) {
      lastTriggerErrorLoggedAt = now;
      const status = (error as { status?: number })?.status;
      console.error(
        `Pusher trigger failed for event "${event}"${status ? ` (status ${status})` : ''}. ` +
          'Further Pusher errors are suppressed for 30s. ' +
          'Check Pusher credentials, app status, and plan message limits.',
        error,
      );
    }
    return false;
  }
}

