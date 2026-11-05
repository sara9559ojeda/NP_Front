import { t } from '../../i18n';

// Client-side checks mirror what the contract asks for; the backend validates again (§8).
export const PASSWORD_MIN_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requiredError(value: string): string | undefined {
  return value.trim() ? undefined : t('validation.required');
}

export function emailError(value: string): string | undefined {
  if (!value.trim()) return t('validation.required');
  return EMAIL_RE.test(value.trim()) ? undefined : t('validation.email');
}

export function passwordError(value: string): string | undefined {
  if (!value) return t('validation.required');
  return value.length >= PASSWORD_MIN_LENGTH ? undefined : t('validation.passwordLength');
}

export function matchError(value: string, other: string): string | undefined {
  if (!value) return t('validation.required');
  return value === other ? undefined : t('validation.passwordMatch');
}

export function compact(errors: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(errors).filter((entry): entry is [string, string] => Boolean(entry[1])));
}

/** Moves focus to the first invalid field so keyboard and screen-reader users land on it. */
export function focusFirstInvalid(form: HTMLFormElement | null): void {
  requestAnimationFrame(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}
