import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { ApiError } from '../api/client';
import type { Page } from '../api/types';
import { t, tDynamic } from '../i18n';

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return tDynamic(`error.${error.code}`, 'error.SERVER_ERROR');
  return t('error.SERVER_ERROR');
}

/** Field errors from a 422 problem+json, already turned into visible text. */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const result: Record<string, string> = {};
  for (const item of error.fieldErrors) {
    result[item.field] ??= tDynamic(`fieldError.${item.code}`, 'fieldError.default');
  }
  return result;
}

interface ApiState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
  setData: (data: T) => void;
}

export function useApi<T>(load: () => Promise<T>, deps: DependencyList): ApiState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadRef.current().then(
      (result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      },
      (err: unknown) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, loading, reload, setData };
}

interface PagedState<T> {
  items: T[];
  error: unknown;
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
}

/** Cursor pagination (§1): `{ items, nextCursor }`. */
export function usePaged<T>(load: (cursor: string | null) => Promise<Page<T>>, deps: DependencyList): PagedState<T> {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadRef.current(null).then(
      (page) => {
        if (!cancelled) {
          setItems(page.items);
          setCursor(page.nextCursor);
          setLoading(false);
        }
      },
      (err: unknown) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [...deps, version]);

  const loadMore = useCallback(() => {
    if (!cursor) return;
    setLoading(true);
    loadRef.current(cursor).then(
      (page) => {
        setItems((current) => [...current, ...page.items]);
        setCursor(page.nextCursor);
        setLoading(false);
      },
      (err: unknown) => {
        setError(err);
        setLoading(false);
      },
    );
  }, [cursor]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { items, error, loading, hasMore: cursor !== null, loadMore, reload };
}
