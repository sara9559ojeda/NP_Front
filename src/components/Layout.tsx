import { useEffect, useRef, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import type { Role } from '../api/types';
import { HOME_BY_ROLE, useAuth } from '../auth/AuthContext';
import { t, type TextKey } from '../i18n';
import { riseOrder } from './ui/rise';
import { ToastProvider } from './ui/Toast';

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${t('app.name')}`;
  }, [title]);
}

/** Moves focus to the main region after each navigation, for screen readers and keyboards. */
function useFocusMainOnNavigate() {
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [pathname]);
  return mainRef;
}

/** The brand mark repeats the product's motif: you, a dashed distance, the stimulus as a ring. */
function Brand({ to }: { to: string }) {
  return (
    <Link to={to} className="brand" viewTransition>
      <svg className="brand__mark" width="34" height="20" viewBox="0 0 34 20" aria-hidden="true">
        <circle cx="5" cy="10" r="4" fill="currentColor" />
        <line x1="12" y1="10" x2="20" y2="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 3" />
        <circle cx="27" cy="10" r="6" fill="none" stroke="var(--color-accent)" strokeWidth="1.6" />
      </svg>
      <span>{t('app.name')}</span>
    </Link>
  );
}

function SkipLink() {
  return (
    <a href="#main" className="skip-link">
      {t('nav.skipToContent')}
    </a>
  );
}

function Footer() {
  return (
    <div className="wrap">
      <footer className="site-footer">
        <span>{t('app.footer')}</span>
        <span className="mono">{t('home.scope.notDevice')}</span>
      </footer>
    </div>
  );
}

export function PublicLayout() {
  const mainRef = useFocusMainOnNavigate();
  const { status, user } = useAuth();
  return (
    <div className="shell">
      <SkipLink />
      <div className="wrap">
        <header className="site-header">
          <Brand to="/" />
          <nav aria-label={t('nav.primary')} className="site-nav">
            <Link to={{ pathname: '/', hash: '#como-funciona' }} className="site-nav__link site-nav__link--optional">
              {t('nav.howItWorks')}
            </Link>
            {status === 'authenticated' && user ? (
              <NavLink to={HOME_BY_ROLE[user.role]} className="btn btn--primary" viewTransition>
                {t(NAV_BY_ROLE[user.role][0]!.label)}
              </NavLink>
            ) : (
              <>
                <NavLink to="/iniciar-sesion" className="site-nav__link" viewTransition>
                  {t('nav.login')}
                </NavLink>
                <NavLink to="/registro" className="btn btn--primary" viewTransition>
                  {t('nav.register')}
                </NavLink>
              </>
            )}
          </nav>
        </header>
      </div>
      <main id="main" ref={mainRef} tabIndex={-1} className="shell__main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

interface NavItem {
  to: string;
  label: TextKey;
  end?: boolean;
}

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  patient: [
    { to: '/paciente', label: 'nav.patient.home', end: true },
    { to: '/paciente/sesiones', label: 'nav.patient.sessions' },
    { to: '/paciente/visor', label: 'nav.patient.devices' },
    { to: '/cuenta', label: 'nav.account' },
  ],
  professional: [
    { to: '/profesional', label: 'nav.professional.patients' },
    { to: '/cuenta', label: 'nav.account' },
  ],
  admin: [
    { to: '/admin', label: 'nav.admin.users', end: true },
    { to: '/admin/asignaciones', label: 'nav.admin.assignments' },
    { to: '/admin/exportacion', label: 'nav.admin.export' },
    { to: '/cuenta', label: 'nav.account' },
  ],
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const mainRef = useFocusMainOnNavigate();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/iniciar-sesion', { replace: true });
  };

  return (
    <ToastProvider>
      <div className="shell">
        <SkipLink />
        <div className="wrap">
          <header className="site-header">
            <Brand to={HOME_BY_ROLE[user.role]} />
            <div className="whoami">
              <span className="whoami__name">{t('shell.greeting', { name: user.fullName })}</span>
              <span className="role-chip">{t(`role.${user.role}`)}</span>
              <button type="button" className="btn btn--sm" onClick={handleLogout}>
                {t('nav.logout')}
              </button>
            </div>
          </header>
        </div>
        <nav aria-label={t('nav.primary')} className="app-nav">
          <div className="wrap">
            <ul className="app-nav__list">
              {NAV_BY_ROLE[user.role].map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.end} className="app-nav__link" viewTransition>
                    {t(item.label)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>
        <main id="main" ref={mainRef} tabIndex={-1} className="shell__main wrap page">
          <Outlet />
        </main>
        <Footer />
      </div>
    </ToastProvider>
  );
}

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  lead?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, eyebrow, lead, actions }: PageHeaderProps) {
  useDocumentTitle(title);
  return (
    <div className="page-header">
      <div className="page-header__text">
        {eyebrow && <p className="eyebrow rise">{eyebrow}</p>}
        <h1 className="rise" style={riseOrder(1)}>
          {title}
        </h1>
        {lead && (
          <p className="page-header__lead rise" style={riseOrder(2)}>
            {lead}
          </p>
        )}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}
