import type { ReactNode, Ref } from 'react';
import { errorMessage } from '../../hooks/useApi';
import { t } from '../../i18n';

export function Loading({ label }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}

export type Tone = 'info' | 'success' | 'warning' | 'error';

function AlertIcon({ tone }: { tone: Tone }) {
  return (
    <svg className="alert__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {tone === 'success' ? (
        <path d="M5 12l4 4 10-10" />
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d={tone === 'info' ? 'M12 11v6M12 7.5v.5' : 'M12 7v6M12 16.5v.5'} />
        </>
      )}
    </svg>
  );
}

interface AlertProps {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/** Errors are announced right away (role=alert); the rest politely (role=status). */
export function Alert({ tone = 'info', title, children, ref }: AlertProps) {
  return (
    <div ref={ref} tabIndex={-1} className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <AlertIcon tone={tone} />
      <div className="alert__body">
        {title && <p className="alert__title">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Alert tone="error">
      <p>{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className="btn btn--sm" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </Alert>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

/** Every AI output carries this tag until a professional validates the method (§7). */
export function PendingTag() {
  return <span className="tag tag--pending">{t('clinical.pending')}</span>;
}
