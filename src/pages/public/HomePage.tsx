import { Link } from 'react-router';
import { useDocumentTitle } from '../../components/Layout';
import { t, type TextKey } from '../../i18n';

const LEVELS = [1, 2, 3, 4, 5] as const;
const SCOPE: TextKey[] = ['home.scope.academic', 'home.scope.notDevice', 'home.scope.professional', 'home.scope.headset'];
const ROLES: { title: TextKey; body: TextKey }[] = [
  { title: 'role.patient', body: 'home.roles.patient' },
  { title: 'role.professional', body: 'home.roles.professional' },
  { title: 'role.admin', body: 'home.roles.admin' },
];

/** Abstract visual (concentric rings and a calm orb). Deliberately no spider imagery on the public page. */
function HeroVisual() {
  return (
    <div className="hero__visual" aria-hidden="true">
      <svg viewBox="0 0 400 400">
        <defs>
          <radialGradient id="orb" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor="#9fd0ff" />
            <stop offset="55%" stopColor="#2E7AF2" />
            <stop offset="100%" stopColor="#123a7a" />
          </radialGradient>
        </defs>
        {[180, 150, 120, 90].map((r, i) => (
          <circle key={r} cx="200" cy="200" r={r} className={`ring ring--${i}`} />
        ))}
        <circle cx="200" cy="200" r="56" fill="url(#orb)" className="orb" />
        {LEVELS.map((level, i) => {
          const angle = (-90 + i * 72) * (Math.PI / 180);
          return <circle key={level} cx={200 + 150 * Math.cos(angle)} cy={200 + 150 * Math.sin(angle)} r={8} className="ring-dot" />;
        })}
      </svg>
    </div>
  );
}

export function HomePage() {
  useDocumentTitle(t('nav.info'));
  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__copy">
            <p className="eyebrow">{t('app.name')}</p>
            <h1 className="hero__title">{t('app.tagline')}</h1>
            <p className="lead">{t('home.lead')}</p>
            <div className="hero__actions">
              <Link to="/registro" className="btn btn--primary btn--lg">
                {t('nav.register')}
              </Link>
              <Link to="/iniciar-sesion" className="btn btn--ghost btn--lg">
                {t('nav.login')}
              </Link>
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      <section className="container">
        <aside className="disclaimer" aria-labelledby="disclaimer-title">
          <span className="disclaimer__icon" aria-hidden="true">!</span>
          <div>
            <h2 id="disclaimer-title" className="disclaimer__title">
              {t('disclaimer.webTitle')}
            </h2>
            <p>{t('disclaimer.body')}</p>
          </div>
        </aside>
      </section>

      <section className="container info-grid" aria-label={t('nav.info')}>
        <article className="card">
          <h2>{t('home.purpose.title')}</h2>
          <p>{t('home.purpose.body')}</p>
        </article>
        <article className="card">
          <h2>{t('home.scope.title')}</h2>
          <ul className="checklist">
            {SCOPE.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </article>
        <article className="card">
          <h2>{t('home.levels.title')}</h2>
          <p>{t('home.levels.lead')}</p>
          <ol className="level-steps">
            {LEVELS.map((level) => (
              <li key={level}>
                <span className="level-steps__n" aria-hidden="true">
                  {level}
                </span>
                <span>
                  <span className="sr-only">{t('level.number', { n: level })}: </span>
                  {t(`level.${level}.name`)}
                </span>
              </li>
            ))}
          </ol>
        </article>
      </section>

      <section className="container roles">
        <h2>{t('home.roles.title')}</h2>
        <div className="roles__grid">
          {ROLES.map((role) => (
            <div key={role.title} className="role-card">
              <h3>{t(role.title)}</h3>
              <p>{t(role.body)}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
