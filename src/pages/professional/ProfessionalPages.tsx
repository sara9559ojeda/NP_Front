import { useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useOutletContext, useParams, useSearchParams } from 'react-router';
import { patients } from '../../api/endpoints';
import type { Note, PatientListItem, Progress, SessionSummary } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { FeedbackSummary, levelLabel, levelName, SessionDetailView, SessionsTable, SummaryList, ToleranceChart } from '../../components/Clinical';
import { PageHeader, useDocumentTitle } from '../../components/Layout';
import { PairingCodePanel } from '../../components/PairingCodePanel';
import { LEVELS } from '../../components/signature/DistanceRuler';
import { Alert, EmptyState, ErrorState, Loading } from '../../components/ui/Feedback';
import { SelectField, TextAreaField } from '../../components/ui/Field';
import { riseOrder } from '../../components/ui/rise';
import { useToast } from '../../components/ui/Toast';
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

/** Query parameter that filters the notes tab by session (visible in the URL, so in Spanish). */
const SESSION_PARAM = 'sesion';

const base = (patientId: string) => `/profesional/pacientes/${patientId}`;
const notesForSession = (patientId: string, sessionId: string) => `${base(patientId)}/notas?${SESSION_PARAM}=${encodeURIComponent(sessionId)}`;

function initials(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/** HU-12: only the patients assigned to this professional (RQFN004). */
export function ProfessionalPatientsPage() {
  const { patientId } = useParams();
  const { data, error, loading, reload } = useApi(() => patients.list({ limit: 100 }), []);
  const list = data?.items ?? [];

  return (
    <>
      <PageHeader title={t('patients.title')} lead={t('patients.lead')} />
      <div className="pro-layout">
        <nav className="rise" style={riseOrder(2)} aria-label={t('patients.listLabel')}>
          {loading && <Loading />}
          {Boolean(error) && <ErrorState error={error} onRetry={reload} />}
          {data && list.length === 0 && <EmptyState>{t('patients.empty')}</EmptyState>}
          <ul className="patient-list">
            {list.map((p) => (
              <li key={p.patientId}>
                <NavLink to={base(p.patientId)} className="patient-link" viewTransition>
                  <span className="avatar" aria-hidden="true">
                    {initials(p.fullName)}
                  </span>
                  <span className="patient-link__body">
                    <span className="patient-link__name">{p.fullName}</span>
                    <span className="patient-link__meta">
                      {p.lastSessionAt ? t('patients.lastSession', { date: formatDate(p.lastSessionAt) }) : t('patients.noSessions')}
                      {p.phobiaGrade != null && ` · ${t('patients.phobiaGrade', { n: p.phobiaGrade })}`}
                    </span>
                    <span className="mini-ruler" aria-hidden="true">
                      <span className="mini-ruler__fill" style={{ '--fill': `${((p.levelReached ?? 0) / LEVELS.length) * 100}%` } as CSSProperties} />
                    </span>
                    <span className="sr-only">{levelLabel(p.levelReached)}</span>
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="pro-layout__detail">
          {patientId ? (
            <Outlet context={{ list } satisfies PatientsContext} />
          ) : (
            <div className="card empty-detail">
              <p className="muted">{t('patients.select')}</p>
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
        <h2>{patient?.fullName ?? t('common.noData')}</h2>
        {data && (
          <SummaryList
            items={[
              { label: t('stats.sessions'), value: data.sessionsCount },
              { label: t('stats.levelReached'), value: levelLabel(data.levelReached) },
              { label: t('stats.allowedStartLevel'), value: levelLabel(data.allowedStartLevel) },
              { label: t('session.phobiaGrade'), value: patient?.phobiaGrade ?? t('common.noData') },
            ]}
          />
        )}
      </div>
      <nav aria-label={t('patient.tabs')} className="tabs">
        <NavLink end to={base(patientId)} className="tabs__link" viewTransition>
          {t('patient.tab.summary')}
        </NavLink>
        <NavLink to={`${base(patientId)}/retroalimentacion`} className="tabs__link" viewTransition>
          {t('patient.tab.feedback')}
        </NavLink>
        <NavLink to={`${base(patientId)}/sesiones`} className="tabs__link" viewTransition>
          {t('patient.tab.sessions')}
        </NavLink>
        <NavLink to={`${base(patientId)}/notas`} className="tabs__link" viewTransition>
          {t('patient.tab.notes')}
        </NavLink>
        <NavLink to={`${base(patientId)}/plan`} className="tabs__link" viewTransition>
          {t('patient.tab.plan')}
        </NavLink>
      </nav>
      {loading && !data && <Loading />}
      {Boolean(error) && <ErrorState error={error} onRetry={reload} />}
      {data && <Outlet context={{ patientId, progress: data, reloadProgress: reload } satisfies PatientContext} />}
    </div>
  );
}

/** Latest AI feedback, with the professional's figures (sequence "Revisar avance → Consultar retroalimentación"). */
function LatestFeedback({ patientId }: { patientId: string }) {
  const { data, error, loading, reload } = useApi(() => patients.feedback(patientId, { limit: 1 }), [patientId]);
  const latest = data?.items[0];
  return (
    <section className="card" aria-labelledby="latest-feedback-title">
      <div className="card__head">
        <h3 id="latest-feedback-title">{t('feedback.latestTitle')}</h3>
        {latest && (
          <Link to={`${base(patientId)}/retroalimentacion`} viewTransition>
            {t('feedback.viewAll')}
          </Link>
        )}
      </div>
      {loading && !data && <Loading />}
      {Boolean(error) && <ErrorState error={error} onRetry={reload} />}
      {data && !latest && <EmptyState>{t('feedback.empty')}</EmptyState>}
      {latest && <FeedbackSummary feedback={latest} audience="professional" />}
    </section>
  );
}

export function PatientSummaryTab() {
  const { patientId, progress } = useOutletContext<PatientContext>();
  return (
    <div className="pro-summary">
      <section className="card pro-summary__wide" aria-labelledby="pchart-title">
        <h3 id="pchart-title">{t('chart.tolerance.title')}</h3>
        <ToleranceChart sessions={progress.lastSessions} />
      </section>
      <LatestFeedback patientId={patientId} />
      <section className="card pro-summary__wide" aria-labelledby="phistory-title">
        <h3 id="phistory-title">{t('sessions.title')}</h3>
        <SessionsTable sessions={progress.lastSessions} linkTo={(id) => `${base(patientId)}/sesiones/${id}`} caption={t('sessions.title')} />
      </section>
    </div>
  );
}

/** v1.1.0 GET /patients/{id}/feedback: every analysed session, newest first. */
export function PatientFeedbackTab() {
  const { patientId } = useOutletContext<PatientContext>();
  const { items, error, loading, hasMore, loadMore, reload } = usePaged((cursor) => patients.feedback(patientId, { cursor }), [patientId]);
  return (
    <section className="stack" aria-labelledby="feedback-list-title">
      <h3 id="feedback-list-title">{t('feedback.listTitle')}</h3>
      {Boolean(error) && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && items.length === 0 && <EmptyState>{t('feedback.empty')}</EmptyState>}
      <ul className="feedback-list">
        {items.map((item) => (
          <li key={item.sessionId} className="card">
            <FeedbackSummary feedback={item} audience="professional">
              <div className="row">
                <Link to={notesForSession(patientId, item.sessionId)} className="btn btn--sm" viewTransition>
                  {t('feedback.notesLink', { n: item.notesCount })}
                </Link>
                <Link
                  to={`${base(patientId)}/sesiones/${item.sessionId}`}
                  className="btn btn--sm"
                  aria-label={t('sessions.viewLabel', { date: formatDate(item.startedAt) })}
                  viewTransition
                >
                  {t('feedback.viewSession')}
                </Link>
              </div>
            </FeedbackSummary>
          </li>
        ))}
      </ul>
      {loading && <Loading />}
      {hasMore && !loading && (
        <button type="button" className="btn" onClick={loadMore}>
          {t('common.loadMore')}
        </button>
      )}
    </section>
  );
}

export function PatientSessionsTab() {
  const { patientId } = useOutletContext<PatientContext>();
  const { items, error, loading, hasMore, loadMore, reload } = usePaged((cursor) => patients.sessions(patientId, { cursor }), [patientId]);
  return (
    <section className="card stack" aria-labelledby="psessions-title">
      <h3 id="psessions-title">{t('sessions.title')}</h3>
      {Boolean(error) && <ErrorState error={error} onRetry={reload} />}
      {!loading || items.length ? (
        <SessionsTable sessions={items} linkTo={(id) => `${base(patientId)}/sesiones/${id}`} caption={t('sessions.title')} />
      ) : null}
      {loading && <Loading />}
      {hasMore && !loading && (
        <button type="button" className="btn" onClick={loadMore}>
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
        <Link to={`${base(patientId)}/sesiones`} className="btn btn--sm" viewTransition>
          {t('session.backToList')}
        </Link>
      </div>
      {loading && <Loading />}
      {Boolean(error) && <ErrorState error={error} onRetry={reload} />}
      {data && <SessionDetailView detail={data} />}
    </div>
  );
}

interface NoteItemProps {
  note: Note;
  patientId: string;
  sessions: SessionSummary[];
  isNew: boolean;
  onSaved: () => void;
}

function NoteItem({ note, patientId, sessions, isNew, onSaved }: NoteItemProps) {
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
    <li className={`note${isNew ? ' note--new' : ''}`}>
      <header className="note__head">
        <p className="mono muted">
          {formatDateTime(note.createdAt)}
          {note.authorName && ` · ${note.authorName}`}
        </p>
        {note.sessionId && (
          <span className="tag tag--muted">{session ? t('notes.session.option', { date: formatDate(session.startedAt) }) : t('notes.session')}</span>
        )}
      </header>
      {editing ? (
        <form onSubmit={save} className="form" noValidate>
          <TextAreaField label={t('notes.text')} value={text} onChange={(e) => setText(e.target.value)} error={error ?? undefined} rows={4} />
          <div className="row">
            <button type="submit" className="btn btn--primary btn--sm">
              {t('notes.saveEdit')}
            </button>
            <button type="button" className="btn btn--sm" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <p className="note__text">{note.text}</p>
      )}
      <div className="row row--between">
        {note.editedAt ? <p className="muted small">{t('notes.edited', { date: formatDateTime(note.editedAt) })}</p> : <span />}
        {user?.id === note.authorUserId && !editing && (
          <button type="button" className="btn btn--sm" onClick={() => setEditing(true)} aria-label={t('notes.editLabel', { date: formatDateTime(note.createdAt) })}>
            {t('common.edit')}
          </button>
        )}
      </div>
    </li>
  );
}

/** HU-13: dated notes linked to the patient and, optionally, to a session; `?sesion=` filters by session. */
export function PatientNotesTab() {
  const { patientId, progress } = useOutletContext<PatientContext>();
  const [searchParams] = useSearchParams();
  const filterSessionId = searchParams.get(SESSION_PARAM) ?? '';
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const notes = usePaged((cursor) => patients.notes(patientId, { cursor, sessionId: filterSessionId || undefined }), [patientId, filterSessionId]);
  const [text, setText] = useState('');
  const [sessionId, setSessionId] = useState(filterSessionId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newNoteId, setNewNoteId] = useState<string | null>(null);
  const filterSession = progress.lastSessions.find((s) => s.sessionId === filterSessionId);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!text.trim()) {
      setErrors({ text: t('validation.noteText') });
      formRef.current?.querySelector('textarea')?.focus();
      return;
    }
    setSaving(true);
    try {
      // v1.1.0: the 201 body is the whole note, so it goes straight into the list.
      const created = await patients.createNote(patientId, { text: text.trim(), ...(sessionId ? { sessionId } : {}) });
      if (!filterSessionId || created.sessionId === filterSessionId) notes.prepend(created);
      setNewNoteId(created.noteId);
      setText('');
      setErrors({});
      toast(t('notes.saved'));
    } catch (err) {
      setErrors(fieldErrorsFrom(err));
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="notes-layout">
      <section className="card" aria-labelledby="new-note-title">
        <h3 id="new-note-title">{t('notes.new')}</h3>
        <form ref={formRef} onSubmit={submit} noValidate className="form">
          {formError && <Alert tone="error">{formError}</Alert>}
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
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? t('common.loading') : t('notes.save')}
          </button>
        </form>
      </section>
      <section aria-labelledby="notes-title" className="stack">
        <div className="row row--between">
          <h3 id="notes-title">{t('notes.previous')}</h3>
          {filterSessionId && (
            <Link to={`${base(patientId)}/notas`} viewTransition>
              {t('notes.filter.clear')}
            </Link>
          )}
        </div>
        {filterSessionId && (
          <p>
            <span className="tag tag--muted">
              {t('notes.filter.active', { date: filterSession ? formatDate(filterSession.startedAt) : t('common.noData') })}
            </span>
          </p>
        )}
        {Boolean(notes.error) && <ErrorState error={notes.error} onRetry={notes.reload} />}
        {!notes.loading && notes.items.length === 0 && <EmptyState>{t('notes.empty')}</EmptyState>}
        <ul className="note-list">
          {notes.items.map((note) => (
            <NoteItem
              key={note.noteId + (note.editedAt ?? '')}
              note={note}
              patientId={patientId}
              sessions={progress.lastSessions}
              isNew={note.noteId === newNoteId}
              onSaved={notes.reload}
            />
          ))}
        </ul>
        {notes.loading && <Loading />}
        {notes.hasMore && !notes.loading && (
          <button type="button" className="btn" onClick={notes.loadMore}>
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
  const toast = useToast();
  const [level, setLevel] = useState(progress.allowedStartLevel === undefined ? '' : String(progress.allowedStartLevel));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!level) return;
    setSaving(true);
    setError(null);
    try {
      await patients.setPlan(patientId, { allowedStartLevel: Number(level) });
      toast(t('plan.saved'));
      reloadProgress();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid-2">
      <section className="card stack" aria-labelledby="plan-title">
        <div>
          <h3 id="plan-title">{t('plan.title')}</h3>
          <p className="muted">{t('plan.lead')}</p>
        </div>
        {progress.allowedStartLevel !== undefined && <p>{t('plan.current', { n: progress.allowedStartLevel })}</p>}
        {error && <Alert tone="error">{error}</Alert>}
        <form onSubmit={save} className="form">
          <SelectField label={t('plan.select')} value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="" disabled>
              {t('common.noData')}
            </option>
            {LEVELS.map((n) => (
              <option key={n} value={n}>
                {`${levelLabel(n)} · ${levelName(n)}`}
              </option>
            ))}
          </SelectField>
          <button type="submit" className="btn btn--primary" disabled={saving || !level}>
            {saving ? t('common.loading') : t('plan.save')}
          </button>
        </form>
      </section>
      <section className="card" aria-labelledby="ppairing-title">
        <h3 id="ppairing-title">{t('plan.pairing.title')}</h3>
        <p className="muted card__sub">{t('plan.pairing.lead')}</p>
        <PairingCodePanel create={() => patients.createPairingCode(patientId)} />
      </section>
    </div>
  );
}
