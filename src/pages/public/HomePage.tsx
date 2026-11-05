import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { publicInfo } from '../../api/endpoints';
import type { ProductInfo } from '../../api/types';
import { useDocumentTitle } from '../../components/Layout';
import { DistanceRuler, LEVELS, type Level } from '../../components/signature/DistanceRuler';
import { ErrorState, Loading } from '../../components/ui/Feedback';
import { riseOrder } from '../../components/ui/rise';
import { useApi } from '../../hooks/useApi';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { t, tDynamic, type TextKey } from '../../i18n';

const HOW_IT_WORKS_ID = 'como-funciona';
/** On load, the ruler shows once how the distance shortens, then waits for the person. */
const DEMO_DELAY_MS = 1400;

const ROLES: { title: TextKey; body: TextKey }[] = [
  { title: 'home.roles.patientTitle', body: 'home.roles.patient' },
  { title: 'home.roles.professionalTitle', body: 'home.roles.professional' },
  { title: 'home.roles.adminTitle', body: 'home.roles.admin' },
];

function LevelExplorer() {
  const reducedMotion = usePrefersReducedMotion();
  const [level, setLevel] = useState<Level>(1);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (reducedMotion || touched) return;
    const timer = window.setTimeout(() => setLevel(2), DEMO_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, touched]);

  const choose = (next: Level) => {
    setTouched(true);
    setLevel(next);
  };

  return (
    <section className="levels rise" style={riseOrder(4)} aria-labelledby="levels-title">
      <div className="levels__head">
        <h2 id="levels-title">{t('home.levels.title')}</h2>
        <p className="mono muted">{t('home.levels.lead')}</p>
      </div>
      <DistanceRuler level={level} />
      <div className="stops" role="group" aria-label={t('home.levels.pick')}>
        {LEVELS.map((n) => (
          <button key={n} type="button" className="stop" aria-pressed={n === level} onClick={() => choose(n)}>
            <span className="stop__number">{t('level.number', { n })}</span>
            <span className="stop__name">{tDynamic(`level.${n}.name`, 'common.noData')}</span>
          </button>
        ))}
      </div>
      <p className="stop-detail" aria-live="polite">
        {t('home.levels.detail', { n: level, detail: tDynamic(`level.${level}.detail`, 'common.noData') })}
      </p>
    </section>
  );
}

function HowItWorksSteps({ product }: { product: ProductInfo }) {
  const steps = [...product.howItWorks].sort((a, b) => a.order - b.order);
  return (
    <ol className="how__steps">
      {steps.map((step) => (
        <li key={step.order} className="how__step">
          <span className="how__number" aria-hidden="true">
            {step.order}
          </span>
          <div>
            <h3 className="how__title">{step.title}</h3>
            <p className="muted">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ProductSummary({ product }: { product: ProductInfo }) {
  return (
    <section className="product" aria-labelledby="product-title">
      <div className="product__intro">
        <h2 id="product-title">{t('home.product.title')}</h2>
        <p className="lead">{product.description}</p>
        <p>
          <span className="muted">{t('home.product.audience')} </span>
          {product.audience}
        </p>
      </div>
      <dl className="features">
        {product.features.map((feature) => (
          <div key={feature.title} className="features__item">
            <dt>{feature.title}</dt>
            <dd className="muted">{feature.description}</dd>
          </div>
        ))}
      </dl>
      <div className="requirements">
        <h3>{t('home.requirements.title')}</h3>
        <dl className="requirements__list">
          <div>
            <dt className="mono muted">{t('home.requirements.headsets')}</dt>
            <dd>{product.requirements.headsets.join(' · ')}</dd>
          </div>
          <div>
            <dt className="mono muted">{t('home.requirements.web')}</dt>
            <dd>{product.requirements.web}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function Disclaimer({ product }: { product: ProductInfo | undefined }) {
  return (
    <aside className="notice" aria-labelledby="disclaimer-title">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16.5v.5" />
      </svg>
      <div className="stack stack--tight">
        <h2 id="disclaimer-title" className="notice__title">
          {t('disclaimer.webTitle')}
        </h2>
        <p className="muted">{product?.disclaimer ?? t('disclaimer.body')}</p>
        {product?.contentStatus === 'pendiente_de_aprobacion' && (
          <p>
            <span className="tag tag--pending">{t('home.contentStatus.pending', { version: product.contentVersion })}</span>
          </p>
        )}
      </div>
    </aside>
  );
}

/** Public page (use case "Visualizar información del producto"). Deliberately no spider imagery. */
export function HomePage() {
  useDocumentTitle(t('nav.info'));
  const { hash } = useLocation();
  const reducedMotion = usePrefersReducedMotion();
  const product = useApi(() => publicInfo.product(), []);

  useEffect(() => {
    if (hash !== `#${HOW_IT_WORKS_ID}`) return;
    document.getElementById(HOW_IT_WORKS_ID)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [hash, reducedMotion, product.data]);

  return (
    <div className="wrap home">
      <section className="hero" aria-labelledby="home-title">
        <div>
          <p className="eyebrow rise">{t('home.hero.eyebrow')}</p>
          <h1 id="home-title" className="hero__title rise" style={riseOrder(1)}>
            {t('home.hero.titleStart')}
            <em>{t('home.hero.titleEmphasis')}</em>
            {t('home.hero.titleEnd')}
          </h1>
        </div>
        <div className="stack">
          <p className="hero__lead rise" style={riseOrder(2)}>
            {t('home.lead')}
          </p>
          <div className="row rise" style={riseOrder(3)}>
            <Link to="/registro" className="btn btn--primary" viewTransition>
              {t('home.cta.register')} <span className="btn__arrow" aria-hidden="true">→</span>
            </Link>
            <a href="#levels-title" className="btn">
              {t('home.cta.levels')}
            </a>
          </div>
        </div>
      </section>

      <LevelExplorer />

      <section id={HOW_IT_WORKS_ID} className="how home__section" aria-labelledby="how-title">
        <div>
          <p className="eyebrow">{t('home.how.eyebrow')}</p>
          <h2 id="how-title">{t('home.how.title')}</h2>
        </div>
        <div>
          {product.loading && <Loading />}
          {Boolean(product.error) && <ErrorState error={product.error} onRetry={product.reload} />}
          {product.data && <HowItWorksSteps product={product.data} />}
        </div>
      </section>

      {product.data && <ProductSummary product={product.data} />}

      <section className="roles home__section" aria-labelledby="roles-title">
        <h2 id="roles-title">{t('home.roles.title')}</h2>
        <dl className="roles__list">
          {ROLES.map((role) => (
            <div key={role.title}>
              <dt>{t(role.title)}</dt>
              <dd className="muted">{t(role.body)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Disclaimer product={product.data} />
    </div>
  );
}
