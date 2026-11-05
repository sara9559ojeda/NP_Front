import { useEffect, useState } from 'react';
import type { PairingCode } from '../api/types';
import { errorMessage } from '../hooks/useApi';
import { t } from '../i18n';
import { Alert } from './ui/Feedback';

function remaining(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function mmss(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Generates a single-use pairing code (§6.1) and counts down its 10 minutes. */
export function PairingCodePanel({ create }: { create: () => Promise<PairingCode> }) {
  const [code, setCode] = useState<PairingCode | null>(null);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!code) return;
    setLeft(remaining(code.expiresAt));
    const timer = window.setInterval(() => setLeft(remaining(code.expiresAt)), 1000);
    return () => window.clearInterval(timer);
  }, [code]);

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

  const expired = code !== null && left === 0;

  return (
    <div className="pairing">
      {code && !expired && (
        <div className="pairing__code" role="status" aria-live="polite">
          <p className="pairing__label">{t('pairing.title')}</p>
          <p className="pairing__value">
            <span aria-hidden="true">{code.code}</span>
            <span className="sr-only">{code.code.split('').join(' ')}</span>
          </p>
          <p className="pairing__timer">{t('pairing.expiresIn', { time: mmss(left) })}</p>
          <p className="muted">{t('pairing.instructions')}</p>
        </div>
      )}
      {expired && <Alert tone="warning">{t('pairing.expired')}</Alert>}
      {Boolean(error) && <Alert tone="error">{errorMessage(error)}</Alert>}
      <button type="button" className="btn btn--primary" onClick={generate} disabled={working}>
        {working ? t('common.loading') : t('pairing.generate')}
      </button>
    </div>
  );
}
