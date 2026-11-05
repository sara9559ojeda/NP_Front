import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { me } from '../../api/endpoints';
import type { TherapyState } from '../../api/types';
import { errorMessage } from '../../hooks/useApi';
import { formatTime, t, tDynamic } from '../../i18n';
import { levelLabel, levelName } from '../Clinical';
import { DistanceRuler, isLevel } from '../signature/DistanceRuler';
import { useToast } from '../ui/Toast';
import { MAX_GRADE, MIN_GRADE, PhobiaGradePicker } from './PhobiaGradePicker';

/** How often the page asks whether the headset started or closed the session. */
export const THERAPY_POLL_MS = 10_000;
const DEFAULT_GRADE = 3;

/**
 * What the patient sees, following the BPMN "Iniciar terapia":
 * needsDevice → idle → saving → ready (put on the headset) → running → done, with error after saving.
 */
export type TherapyStatus = 'needsDevice' | 'idle' | 'saving' | 'ready' | 'running' | 'done' | 'error';

type LocalPhase = 'idle' | 'saving' | 'ready' | 'error';

function clampGrade(value: number | null): number {
  if (value === null) return DEFAULT_GRADE;
  return Math.min(MAX_GRADE, Math.max(MIN_GRADE, value));
}

interface TherapyPanelProps {
  therapy: TherapyState;
  onRefresh: () => void;
}

/** "Sesión de hoy": adjust the phobia grade, save it and follow the session started in the headset. */
export function TherapyPanel({ therapy, onRefresh }: TherapyPanelProps) {
  const toast = useToast();
  const [grade, setGrade] = useState(() => clampGrade(therapy.phobiaGrade));
  const [phase, setPhase] = useState<LocalPhase>('idle');
  const [error, setError] = useState<unknown>(null);
  const [finished, setFinished] = useState(false);
  const previousOpenSession = useRef(therapy.openSession);

  // The headset closes the session on its own; when it does, say so once.
  useEffect(() => {
    if (previousOpenSession.current && !therapy.openSession) {
      setFinished(true);
      setPhase('idle');
      toast(t('therapy.status.done.title'));
    }
    previousOpenSession.current = therapy.openSession;
  }, [therapy.openSession, toast]);

  const status: TherapyStatus =
    therapy.pairedDevices === 0
      ? 'needsDevice'
      : therapy.openSession
        ? 'running'
        : phase !== 'idle'
          ? phase
          : finished
            ? 'done'
            : 'idle';

  useEffect(() => {
    if (status !== 'ready' && status !== 'running') return;
    const timer = window.setInterval(onRefresh, THERAPY_POLL_MS);
    return () => window.clearInterval(timer);
  }, [status, onRefresh]);

  const save = async () => {
    setPhase('saving');
    setError(null);
    setFinished(false);
    try {
      await me.setPhobiaGrade({ phobiaGrade: grade });
      setPhase('ready');
      toast(t('therapy.gradeSaved'));
      onRefresh();
    } catch (err) {
      setError(err);
      setPhase('error');
    }
  };

  const startLevel = therapy.allowedStartLevel;
  const statusBody =
    status === 'error'
      ? errorMessage(error)
      : status === 'running'
        ? t('therapy.status.running.body', { time: formatTime(therapy.openSession?.startedAt) })
        : tDynamic(`therapy.status.${status}.body`, 'common.noData');

  return (
    <section className="card therapy" aria-labelledby="therapy-title">
      <div>
        <h2 id="therapy-title">{t('therapy.title')}</h2>
        <p className="muted">{t('therapy.lead')}</p>
      </div>

      {isLevel(startLevel) && <DistanceRuler level={startLevel} compact />}
      <p className="therapy__start">
        {t('therapy.startLevel', { level: levelLabel(startLevel), name: levelName(startLevel) })}
      </p>

      <PhobiaGradePicker value={grade} onChange={setGrade} disabled={status === 'saving' || status === 'running'} updatedAt={therapy.phobiaGradeUpdatedAt} />

      <div className="therapy-status" data-status={status} role="status" aria-live="polite">
        <span className="therapy-status__dot" aria-hidden="true" />
        <div>
          <p className="therapy-status__title">{tDynamic(`therapy.status.${status}.title`, 'common.noData')}</p>
          <p className="therapy-status__body">{statusBody}</p>
        </div>
      </div>

      <div className="row">
        {status === 'needsDevice' && (
          <Link to="/paciente/visor" className="btn btn--primary" viewTransition>
            {t('therapy.action.pair')} <span className="btn__arrow" aria-hidden="true">→</span>
          </Link>
        )}
        {(status === 'idle' || status === 'done' || status === 'saving') && (
          <button type="button" className="btn btn--primary" onClick={save} disabled={status === 'saving'}>
            {status === 'saving' ? t('therapy.action.saving') : t('therapy.action.save')}
            {status !== 'saving' && (
              <span className="btn__arrow" aria-hidden="true">
                →
              </span>
            )}
          </button>
        )}
        {status === 'error' && (
          <button type="button" className="btn btn--primary" onClick={save}>
            {t('common.retry')}
          </button>
        )}
        {(status === 'ready' || status === 'running') && (
          <button type="button" className="btn btn--primary" onClick={onRefresh}>
            {t('therapy.action.refresh')}
          </button>
        )}
        {status === 'ready' && (
          <button type="button" className="btn" onClick={() => setPhase('idle')}>
            {t('therapy.action.change')}
          </button>
        )}
      </div>
    </section>
  );
}
