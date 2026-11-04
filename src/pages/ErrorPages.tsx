import { Link } from 'react-router';
import { HOME_BY_ROLE, useAuth } from '../auth/AuthContext';
import { useDocumentTitle } from '../components/Layout';
import { t } from '../i18n';

export function ForbiddenPage() {
  const { user } = useAuth();
  useDocumentTitle(t('forbidden.title'));
  return (
    <section className="center-page">
      <div className="card card--narrow">
        <p className="eyebrow">403</p>
        <h1>{t('forbidden.title')}</h1>
        <p>{t('forbidden.body')}</p>
        <Link className="btn btn--primary" to={user ? HOME_BY_ROLE[user.role] : '/'}>
          {t('forbidden.goHome')}
        </Link>
      </div>
    </section>
  );
}

export function NotFoundPage() {
  useDocumentTitle(t('notFound.title'));
  return (
    <section className="center-page">
      <div className="card card--narrow">
        <p className="eyebrow">404</p>
        <h1>{t('notFound.title')}</h1>
        <p>{t('notFound.body')}</p>
        <Link className="btn btn--primary" to="/">
          {t('notFound.goHome')}
        </Link>
      </div>
    </section>
  );
}
