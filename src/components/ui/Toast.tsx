import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

const VISIBLE_MS = 2400;
const FADE_MS = 300;

type ShowToast = (message: string) => void;

const ToastContext = createContext<ShowToast | null>(null);

/**
 * Brief confirmation after an action that also shows its result on the page
 * ("Nota guardada"). The live region is always mounted so screen readers announce it.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };

  const show = useCallback<ShowToast>((text) => {
    clearTimers();
    setMessage(text);
    setVisible(true);
    timers.current.push(
      window.setTimeout(() => setVisible(false), VISIBLE_MS),
      window.setTimeout(() => setMessage(''), VISIBLE_MS + FADE_MS),
    );
  }, []);

  useEffect(() => clearTimers, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={`toast${visible ? ' toast--visible' : ''}`} role="status" aria-live="polite">
        {message}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
