import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../api/client';
import { auth } from '../../api/endpoints';
import { Alert } from '../../components/Feedback';
import { TextField } from '../../components/Field';
import { useDocumentTitle } from '../../components/Layout';
import { compact, emailError, focusFirstInvalid, matchError, passwordError, requiredError } from '../../components/validation';
import { errorMessage, fieldErrorsFrom } from '../../hooks/useApi';
import { t } from '../../i18n';

/** Version of the consent text the person accepts (contract §4.1 example). */
export const CONSENT_VERSION = '2026-10-v1';

export function RegisterPage() {
  useDocumentTitle(t('register.title'));
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({ fullName: '', email: '', password: '', passwordConfirm: '' });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const update = (field: keyof typeof values) => (event: ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const found = compact({
      fullName: requiredError(values.fullName),
      email: emailError(values.email),
      password: passwordError(values.password),
      passwordConfirm: matchError(values.passwordConfirm, values.password),
      consent: consent ? undefined : t('validation.consent'),
    });
    setErrors(found);
    if (Object.keys(found).length) {
      setFormError(t('validation.summary'));
      focusFirstInvalid(formRef.current);
      return;
    }
    setSubmitting(true);
    try {
      await auth.register({
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        password: values.password,
        consent: { accepted: true, consentVersion: CONSENT_VERSION },
      });
      setDone(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') {
        setErrors({ email: t('error.EMAIL_TAKEN') });
        focusFirstInvalid(formRef.current);
      } else {
        setErrors(fieldErrorsFrom(error));
      }
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <section className="auth-page">
        <div className="card auth-card">
          <h1>{t('register.success.title')}</h1>
          <Alert tone="success">
            <p>{t('register.success.body')}</p>
          </Alert>
          <p>{t('register.success.noProfessional')}</p>
          <Link to="/iniciar-sesion" className="btn btn--primary btn--block">
            {t('nav.login')}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-page">
      <div className="card auth-card">
        <h1>{t('register.title')}</h1>
        <p className="lead">{t('register.lead')}</p>
        {formError && <Alert tone="error">{formError}</Alert>}
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="form">
          <TextField
            label={t('register.fullName')}
            placeholder={t('register.fullName.placeholder')}
            autoComplete="name"
            required
            value={values.fullName}
            onChange={update('fullName')}
            error={errors.fullName}
          />
          <TextField
            label={t('register.email')}
            placeholder={t('register.email.placeholder')}
            type="email"
            autoComplete="email"
            required
            value={values.email}
            onChange={update('email')}
            error={errors.email}
          />
          <TextField
            label={t('register.password')}
            type="password"
            autoComplete="new-password"
            required
            hint={t('register.password.hint')}
            value={values.password}
            onChange={update('password')}
            error={errors.password}
          />
          <TextField
            label={t('register.passwordConfirm')}
            type="password"
            autoComplete="new-password"
            required
            value={values.passwordConfirm}
            onChange={update('passwordConfirm')}
            error={errors.passwordConfirm}
          />
          <div className={`check${errors.consent ? ' check--invalid' : ''}`}>
            <input
              id="consent"
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby={errors.consent ? 'consent-error' : undefined}
              required
            />
            <label htmlFor="consent">{t('register.consent.label')}</label>
          </div>
          <details className="consent-text">
            <summary>{t('register.consent.details')}</summary>
            <p>{t('consent.body')}</p>
          </details>
          {errors.consent && (
            <p id="consent-error" className="field__error">
              {errors.consent}
            </p>
          )}
          <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={submitting}>
            {submitting ? t('common.loading') : t('register.submit')}
          </button>
        </form>
        <p className="auth-card__alt">
          {t('register.haveAccount')} <Link to="/iniciar-sesion">{t('register.loginLink')}</Link>
        </p>
      </div>
    </section>
  );
}
