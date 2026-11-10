import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { publicInfo } from '../../api/endpoints';
import type { ProductInfo } from '../../api/types';
import { useDocumentTitle } from '../../components/Layout';
import { DistanceRuler, LEVELS, type Level } from '../../components/signature/DistanceRuler';
import { ErrorState, Loading, PendingTag } from '../../components/ui/Feedback';
import { riseOrder } from '../../components/ui/rise';
import { useApi } from '../../hooks/useApi';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { t, tDynamic, type TextKey } from '../../i18n';

/** Narrative sections, in reading order. */
const SECTIONS = ['que-es', 'como-funciona', 'experiencia', 'acompanamiento', 'paciente', 'acceso'] as const;
type SectionId = (typeof SECTIONS)[number];

interface MenuEntry {
  label: TextKey;
  hint: TextKey;
  target: SectionId;
  /** Sections that keep this entry selected while they are on screen. */
  covers: SectionId[];
}

const MENU: MenuEntry[] = [
  { label: 'home.menu.about', hint: 'home.menu.about.hint', target: 'que-es', covers: ['que-es'] },
  { label: 'home.menu.how', hint: 'home.menu.how.hint', target: 'como-funciona', covers: ['como-funciona'] },
  { label: 'home.menu.vr', hint: 'home.menu.vr.hint', target: 'experiencia', covers: ['experiencia'] },
  { label: 'home.menu.care', hint: 'home.menu.care.hint', target: 'acompanamiento', covers: ['acompanamiento', 'paciente'] },
  { label: 'home.menu.access', hint: 'home.menu.access.hint', target: 'acceso', covers: ['acceso'] },
];

const CARE_POINTS: TextKey[] = ['home.care.plan', 'home.care.history', 'home.care.notes', 'home.care.assigned'];
const PATIENT_POINTS: TextKey[] = ['home.patient.today', 'home.patient.history', 'home.patient.feedback', 'home.patient.data'];
/** Reading line, as a fraction of the viewport height from the top. */
const READING_LINE = 0.45;

/**
 * Which narrative section is being read; null while the opening screen is. The last
 * section whose top has passed the reading line wins, and the end of the page always
 * selects the last section (it may be too short to reach the line).
 */
function useActiveSection(): SectionId | null {
  const [active, setActive] = useState<SectionId | null>(null);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight * READING_LINE;
      const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      let current: SectionId | null = null;
      for (const id of SECTIONS) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= line) current = id;
      }
      if (atEnd && current !== null) current = SECTIONS[SECTIONS.length - 1]!;
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, []);
  return active;
}

function SideMenu({ active }: { active: SectionId | null }) {
  return (
    <nav className="rail" aria-label={t('home.menu.label')}>
      <ol className="rail__list">
        {MENU.map((entry, index) => {
          const current = active !== null && entry.covers.includes(active);
          return (
            <li key={entry.target}>
              <a href={`#${entry.target}`} className="rail__link" aria-current={current ? 'location' : undefined}>
                <span className="rail__index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="rail__text">
                  <span className="rail__label">{t(entry.label)}</span>
                  <span className="rail__hint">{t(entry.hint)}</span>
                </span>
              </a>
            </li>
          );
        })}
        <li className="rail__divider">
          <Link to="/iniciar-sesion" className="rail__link rail__link--action" viewTransition>
            <span className="rail__index" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M6 3h6v10H6M2 8h7M7 5l3 3-3 3" />
              </svg>
            </span>
            <span className="rail__text">
              <span className="rail__label">{t('nav.login')}</span>
              <span className="rail__hint">{t('home.menu.login.hint')}</span>
            </span>
          </Link>
        </li>
      </ol>
    </nav>
  );
}

interface ChapterProps {
  id: SectionId;
  number: number;
  title: string;
  lead?: string;
  children: ReactNode;
}

function Chapter({ id, number, title, lead, children }: ChapterProps) {
  return (
    <section id={id} className="chapter" aria-labelledby={`${id}-title`}>
      <p className="chapter__number" aria-hidden="true">
        {String(number).padStart(2, '0')}
      </p>
      <h2 id={`${id}-title`} className="chapter__title">
        {title}
      </h2>
      {lead && <p className="chapter__lead">{lead}</p>}
      <div className="chapter__body">{children}</div>
    </section>
  );
}

function LevelExplorer() {
  const [level, setLevel] = useState<Level>(1);
  return (
    <div className="levels">
      <DistanceRuler level={level} />
      <div className="stops" role="group" aria-label={t('home.levels.pick')}>
        {LEVELS.map((n) => (
          <button key={n} type="button" className="stop" aria-pressed={n === level} onClick={() => setLevel(n)}>
            <span className="stop__number">{t('level.number', { n })}</span>
            <span className="stop__name">{tDynamic(`level.${n}.name`, 'common.noData')}</span>
          </button>
        ))}
      </div>
      <p className="stop-detail" aria-live="polite">
        {t('home.levels.detail', { n: level, detail: tDynamic(`level.${level}.detail`, 'common.noData') })}
      </p>
    </div>
  );
}

function ProductBlock({ product }: { product: ProductInfo }) {
  return (
    <>
      <p className="chapter__text">{product.description}</p>
      <p className="chapter__text">
        <span className="muted">{t('home.product.audience')} </span>
        {product.audience}
      </p>
      <dl className="facts">
        {product.features.map((feature) => (
          <div key={feature.title} className="facts__item">
            <dt>{feature.title}</dt>
            <dd>{feature.description}</dd>
          </div>
        ))}
      </dl>
    </>
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
        <h3 id="disclaimer-title" className="notice__title">
          {t('disclaimer.webTitle')}
        </h3>
        <p>{product?.disclaimer ?? t('disclaimer.body')}</p>
        {product?.contentStatus === 'pendiente_de_aprobacion' && (
          <p>
            <span className="tag tag--pending">{t('home.contentStatus.pending', { version: product.contentVersion })}</span>
          </p>
        )}
      </div>
    </aside>
  );
}

function Steps({ product }: { product: ProductInfo }) {
  const steps = [...product.howItWorks].sort((a, b) => a.order - b.order);
  return (
    <ol className="path">
      {steps.map((step) => (
        <li key={step.order} className="path__step">
          <span className="path__number" aria-hidden="true">
            {step.order}
          </span>
          <div>
            <h3 className="path__title">{step.title}</h3>
            <p className="muted">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function PointList({ items }: { items: TextKey[] }) {
  return (
    <ul className="points">
      {items.map((key) => (
        <li key={key}>{t(key)}</li>
      ))}
    </ul>
  );
}

/** Public page (use case "Visualizar información del producto"). Deliberately no spider imagery. */
export function HomePage() {
  useDocumentTitle(t('nav.info'));
  const { hash } = useLocation();
  const reducedMotion = usePrefersReducedMotion();
  const product = useApi(() => publicInfo.product(), []);
  const active = useActiveSection();

  // Deep links such as /#como-funciona land on their section once the content is there.
  useEffect(() => {
    const id = hash.slice(1);
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [hash, reducedMotion, product.data]);

  const status = (
    <>
      {product.loading && <Loading />}
      {Boolean(product.error) && <ErrorState error={product.error} onRetry={product.reload} />}
    </>
  );

  return (
    <div className="landing wrap wrap--wide">
      <div className="landing__rail">
        <SideMenu active={active} />
      </div>

      <div className="landing__story">
        <section id="inicio" className="hero" aria-labelledby="home-title">
          <p className="eyebrow rise">{t('home.hero.eyebrow')}</p>
          <h1 id="home-title" className="hero__title rise" style={riseOrder(1)}>
            {t('home.hero.titleStart')}
            <em>{t('home.hero.titleEmphasis')}</em>
            {t('home.hero.titleEnd')}
          </h1>
          <p className="hero__lead rise" style={riseOrder(2)}>
            {t('home.lead')}
          </p>
          <div className="row rise" style={riseOrder(3)}>
            <a href="#que-es" className="btn btn--primary btn--lg">
              {t('home.cta.explore')}
            </a>
            <Link to="/iniciar-sesion" className="btn btn--lg" viewTransition>
              {t('home.cta.access')}
            </Link>
          </div>
          <p className="hero__scroll rise" style={riseOrder(4)}>
            <span className="hero__scroll-line" aria-hidden="true" />
            {t('home.hero.scroll')}
          </p>
        </section>

        <Chapter id="que-es" number={1} title={t('home.product.title')}>
          {status}
          {product.data && <ProductBlock product={product.data} />}
          <Disclaimer product={product.data} />
        </Chapter>

        <Chapter id="como-funciona" number={2} title={t('home.connect.title')} lead={t('home.connect.lead')}>
          {product.data && <Steps product={product.data} />}
          <p className="aside-line">
            <span className="aside-line__label">{t('pairing.title')}</span>
            {t('pairing.instructions')}
          </p>
        </Chapter>

        <Chapter id="experiencia" number={3} title={t('home.levels.title')} lead={t('home.levels.lead')}>
          <LevelExplorer />
          <p className="muted small">{t('home.vr.safety')}</p>
        </Chapter>

        <Chapter id="acompanamiento" number={4} title={t('home.care.title')} lead={t('home.roles.professional')}>
          <PointList items={CARE_POINTS} />
          <div className="pending-line">
            <PendingTag />
            <p className="muted">{t('clinical.pending.explain')}</p>
          </div>
        </Chapter>

        <Chapter id="paciente" number={5} title={t('home.patient.title')} lead={t('home.roles.patient')}>
          <PointList items={PATIENT_POINTS} />
        </Chapter>

        <Chapter id="acceso" number={6} title={t('home.access.title')} lead={t('home.access.lead')}>
          {product.data && (
            <dl className="facts facts--compact">
              <div className="facts__item">
                <dt>{t('home.requirements.headsets')}</dt>
                <dd>{product.data.requirements.headsets.join(' · ')}</dd>
              </div>
              <div className="facts__item">
                <dt>{t('home.requirements.web')}</dt>
                <dd>{product.data.requirements.web}</dd>
              </div>
              <div className="facts__item">
                <dt>{t('home.roles.adminTitle')}</dt>
                <dd>{t('home.roles.admin')}</dd>
              </div>
            </dl>
          )}
          <div className="row">
            <Link to="/registro" className="btn btn--primary btn--lg" viewTransition>
              {t('home.cta.register')}
              <span className="btn__arrow" aria-hidden="true">
                →
              </span>
            </Link>
            <Link to="/iniciar-sesion" className="btn btn--lg" viewTransition>
              {t('nav.login')}
            </Link>
          </div>
        </Chapter>
      </div>
    </div>
  );
}
