import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { HOME_BY_ROLE, useAuth } from '../../auth/AuthContext';
import { Alert } from '../../components/Feedback';
import { TextField } from '../../components/Field';
import { useDocumentTitle } from '../../components/Layout';
import { compact, emailError, focusFirstInvalid, requiredError } from '../../components/validation';
import { errorMessage } from '../../hooks/useApi';
import { t } from '../../i18n';

export function LoginPage() {
  useDocumentTitle(t('login.title'));
  const { login, status, user, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const notice = (location.state as { notice?: string } | null)?.notice;

  if (status === 'authenticated' && user && !submitting) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const found = compact({ email: emailError(email), password: requiredError(password) });
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setSubmitting(true);
    try {
      const current = await login(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      const allowed = from && (from.startsWith(HOME_BY_ROLE[current.role]) || from === '/cuenta');
      navigate(allowed ? from : HOME_BY_ROLE[current.role], { replace: true });
    } catch (error) {
      // HU-07: show the error and let the person try again; the password is cleared.
      setPassword('');
      setFormError(errorMessage(error));
      setSubmitting(false);
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  };

  return (
    <section className="auth-page">
      <div className="card auth-card">
        <h1>{t('login.title')}</h1>
        <p className="lead">{t('login.lead')}</p>
        {notice && <Alert tone="success">{notice}</Alert>}
        {sessionExpired && !formError && <Alert tone="info">{t('login.sessionExpired')}</Alert>}
        {formError && (
          <Alert ref={errorRef} tone="error">
            {formError}
          </Alert>
        )}
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="form">
          <TextField
            label={t('login.email')}
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email}
          />
          <TextField
            label={t('login.password')}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
          />
          <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={submitting}>
            {submitting ? t('common.loading') : t('login.submit')}
          </button>
        </form>
        <p className="auth-card__alt">
          {t('login.noAccount')} <Link to="/registro">{t('login.registerLink')}</Link>
        </p>
      </div>
    </section>
  );
}
