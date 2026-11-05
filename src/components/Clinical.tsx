import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Analysis, AnalysisBasis, LevelRecord, RecommendationValue, SessionDetail, SessionFeedback, SessionSummary, SudsPhase } from '../api/types';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { formatDate, formatDateTime, formatMinutes, formatNumber, formatPercent, t, tDynamic, type TextKey } from '../i18n';
import { EmptyState, PendingTag } from './ui/Feedback';

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
    <span className="tag-group">
      <span className="tag">{tDynamic(`recommendation.${value}`, 'recommendation.none')}</span>
      <PendingTag />
    </span>
  );
}

export interface SummaryItem {
  label: string;
  value: ReactNode;
}

/** Inline key figures ("6 sesiones · Nivel alcanzado 2 …"). */
export function SummaryList({ items }: { items: SummaryItem[] }) {
  return (
    <dl className="summary">
      {items.map((item) => (
        <div key={item.label} className="summary__item">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const CHART_W = 640;
const CHART_H = 230;
const PAD = { top: 14, right: 16, bottom: 34, left: 40 };

/** Tolerance index per session on a single 0–1 scale (oldest to newest). Values also appear in the table. */
export function ToleranceChart({ sessions }: { sessions: SessionSummary[] }) {
  const descId = useId();
  const reducedMotion = usePrefersReducedMotion();
  const points = sessions
    .filter((s): s is SessionSummary & { toleranceIndex: number } => typeof s.toleranceIndex === 'number')
    .sort((a, b) => (a.startedAt ?? '').localeCompare(b.startedAt ?? ''));

  if (points.length === 0) return <EmptyState>{t('chart.tolerance.empty')}</EmptyState>;

  const innerW = CHART_W - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i * innerW) / (points.length - 1));
  const y = (v: number) => PAD.top + innerH - v * innerH;
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.toleranceIndex)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  return (
    <figure className={`chart${reducedMotion ? '' : ' chart--draw'}`}>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label={t('chart.tolerance.title')} aria-describedby={descId}>
        <desc id={descId}>{t('chart.tolerance.desc', { n: points.length })}</desc>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={CHART_W - PAD.right} y1={y(v)} y2={y(v)} className="chart__grid" />
            <text x={PAD.left - 8} y={y(v) + 4} className="chart__axis" textAnchor="end">
              {formatNumber(v, 2)}
            </text>
          </g>
        ))}
        <path d={area} className="chart__area" />
        <path d={line} className="chart__line" pathLength={1} />
        {points.map((p, i) => (
          <g key={p.sessionId}>
            <circle
              cx={x(i)}
              cy={y(p.toleranceIndex)}
              r={5}
              className={`chart__point${i === points.length - 1 ? ' chart__point--last' : ''}`}
              style={{ animationDelay: `${600 + i * 70}ms` }}
            >
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
              <td data-label={t('sessions.col.date')} className="mono">
                {formatDate(s.startedAt)}
              </td>
              <td data-label={t('sessions.col.level')}>{levelLabel(s.levelReached)}</td>
              <td data-label={t('sessions.col.duration')}>{formatMinutes(s.totalDurationSeconds)}</td>
              <td data-label={t('sessions.col.tolerance')}>{formatPercent(s.toleranceIndex)}</td>
              <td data-label={t('sessions.col.recommendation')}>
                <RecommendationTag value={s.recommendation} />
              </td>
              <td>
                <Link className="btn btn--sm" to={linkTo(s.sessionId)} aria-label={t('sessions.viewLabel', { date: formatDate(s.startedAt) })} viewTransition>
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

/** "Repetir el nivel 2": the recommendation phrased with the level it points to. */
export function recommendationPhrase(value: RecommendationValue, levelReached: number | null): string {
  if (!levelReached) return tDynamic(`recommendation.${value}`, 'recommendation.none');
  const target = value === 'advance' ? Math.min(levelReached + 1, 5) : value === 'step_back' ? Math.max(levelReached - 1, 1) : levelReached;
  return t(`feedback.phrase.${value}`, { n: target });
}

function durationSeconds(startedAt: string | null, endedAt: string | null): number | null {
  if (!startedAt || !endedAt) return null;
  return (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000;
}

function basisValue(value: AnalysisBasis['value']): string {
  if (typeof value === 'boolean') return t(value ? 'common.yes' : 'common.no');
  return formatNumber(value, 2);
}

function featureText(feature: string): string {
  // Unknown features (new backend versions) show their technical name instead of failing.
  const key = `analysis.feature.${feature}`;
  const text = tDynamic(key, 'common.noData');
  return text === t('common.noData') ? feature : text;
}

export function BasisTable({ basis }: { basis: AnalysisBasis[] }) {
  return (
    <div className="table-wrap">
      <table className="table table--compact">
        <caption className="sr-only">{t('analysis.basis.title')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('analysis.basis.feature')}</th>
            <th scope="col">{t('analysis.basis.value')}</th>
            <th scope="col">{t('analysis.basis.effect')}</th>
          </tr>
        </thead>
        <tbody>
          {basis.map((b) => (
            <tr key={b.feature}>
              <td data-label={t('analysis.basis.feature')}>{featureText(b.feature)}</td>
              <td data-label={t('analysis.basis.value')}>{basisValue(b.value)}</td>
              <td data-label={t('analysis.basis.effect')}>
                <span className={`tag${b.effect === 'unfavorable' ? ' tag--error' : b.effect === 'neutral' ? ' tag--muted' : ''}`}>
                  {tDynamic(`analysis.effect.${b.effect}`, 'common.noData')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface FeedbackSummaryProps {
  feedback: SessionFeedback;
  /** Patients get a plain explanation; professionals also see the figures behind it. */
  audience: 'patient' | 'professional';
  children?: ReactNode;
}

/** One session's AI feedback: the recommendation in words, its pending status and what it rests on. */
export function FeedbackSummary({ feedback, audience, children }: FeedbackSummaryProps) {
  const { analysis } = feedback;
  return (
    <div className="feedback">
      <p className="mono muted">
        {t('feedback.sessionLine', {
          date: formatDate(feedback.startedAt),
          level: levelLabel(feedback.levelReached),
          duration: formatMinutes(durationSeconds(feedback.startedAt, feedback.endedAt)),
        })}
      </p>
      <p className="feedback__phrase">{recommendationPhrase(analysis.recommendation, feedback.levelReached)}</p>
      <p>
        <PendingTag />
      </p>
      {audience === 'professional' && (
        <>
          <dl className="metrics">
            <div>
              <dt>{t('analysis.tolerance')}</dt>
              <dd>{formatNumber(analysis.toleranceIndex, 2)}</dd>
            </div>
            <div>
              <dt>{t('session.phobiaGrade')}</dt>
              <dd>{feedback.phobiaGrade ?? t('common.noData')}</dd>
            </div>
            <div>
              <dt>{t('session.endReason')}</dt>
              <dd>{feedback.endReason ? tDynamic(`endReason.${feedback.endReason}`, 'common.noData') : t('common.noData')}</dd>
            </div>
          </dl>
          <details className="feedback__basis">
            <summary>{t('analysis.basis.title')}</summary>
            <BasisTable basis={analysis.basis} />
            <p className="muted small">{t('analysis.method', { method: analysis.method, version: analysis.methodVersion })}</p>
          </details>
        </>
      )}
      <p className="feedback__why">{t(audience === 'patient' ? 'feedback.patientExplain' : 'clinical.pending.explain')}</p>
      {children}
    </div>
  );
}

const PHASES: SudsPhase[] = ['before', 'during', 'after'];

function SudsBars({ record }: { record: LevelRecord }) {
  return (
    <div>
      <p className="suds__title">{t('suds.title')}</p>
      <dl className="suds__list">
        {PHASES.map((phase) => {
          const entry = record.suds.find((s) => s.phase === phase);
          return (
            <div key={phase} className="suds__row">
              <dt>{t(`suds.phase.${phase}` as TextKey)}</dt>
              <dd>
                <span className="meter" aria-hidden="true">
                  <span className={`meter__fill meter__fill--${phase}`} style={{ width: `${entry?.value ?? 0}%` }} />
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
      <header className="card__head">
        <div>
          <h4>
            {levelLabel(record.level)} · {levelName(record.level)}
          </h4>
          <p className="muted small">{t('level.attempt', { n: record.attempt })}</p>
        </div>
        <span className={`tag${record.outcome === 'completed' ? '' : ' tag--muted'}`}>{tDynamic(`outcome.${record.outcome}`, 'common.noData')}</span>
      </header>
      <dl className="metrics metrics--two">
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
    <section className="card stack" aria-labelledby="analysis-title">
      <div className="card__head">
        <h3 id="analysis-title">{t('analysis.title')}</h3>
        <PendingTag />
      </div>
      <dl className="metrics">
        <div>
          <dt>{t('analysis.tolerance')}</dt>
          <dd>{formatPercent(analysis.toleranceIndex)}</dd>
        </div>
        <div>
          <dt>{t('analysis.recommendation')}</dt>
          <dd>{tDynamic(`recommendation.${analysis.recommendation}`, 'recommendation.none')}</dd>
        </div>
      </dl>
      <p className="feedback__why">{t('clinical.pending.explain')}</p>
      <h4>{t('analysis.basis.title')}</h4>
      <BasisTable basis={analysis.basis} />
      <p className="muted small">{t('analysis.method', { method: analysis.method, version: analysis.methodVersion })}</p>
    </section>
  );
}

export function SessionDetailView({ detail }: { detail: SessionDetail }) {
  return (
    <div className="stack">
      {detail.testSession && (
        <p className="tag tag--muted" role="note">
          {t('session.test')}
        </p>
      )}
      <SummaryList
        items={[
          { label: t('session.levelReached'), value: levelLabel(detail.levelReached) },
          { label: t('session.duration'), value: formatMinutes(detail.totalDurationSeconds) },
          { label: t('session.phobiaGrade'), value: detail.phobiaGrade ?? t('common.noData') },
          { label: t('session.endReason'), value: detail.endReason ? tDynamic(`endReason.${detail.endReason}`, 'common.noData') : t('common.noData') },
        ]}
      />
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
