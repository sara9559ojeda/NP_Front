import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import type { Role } from '../api/types';
import { HOME_BY_ROLE, useAuth } from '../auth/AuthContext';
import { t, type TextKey } from '../i18n';

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

function Brand({ to }: { to: string }) {
  return (
    <Link to={to} className="brand">
      <span className="brand__mark" aria-hidden="true" />
      <span className="brand__name">{t('app.name')}</span>
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

export function PublicLayout() {
  const mainRef = useFocusMainOnNavigate();
  const { status, user } = useAuth();
  return (
    <div className="public">
      <SkipLink />
      <header className="topbar">
        <div className="container topbar__inner">
          <Brand to="/" />
          <nav aria-label={t('nav.primary')} className="topnav">
            <NavLink to="/" end className="topnav__link">
              {t('nav.info')}
            </NavLink>
            {status === 'authenticated' && user ? (
              <NavLink to={HOME_BY_ROLE[user.role]} className="btn btn--primary btn--sm">
                {t(NAV_BY_ROLE[user.role][0]!.label)}
              </NavLink>
            ) : (
              <>
                <NavLink to="/registro" className="topnav__link">
                  {t('nav.register')}
                </NavLink>
                <NavLink to="/iniciar-sesion" className="btn btn--primary btn--sm">
                  {t('nav.login')}
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" ref={mainRef} tabIndex={-1} className="public__main">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container">
          <p>{t('app.footer')}</p>
        </div>
      </footer>
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
    { to: '/paciente', label: 'nav.patient.progress', end: true },
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
  const { pathname } = useLocation();
  const mainRef = useFocusMainOnNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (!user) return null;
  const items = NAV_BY_ROLE[user.role];

  const handleLogout = async () => {
    await logout();
    navigate('/iniciar-sesion', { replace: true });
  };

  return (
    <div className="app">
      <SkipLink />
      <header className="topbar topbar--app">
        <div className="topbar__inner topbar__inner--app">
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="app-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="menu-toggle__bars" aria-hidden="true" />
            <span className="sr-only">{menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}</span>
          </button>
          <Brand to={HOME_BY_ROLE[user.role]} />
          <div className="whoami">
            <span className="whoami__name">{t('shell.greeting', { name: user.fullName })}</span>
            <span className={`role-pill role-pill--${user.role}`}>{t(`role.${user.role}`)}</span>
          </div>
        </div>
      </header>
      <div className="app__body">
        <nav id="app-nav" aria-label={t('nav.primary')} className={`sidebar${menuOpen ? ' sidebar--open' : ''}`}>
          <ul className="sidebar__list">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className="sidebar__link">
                  {t(item.label)}
                </NavLink>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn--ghost sidebar__logout" onClick={handleLogout}>
            {t('nav.logout')}
          </button>
        </nav>
        <main id="main" ref={mainRef} tabIndex={-1} className="app__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, lead, actions }: { title: string; lead?: string; actions?: ReactNode }) {
  useDocumentTitle(title);
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}
