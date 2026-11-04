import { useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router';
import { patients } from '../../api/endpoints';
import type { Note, PatientListItem, Progress, SessionSummary } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { levelLabel, RecommendationTag, SessionDetailView, SessionsTable, StatCard, ToleranceChart } from '../../components/Clinical';
import { Alert, EmptyState, ErrorState, Loading } from '../../components/Feedback';
import { SelectField, TextAreaField } from '../../components/Field';
import { PageHeader, useDocumentTitle } from '../../components/Layout';
import { PairingCodePanel } from '../../components/PairingCodePanel';
import { errorMessage, fieldErrorsFrom, useApi, usePaged } from '../../hooks/useApi';
import { formatDate, formatDateTime, t } from '../../i18n';

interface PatientsContext {
  list: PatientListItem[];
}

interface PatientContext {
  patientId: string;
  progress: Progress;
  reloadProgress: () => void;
}

const base = (patientId: string) => `/profesional/pacientes/${patientId}`;

/** HU-12: only the patients assigned to this professional (RQFN004). */
export function ProfessionalPatientsPage() {
  const { patientId } = useParams();
  const { data, error, loading, reload } = useApi(() => patients.list({ limit: 100 }), []);
  const list = data?.items ?? [];

  return (
    <>
      <PageHeader title={t('patients.title')} lead={t('patients.lead')} />
      <div className={`split${patientId ? ' split--detail' : ''}`}>
        <nav className="split__list card" aria-label={t('patients.listLabel')}>
          <h2 className="h-small">{t('patients.listLabel')}</h2>
          {loading && <Loading />}
          {Boolean(error) && <ErrorState error={error} onRetry={reload} />}
          {data && list.length === 0 && <EmptyState>{t('patients.empty')}</EmptyState>}
          <ul className="patient-list">
            {list.map((p) => (
              <li key={p.patientId}>
                <NavLink to={base(p.patientId)} className="patient-link">
                  <span className="patient-link__avatar" aria-hidden="true">
                    {p.fullName.slice(0, 1)}
                  </span>
                  <span className="patient-link__body">
                    <span className="patient-link__name">{p.fullName}</span>
                    <span className="patient-link__meta">
                      {p.lastSessionAt ? t('patients.lastSession', { date: formatDate(p.lastSessionAt) }) : t('patients.noSessions')}
                    </span>
                  </span>
                  <span className="patient-link__level">{levelLabel(p.levelReached)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="split__detail">
          {patientId ? (
            <Outlet context={{ list } satisfies PatientsContext} />
          ) : (
            <div className="card placeholder">
              <p>{t('patients.select')}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function ProfessionalPatientDetail() {
  const { patientId = '' } = useParams();
  const { list } = useOutletContext<PatientsContext>();
  const patient = list.find((p) => p.patientId === patientId);
  const { data, error, loading, reload } = useApi(() => patients.progress(patientId), [patientId]);
  useDocumentTitle(patient?.fullName ?? t('patients.title'));

  return (
    <div className="stack">
      <div className="detail-head">
        <Link to="/profesional" className="back-link">
          {t('common.back')}
        </Link>
        <h2 className="detail-head__name">{patient?.fullName ?? t('common.noData')}</h2>
        {data && <p className="muted">{t('patient.summaryLine', { n: data.sessionsCount })}</p>}
      </div>
      <nav aria-label={t('patient.tabs')} className="tabs">
        <NavLink end to={base(patientId)} className="tabs__link">
          {t('patient.tab.summary')}
        </NavLink>
        <NavLink to={`${base(patientId)}/sesiones`} className="tabs__link">
          {t('patient.tab.sessions')}
        </NavLink>
        <NavLink to={`${base(patientId)}/notas`} className="tabs__link">
          {t('patient.tab.notes')}
        </NavLink>
        <NavLink to={`${base(patientId)}/plan`} className="tabs__link">
          {t('patient.tab.plan')}
        </NavLink>
      </nav>
      {loading && <Loading />}
      {Boolean(error) && <ErrorState error={error} onRetry={reload} />}
      {data && <Outlet context={{ patientId, progress: data, reloadProgress: reload } satisfies PatientContext} />}
    </div>
  );
}

export function PatientSummaryTab() {
  const { patientId, progress } = useOutletContext<PatientContext>();
  const lastRecommendation = progress.lastSessions.find((s) => s.recommendation)?.recommendation;
  return (
    <div className="stack">
      <div className="stats">
        <StatCard label={t('stats.lastRecommendation')}>
          <RecommendationTag value={lastRecommendation} />
        </StatCard>
        <StatCard label={t('stats.levelReached')} value={levelLabel(progress.levelReached)} />
        {progress.allowedStartLevel !== undefined && (
          <StatCard label={t('stats.allowedStartLevel')} value={levelLabel(progress.allowedStartLevel)} />
        )}
      </div>
      <p className="pending-note">{t('clinical.pending.explain')}</p>
      <section className="card" aria-labelledby="pchart-title">
        <h3 id="pchart-title">{t('chart.tolerance.title')}</h3>
        <ToleranceChart sessions={progress.lastSessions} />
      </section>
      <section className="card" aria-labelledby="phistory-title">
        <h3 id="phistory-title">{t('sessions.title')}</h3>
        <SessionsTable sessions={progress.lastSessions} linkTo={(id) => `${base(patientId)}/sesiones/${id}`} caption={t('sessions.title')} />
      </section>
    </div>
  );
}

export function PatientSessionsTab() {
  const { patientId } = useOutletContext<PatientContext>();
  const { items, error, loading, hasMore, loadMore, reload } = usePaged((cursor) => patients.sessions(patientId, { cursor }), [patientId]);
  return (
    <section className="card" aria-labelledby="psessions-title">
      <h3 id="psessions-title">{t('sessions.title')}</h3>
      {Boolean(error) && <ErrorState error={error} onRetry={reload} />}
      {!loading || items.length ? (
        <SessionsTable sessions={items} linkTo={(id) => `${base(patientId)}/sesiones/${id}`} caption={t('sessions.title')} />
      ) : null}
      {loading && <Loading />}
      {hasMore && !loading && (
        <button type="button" className="btn btn--ghost" onClick={loadMore}>
          {t('common.loadMore')}
        </button>
      )}
    </section>
  );
}

export function PatientSessionTab() {
  const { patientId } = useOutletContext<PatientContext>();
  const { sessionId = '' } = useParams();
  const { data, error, loading, reload } = useApi(() => patients.session(patientId, sessionId), [patientId, sessionId]);
  return (
    <div className="stack">
      <div className="row row--between">
        <h3>{data ? t('session.subtitle', { date: formatDate(data.startedAt) }) : t('session.title')}</h3>
        <Link to={`${base(patientId)}/sesiones`} className="btn btn--ghost btn--sm">
          {t('session.backToList')}
        </Link>
      </div>
      {loading && <Loading />}
      {Boolean(error) && <ErrorState error={error} onRetry={reload} />}
      {data && <SessionDetailView detail={data} />}
    </div>
  );
}

function NoteItem({ note, patientId, sessions, onSaved }: { note: Note; patientId: string; sessions: SessionSummary[]; onSaved: () => void }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  const [error, setError] = useState<string | null>(null);
  const session = note.sessionId ? sessions.find((s) => s.sessionId === note.sessionId) : undefined;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) {
      setError(t('validation.noteText'));
      return;
    }
    try {
      await patients.updateNote(patientId, note.noteId, text.trim());
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <li className="note">
      <header className="note__head">
        <p className="note__date">
          {formatDateTime(note.createdAt)}
          {note.sessionId && (
            <span className="chip chip--muted">
              {session ? t('notes.session.option', { date: formatDate(session.startedAt) }) : t('notes.session')}
            </span>
          )}
        </p>
        {user?.id === note.authorUserId && !editing && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(true)} aria-label={t('notes.editLabel', { date: formatDateTime(note.createdAt) })}>
            {t('common.edit')}
          </button>
        )}
      </header>
      {editing ? (
        <form onSubmit={save} className="form" noValidate>
          <TextAreaField label={t('notes.text')} value={text} onChange={(e) => setText(e.target.value)} error={error ?? undefined} rows={4} />
          <div className="row">
            <button type="submit" className="btn btn--primary btn--sm">
              {t('notes.saveEdit')}
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <p className="note__text">{note.text}</p>
      )}
      {note.editedAt && <p className="muted small">{t('notes.edited', { date: formatDateTime(note.editedAt) })}</p>}
    </li>
  );
}

/** HU-13: dated notes linked to the patient and, optionally, to a session. */
export function PatientNotesTab() {
  const { patientId, progress } = useOutletContext<PatientContext>();
  const formRef = useRef<HTMLFormElement>(null);
  const notes = usePaged((cursor) => patients.notes(patientId, { cursor }), [patientId]);
  const [text, setText] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!text.trim()) {
      setErrors({ text: t('validation.noteText') });
      formRef.current?.querySelector('textarea')?.focus();
      return;
    }
    setSaving(true);
    try {
      await patients.createNote(patientId, { text: text.trim(), ...(sessionId ? { sessionId } : {}) });
      setText('');
      setSessionId('');
      setErrors({});
      setMessage({ tone: 'success', text: t('notes.saved') });
      notes.reload();
    } catch (err) {
      setErrors(fieldErrorsFrom(err));
      setMessage({ tone: 'error', text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid-notes">
      <section className="card" aria-labelledby="new-note-title">
        <h3 id="new-note-title">{t('notes.new')}</h3>
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <form ref={formRef} onSubmit={submit} noValidate className="form">
          <SelectField label={t('notes.session')} value={sessionId} onChange={(e) => setSessionId(e.target.value)} error={errors.sessionId}>
            <option value="">{t('notes.session.none')}</option>
            {progress.lastSessions.map((s) => (
              <option key={s.sessionId} value={s.sessionId}>
                {t('notes.session.option', { date: formatDate(s.startedAt) })}
              </option>
            ))}
          </SelectField>
          <TextAreaField
            label={t('notes.text')}
            placeholder={t('notes.text.placeholder')}
            required
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            error={errors.text}
          />
          <div className="row">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? t('common.loading') : t('notes.save')}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setText('');
                setSessionId('');
                setErrors({});
              }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </section>
      <section aria-labelledby="notes-title" className="stack">
        <h3 id="notes-title">{t('notes.previous')}</h3>
        {Boolean(notes.error) && <ErrorState error={notes.error} onRetry={notes.reload} />}
        {!notes.loading && notes.items.length === 0 && <EmptyState>{t('notes.empty')}</EmptyState>}
        <ul className="note-list">
          {notes.items.map((note) => (
            <NoteItem key={note.noteId + (note.editedAt ?? '')} note={note} patientId={patientId} sessions={progress.lastSessions} onSaved={notes.reload} />
          ))}
        </ul>
        {notes.loading && <Loading />}
        {notes.hasMore && !notes.loading && (
          <button type="button" className="btn btn--ghost" onClick={notes.loadMore}>
            {t('common.loadMore')}
          </button>
        )}
      </section>
    </div>
  );
}

/** Allowed start level (PUT /patients/{id}/plan) and pairing code for the patient's headset (D20). */
export function PatientPlanTab() {
  const { patientId, progress, reloadProgress } = useOutletContext<PatientContext>();
  const [level, setLevel] = useState(String(progress.allowedStartLevel ?? 1));
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await patients.setPlan(patientId, { allowedStartLevel: Number(level) });
      setMessage({ tone: 'success', text: t('plan.saved') });
      reloadProgress();
    } catch (err) {
      setMessage({ tone: 'error', text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid-2">
      <section className="card" aria-labelledby="plan-title">
        <h3 id="plan-title">{t('plan.title')}</h3>
        <p className="muted">{t('plan.lead')}</p>
        {progress.allowedStartLevel !== undefined && <p>{t('plan.current', { n: progress.allowedStartLevel })}</p>}
        {message && <Alert tone={message.tone}>{message.text}</Alert>}
        <form onSubmit={save} className="form">
          <SelectField label={t('plan.select')} value={level} onChange={(e) => setLevel(e.target.value)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {`${levelLabel(n)} · ${t(`level.${n as 1 | 2 | 3 | 4 | 5}.name`)}`}
              </option>
            ))}
          </SelectField>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? t('common.loading') : t('plan.save')}
          </button>
        </form>
      </section>
      <section className="card" aria-labelledby="ppairing-title">
        <h3 id="ppairing-title">{t('plan.pairing.title')}</h3>
        <p className="muted">{t('plan.pairing.lead')}</p>
        <PairingCodePanel create={() => patients.createPairingCode(patientId)} />
      </section>
    </div>
  );
}
