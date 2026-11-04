import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { me as meApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { Alert } from '../components/Feedback';
import { TextField } from '../components/Field';
import { PageHeader } from '../components/Layout';
import { compact, emailError, focusFirstInvalid, matchError, passwordError, requiredError } from '../components/validation';
import { errorMessage, fieldErrorsFrom } from '../hooks/useApi';
import { formatDate, t } from '../i18n';
import { ApiError } from '../api/client';

function ProfileForm() {
  const { user, setUser } = useAuth();
  const formRef = useRef<HTMLFormElement>(null);
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    const found = compact({ fullName: requiredError(fullName), email: emailError(email) });
    setErrors(found);
    if (Object.keys(found).length) {
      setMessage({ tone: 'error', text: t('validation.summary') });
      focusFirstInvalid(formRef.current);
      return;
    }
    setSaving(true);
    try {
      const updated = await meApi.update({ fullName: fullName.trim(), email: email.trim() });
      setUser(updated);
      setMessage({ tone: 'success', text: t('account.profile.saved') });
    } catch (error) {
      const fieldErrors = fieldErrorsFrom(error);
      if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') fieldErrors.email = t('error.EMAIL_TAKEN');
      setErrors(fieldErrors);
      setMessage({ tone: 'error', text: errorMessage(error) });
      focusFirstInvalid(formRef.current);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card" aria-labelledby="profile-title">
      <h2 id="profile-title">{t('account.profile.title')}</h2>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="form">
        <TextField label={t('register.fullName')} autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.fullName} />
        <TextField label={t('register.email')} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </form>
    </section>
  );
}

function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const empty = { currentPassword: '', newPassword: '', confirm: '' };
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    const found = compact({
      currentPassword: requiredError(values.currentPassword),
      newPassword: passwordError(values.newPassword),
      confirm: matchError(values.confirm, values.newPassword),
    });
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setSaving(true);
    try {
      await meApi.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      setValues(empty);
      setMessage({ tone: 'success', text: t('account.password.done') });
    } catch (error) {
      setErrors(fieldErrorsFrom(error));
      setMessage({ tone: 'error', text: errorMessage(error) });
      focusFirstInvalid(formRef.current);
    } finally {
      setSaving(false);
    }
  };

  const set = (field: keyof typeof empty) => (e: ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [field]: e.target.value }));

  return (
    <section className="card" aria-labelledby="password-title">
      <h2 id="password-title">{t('account.password.title')}</h2>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="form">
        <TextField label={t('account.password.current')} type="password" autoComplete="current-password" required value={values.currentPassword} onChange={set('currentPassword')} error={errors.currentPassword} />
        <TextField label={t('account.password.new')} type="password" autoComplete="new-password" required hint={t('register.password.hint')} value={values.newPassword} onChange={set('newPassword')} error={errors.newPassword} />
        <TextField label={t('account.password.confirm')} type="password" autoComplete="new-password" required value={values.confirm} onChange={set('confirm')} error={errors.confirm} />
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? t('common.loading') : t('account.password.submit')}
        </button>
      </form>
    </section>
  );
}

function ConsentSection() {
  const { user, clearSession } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  if (!user) return null;

  const startConfirm = () => {
    setConfirming(true);
    requestAnimationFrame(() => confirmRef.current?.focus());
  };

  const withdraw = async () => {
    setWorking(true);
    setError(null);
    try {
      await meApi.withdrawConsent();
      clearSession();
      navigate('/iniciar-sesion', { replace: true, state: { notice: t('account.withdraw.done') } });
    } catch (err) {
      setError(errorMessage(err));
      setWorking(false);
    }
  };

  return (
    <section className="card card--danger" aria-labelledby="consent-title">
      <h2 id="consent-title">{t('account.consent.title')}</h2>
      <ul className="plain-list">
        {user.consents.map((consent) => (
          <li key={consent.consentVersion + consent.grantedAt}>
            {t('account.consent.granted', { version: consent.consentVersion, date: formatDate(consent.grantedAt) })}
            {consent.withdrawnAt && <> {t('account.consent.withdrawnAt', { date: formatDate(consent.withdrawnAt) })}</>}
          </li>
        ))}
      </ul>
      {user.role !== 'admin' && (
        <>
          <p>{t('account.withdraw.warning')}</p>
          <p className="muted">{t('account.withdraw.retention')}</p>
          {!confirming ? (
            <button type="button" className="btn btn--danger" onClick={startConfirm}>
              {t('account.withdraw.button')}
            </button>
          ) : (
            <div ref={confirmRef} tabIndex={-1} className="confirm" role="group" aria-labelledby="withdraw-confirm-title">
              <p id="withdraw-confirm-title" className="confirm__title">
                {t('account.withdraw.confirmTitle')}
              </p>
              <div className="check">
                <input id="withdraw-understood" type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
                <label htmlFor="withdraw-understood">{t('account.withdraw.confirmCheck')}</label>
              </div>
              {error && <Alert tone="error">{error}</Alert>}
              <div className="row">
                <button type="button" className="btn btn--danger" disabled={!understood || working} onClick={withdraw}>
                  {working ? t('common.loading') : t('account.withdraw.confirm')}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setConfirming(false)}>
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function AccountPage() {
  return (
    <>
      <PageHeader title={t('account.title')} lead={t('account.lead')} />
      <div className="grid-2">
        <ProfileForm />
        <PasswordForm />
      </div>
      <ConsentSection />
    </>
  );
}
