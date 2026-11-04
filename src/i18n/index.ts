import es from './es.json';

// Every visible text comes from es.json (key → text). Each key has its type, source and
// approval status in texts.meta.json; all of them are "pendiente de validar" until
// Sara approves them.
export type TextKey = keyof typeof es;
type Params = Record<string, string | number>;

const texts: Record<string, string> = es;

function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function t(key: TextKey, params?: Params): string {
  return interpolate(texts[key] ?? key, params);
}

export function hasText(key: string): key is TextKey {
  return key in texts;
}

/** For keys built from API values (error codes, enums). Falls back when the key is unknown. */
export function tDynamic(key: string, fallback: TextKey, params?: Params): string {
  return hasText(key) ? t(key, params) : t(fallback, params);
}

export const LOCALE = 'es-CO';

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return t('common.noData');
  return new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return t('common.noData');
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

export function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits }).format(value);
}

export function formatMinutes(seconds: number): string {
  return t('format.minutes', { n: Math.round(seconds / 60) });
}

export function formatPercent(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined) return t('common.noData');
  return t('format.percent', { n: Math.round(fraction * 100) });
}
