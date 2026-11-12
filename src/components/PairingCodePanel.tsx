import { useEffect, useRef, useState } from 'react';
import { deviceModelLabel } from '../api/deviceModel';
import type { Device, PairingCode } from '../api/types';
import { errorMessage } from '../hooks/useApi';
import { usePairingWatch } from '../hooks/usePairingWatch';
import { formatTime, t } from '../i18n';
import { Alert } from './ui/Feedback';

function remaining(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function mmss(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

interface PairingCodePanelProps {
  create: () => Promise<PairingCode>;
  /** Lists the headsets; when given, the panel shows the headset as soon as it uses the code. */
  watchDevices?: () => Promise<Device[]>;
  onPaired?: (device: Device) => void;
}

/** Generates a single-use pairing code (§6.1), counts down its 10 minutes and confirms the pairing. */
export function PairingCodePanel({ create, watchDevices, onPaired }: PairingCodePanelProps) {
  const [code, setCode] = useState<PairingCode | null>(null);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [working, setWorking] = useState(false);
  const watch = usePairingWatch(code, watchDevices);
  const paired = watch.status === 'paired' ? watch.device : null;

  useEffect(() => {
    if (!code || paired) return;
    setLeft(remaining(code.expiresAt));
    const timer = window.setInterval(() => setLeft(remaining(code.expiresAt)), 1000);
    return () => window.clearInterval(timer);
  }, [code, paired]);

  // Once per paired headset, whatever the identity of the parent's callback.
  const onPairedRef = useRef(onPaired);
  onPairedRef.current = onPaired;
  useEffect(() => {
    if (paired) onPairedRef.current?.(paired);
  }, [paired]);

  const generate = async () => {
    setWorking(true);
    setError(null);
    try {
      const next = await create();
      setLeft(remaining(next.expiresAt));
      setCode(next);
    } catch (err) {
      setError(err);
    } finally {
      setWorking(false);
    }
  };

  // With the watcher the final check decides; without it, the countdown does.
  const expired = code !== null && !paired && (watch.status === 'expired' || (left === 0 && watch.status !== 'waiting'));
  const showCode = code !== null && !paired && !expired;

  return (
    <div className="pairing">
      {paired && (
        <div className="pairing__done" role="status" aria-live="polite">
          <svg className="pairing__check" width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
            <circle className="pairing__check-ring" cx="22" cy="22" r="20" />
            <path className="pairing__check-mark" d="M13.5 22.5l6 6 11-12" />
          </svg>
          <div className="pairing__done-body">
            <p className="pairing__done-title">{t('pairing.paired.title')}</p>
            <p className="pairing__done-model">{deviceModelLabel(paired.model)}</p>
            <p className="pairing__done-time">{t('pairing.paired.at', { time: formatTime(paired.pairedAt) })}</p>
            <p className="muted small">{t('pairing.paired.next')}</p>
          </div>
        </div>
      )}
      {showCode && (
        <div className="pairing__code" role="status" aria-live="polite">
          <p className="pairing__label">{t('pairing.title')}</p>
          <p className="pairing__value">
            <span aria-hidden="true">{code.code}</span>
            <span className="sr-only">{code.code.split('').join(' ')}</span>
          </p>
          <p className="pairing__timer">{t('pairing.expiresIn', { time: mmss(left) })}</p>
          <p className="muted">{t('pairing.instructions')}</p>
          {watch.status === 'waiting' && (
            <p className="pairing__watch" data-offline={watch.offline || undefined}>
              <span className="pairing__watch-dot" aria-hidden="true" />
              {watch.offline ? t('pairing.offline') : t('pairing.waiting')}
            </p>
          )}
        </div>
      )}
      {expired && <Alert tone="warning">{t('pairing.expired')}</Alert>}
      {Boolean(error) && <Alert tone="error">{errorMessage(error)}</Alert>}
      <button
        type="button"
        className={paired || showCode ? 'btn' : 'btn btn--primary'}
        onClick={generate}
        disabled={working}
        aria-busy={working || undefined}
      >
        {working && <span className="spinner spinner--inline" aria-hidden="true" />}
        {working ? t('common.loading') : code ? t('pairing.again') : t('pairing.generate')}
      </button>
    </div>
  );
}
