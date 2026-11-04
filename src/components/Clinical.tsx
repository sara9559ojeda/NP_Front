import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Analysis, LevelRecord, RecommendationValue, SessionDetail, SessionSummary, SudsPhase } from '../api/types';
import { formatDate, formatDateTime, formatMinutes, formatNumber, formatPercent, t, tDynamic, type TextKey } from '../i18n';
import { EmptyState, PendingBadge } from './Feedback';

export function levelLabel(level: number | null | undefined): string {
  if (!level) return t('common.noData');
  return t('level.number', { n: level });
}

export function levelName(level: number): string {
  return tDynamic(`level.${level}.name`, 'common.noData');
}

/** AI recommendation, always shown with its "pending validation" status (§7). */
export function RecommendationTag({ value }: { value: RecommendationValue | null | undefined }) {
  if (!value) return <span className="muted">{t('recommendation.none')}</span>;
  return (
    <span className="rec">
      <span className={`chip chip--${value}`}>{tDynamic(`recommendation.${value}`, 'recommendation.none')}</span>
      <PendingBadge />
    </span>
  );
}

export function StatCard({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <div className="stat">
      <p className="stat__label">{label}</p>
      {value !== undefined && <p className="stat__value">{value}</p>}
      {children}
    </div>
  );
}

const CHART_W = 560;
const CHART_H = 220;
const PAD = { top: 16, right: 16, bottom: 32, left: 40 };

/** Line chart of the tolerance index per session (oldest to newest). Values also appear in the table. */
export function ToleranceChart({ sessions }: { sessions: SessionSummary[] }) {
  const points = sessions
    .filter((s) => typeof s.toleranceIndex === 'number')
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  if (points.length === 0) return <EmptyState>{t('chart.tolerance.empty')}</EmptyState>;

  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i * innerW) / (points.length - 1));
  const y = (v: number) => PAD.top + innerH - v * innerH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.toleranceIndex ?? 0)}`).join(' ');
  const area = `${path} L${x(points.length - 1)},${PAD.top + innerH} L${x(0)},${PAD.top + innerH} Z`;
  const descId = 'tolerance-chart-desc';

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label={t('chart.tolerance.title')} aria-describedby={descId}>
        <desc id={descId}>{t('chart.tolerance.desc', { n: points.length })}</desc>
        <defs>
          <linearGradient id="tolerance-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={CHART_W - PAD.right} y1={y(v)} y2={y(v)} className="chart__grid" />
            <text x={PAD.left - 8} y={y(v) + 4} className="chart__axis" textAnchor="end">
              {formatNumber(v, 2)}
            </text>
          </g>
        ))}
        <path d={area} fill="url(#tolerance-fill)" />
        <path d={path} className="chart__line" />
        {points.map((p, i) => (
          <g key={p.sessionId}>
            <circle cx={x(i)} cy={y(p.toleranceIndex ?? 0)} r={5} className="chart__dot">
              <title>{`${formatDate(p.startedAt)} · ${formatPercent(p.toleranceIndex)}`}</title>
            </circle>
            <text x={x(i)} y={CHART_H - 10} className="chart__axis" textAnchor="middle">
              {formatDate(p.startedAt).slice(0, 5)}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

export function SessionsTable({ sessions, linkTo, caption }: { sessions: SessionSummary[]; linkTo: (id: string) => string; caption: string }) {
  if (sessions.length === 0) return <EmptyState>{t('sessions.empty')}</EmptyState>;
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t('sessions.col.date')}</th>
            <th scope="col">{t('sessions.col.level')}</th>
            <th scope="col">{t('sessions.col.duration')}</th>
            <th scope="col">{t('sessions.col.tolerance')}</th>
            <th scope="col">{t('sessions.col.recommendation')}</th>
            <th scope="col">
              <span className="sr-only">{t('sessions.col.detail')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.sessionId}>
              <td data-label={t('sessions.col.date')}>{formatDate(s.startedAt)}</td>
              <td data-label={t('sessions.col.level')}>{levelLabel(s.levelReached)}</td>
              <td data-label={t('sessions.col.duration')}>{formatMinutes(s.totalDurationSeconds)}</td>
              <td data-label={t('sessions.col.tolerance')}>{formatPercent(s.toleranceIndex)}</td>
              <td data-label={t('sessions.col.recommendation')}>
                <RecommendationTag value={s.recommendation} />
              </td>
              <td>
                <Link className="btn btn--ghost btn--sm" to={linkTo(s.sessionId)} aria-label={t('sessions.viewLabel', { date: formatDate(s.startedAt) })}>
                  {t('sessions.view')}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PHASES: SudsPhase[] = ['before', 'during', 'after'];

function SudsBars({ record }: { record: LevelRecord }) {
  return (
    <div className="suds">
      <p className="suds__title">{t('suds.title')}</p>
      <dl className="suds__list">
        {PHASES.map((phase) => {
          const entry = record.suds.find((s) => s.phase === phase);
          return (
            <div key={phase} className="suds__row">
              <dt>{t(`suds.phase.${phase}` as TextKey)}</dt>
              <dd>
                <span className="suds__bar" aria-hidden="true">
                  <span className={`suds__fill suds__fill--${phase}`} style={{ width: `${entry?.value ?? 0}%` }} />
                </span>
                <span className="suds__value">{entry ? entry.value : t('common.noData')}</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function LevelCard({ record }: { record: LevelRecord }) {
  return (
    <article className="level-card">
      <header className="level-card__head">
        <div>
          <h4>
            {levelLabel(record.level)} · {levelName(record.level)}
          </h4>
          <p className="muted">{t('level.attempt', { n: record.attempt })}</p>
        </div>
        <span className={`chip chip--outcome-${record.outcome}`}>{tDynamic(`outcome.${record.outcome}`, 'common.noData')}</span>
      </header>
      <dl className="metrics">
        <div>
          <dt>{t('metric.permanence')}</dt>
          <dd>{t('format.seconds', { n: formatNumber(record.permanenceSeconds, 0) })}</dd>
        </div>
        <div>
          <dt>{t('metric.minDistance')}</dt>
          <dd>{record.minDistanceM === null ? t('common.noData') : t('format.meters', { n: formatNumber(record.minDistanceM, 2) })}</dd>
        </div>
        <div>
          <dt>{t('metric.headOnStimulus')}</dt>
          <dd>{t('format.seconds', { n: formatNumber(record.gaze.onStimulusSeconds, 1) })}</dd>
        </div>
        <div>
          <dt>{t('metric.avoidance')}</dt>
          <dd>{record.avoidanceCount}</dd>
        </div>
      </dl>
      <SudsBars record={record} />
    </article>
  );
}

function AnalysisPanel({ analysis }: { analysis: Analysis | null }) {
  if (!analysis) {
    return (
      <section className="card" aria-labelledby="analysis-title">
        <h3 id="analysis-title">{t('analysis.title')}</h3>
        <EmptyState>{t('analysis.none')}</EmptyState>
      </section>
    );
  }
  return (
    <section className="card card--analysis" aria-labelledby="analysis-title">
      <div className="card__head">
        <h3 id="analysis-title">{t('analysis.title')}</h3>
        <PendingBadge />
      </div>
      <div className="analysis-grid">
        <StatCard label={t('analysis.tolerance')} value={formatPercent(analysis.toleranceIndex)}>
          <span className="meter" aria-hidden="true">
            <span className="meter__fill" style={{ width: `${analysis.toleranceIndex * 100}%` }} />
          </span>
        </StatCard>
        <StatCard label={t('analysis.recommendation')}>
          <p className="stat__value">{tDynamic(`recommendation.${analysis.recommendation}`, 'recommendation.none')}</p>
        </StatCard>
      </div>
      <p className="pending-note">{t('clinical.pending.explain')}</p>
      <h4>{t('analysis.basis.title')}</h4>
      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th scope="col">{t('analysis.basis.feature')}</th>
              <th scope="col">{t('analysis.basis.value')}</th>
              <th scope="col">{t('analysis.basis.effect')}</th>
            </tr>
          </thead>
          <tbody>
            {analysis.basis.map((b) => (
              <tr key={b.feature}>
                <td data-label={t('analysis.basis.feature')}>{featureText(b.feature)}</td>
                <td data-label={t('analysis.basis.value')}>{formatNumber(b.value, 2)}</td>
                <td data-label={t('analysis.basis.effect')}>
                  <span className={`chip chip--effect-${b.effect}`}>{tDynamic(`analysis.effect.${b.effect}`, 'common.noData')}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">{t('analysis.method', { method: analysis.method, version: analysis.methodVersion })}</p>
    </section>
  );
}

function featureText(feature: string): string {
  // Unknown features (new backend versions) show their technical name instead of failing.
  const key = `analysis.feature.${feature}`;
  const text = tDynamic(key, 'common.noData');
  return text === t('common.noData') ? feature : text;
}

export function SessionDetailView({ detail }: { detail: SessionDetail }) {
  return (
    <div className="stack">
      {detail.testSession && (
        <p className="badge badge--test" role="note">
          {t('session.test')}
        </p>
      )}
      <div className="stats">
        <StatCard label={t('session.levelReached')} value={levelLabel(detail.levelReached)} />
        <StatCard label={t('session.duration')} value={formatMinutes(detail.totalDurationSeconds)} />
        <StatCard label={t('session.phobiaGrade')} value={String(detail.phobiaGrade)} />
        <StatCard
          label={t('session.endReason')}
          value={detail.endReason ? tDynamic(`endReason.${detail.endReason}`, 'common.noData') : t('common.noData')}
        />
      </div>
      <AnalysisPanel analysis={detail.analysis} />
      <section aria-labelledby="levels-title" className="stack">
        <h3 id="levels-title">{t('session.levels.title')}</h3>
        {detail.levels.length === 0 ? (
          <EmptyState>{t('session.levels.empty')}</EmptyState>
        ) : (
          <div className="level-grid">
            {detail.levels.map((record) => (
              <LevelCard key={`${record.level}-${record.attempt}`} record={record} />
            ))}
          </div>
        )}
        <p className="muted small">{t('suds.source')}</p>
      </section>
      <p className="muted small">{formatDateTime(detail.startedAt)}</p>
    </div>
  );
}
