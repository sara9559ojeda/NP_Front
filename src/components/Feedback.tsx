import { forwardRef, type ReactNode } from 'react';
import { errorMessage } from '../hooks/useApi';
import { t } from '../i18n';

export function Loading({ label }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}

type Tone = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}

/** Errors are announced right away (role=alert); the rest politely (role=status). */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert({ tone = 'info', title, children }, ref) {
  return (
    <div ref={ref} tabIndex={-1} className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {title && <p className="alert__title">{title}</p>}
      <div>{children}</div>
    </div>
  );
});

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Alert tone="error">
      <p>{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </Alert>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function PendingBadge() {
  return (
    <span className="badge badge--pending">
      <span aria-hidden="true" className="badge__dot" />
      {t('clinical.pending')}
    </span>
  );
}
