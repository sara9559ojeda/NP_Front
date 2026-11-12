import { useEffect, useRef, useState } from 'react';
import type { Device, PairingCode } from '../api/types';

export type PairingWatch =
  | { status: 'idle' }
  /** The code is on screen; `offline` while the last check failed and a retry is scheduled. */
  | { status: 'waiting'; offline: boolean }
  | { status: 'paired'; device: Device }
  | { status: 'expired' };

export const PAIRING_POLL_MS = 3000;
const MAX_RETRY_MS = 15000;

/**
 * Watches the headset list while a pairing code is valid (§6.1) and reports the headset that used it.
 *
 * - One request at a time: the next check is scheduled only after the previous one settles.
 * - Paused while the tab is hidden; checks again as soon as it is visible or the network returns.
 * - On network errors it backs off (3 s, 6 s, 12 s, 15 s) instead of hammering the API.
 * - When the code expires it checks one last time, so a headset paired in the final seconds is shown.
 * - Stops for good once a new active headset appears, the code expires or the component unmounts.
 */
export function usePairingWatch(
  code: PairingCode | null,
  listDevices: (() => Promise<Device[]>) | undefined,
  intervalMs = PAIRING_POLL_MS,
): PairingWatch {
  const [state, setState] = useState<PairingWatch>({ status: 'idle' });
  const listRef = useRef(listDevices);
  listRef.current = listDevices;
  const enabled = Boolean(listDevices);

  useEffect(() => {
    if (!code || !enabled) {
      setState({ status: 'idle' });
      return;
    }
    const expiresAt = new Date(code.expiresAt).getTime();
    let cancelled = false;
    let inFlight = false;
    let timer: number | undefined;
    let failures = 0;
    // Headsets that were already active when the code appeared; anything else is the new one.
    let known: Set<string> | null = null;

    setState({ status: 'waiting', offline: false });

    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(check, Math.max(0, ms));
    };

    const finish = (next: PairingWatch) => {
      cancelled = true;
      window.clearTimeout(timer);
      setState(next);
    };

    async function check() {
      const list = listRef.current;
      if (cancelled || inFlight || !list) return;
      const expired = Date.now() >= expiresAt;
      // Hidden tab: wait for `visibilitychange` (the final check after expiry still runs then).
      if (document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        const active = (await list()).filter((device) => !device.revokedAt);
        if (cancelled) return;
        failures = 0;
        const fresh = known && active.find((device) => !known!.has(device.deviceId));
        if (fresh) return finish({ status: 'paired', device: fresh });
        known ??= new Set(active.map((device) => device.deviceId));
        if (expired) return finish({ status: 'expired' });
        setState((current) => (current.status === 'waiting' && !current.offline ? current : { status: 'waiting', offline: false }));
        schedule(Math.min(intervalMs, expiresAt - Date.now()));
      } catch {
        if (cancelled) return;
        if (expired) return finish({ status: 'expired' });
        failures += 1;
        setState({ status: 'waiting', offline: true });
        schedule(Math.min(intervalMs * 2 ** (failures - 1), MAX_RETRY_MS, expiresAt - Date.now()));
      } finally {
        inFlight = false;
      }
    }

    const resume = () => {
      if (document.visibilityState === 'visible') schedule(0);
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    schedule(0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
    };
  }, [code, enabled, intervalMs]);

  return state;
}
