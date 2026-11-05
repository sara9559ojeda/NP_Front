import { useEffect, useRef, useState, type FormEvent } from 'react';
import { admin } from '../../api/endpoints';
import type { AdminUser, Role } from '../../api/types';
import { Alert, EmptyState, ErrorState, Loading } from '../../components/ui/Feedback';
import { SelectField, TextField } from '../../components/ui/Field';
import { PageHeader } from '../../components/Layout';
import { compact, emailError, focusFirstInvalid, passwordError, requiredError } from '../../components/ui/validation';
import { errorMessage, fieldErrorsFrom, useApi } from '../../hooks/useApi';
import { formatDate, t } from '../../i18n';
import { ApiError } from '../../api/client';

const ROLES: Role[] = ['patient', 'professional', 'admin'];

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function NoClinicalNote() {
  return <p className="scope-note">{t('admin.noClinical')}</p>;
}

type Panel = { mode: 'create' } | { mode: 'edit'; userId: string } | null;

function CreateUserForm({ onDone, onCancel }: { onDone: (text: string) => void; onCancel: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({ fullName: '', email: '', role: 'patient' as Role, temporaryPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const found = compact({
      fullName: requiredError(values.fullName),
      email: emailError(values.email),
      temporaryPassword: passwordError(values.temporaryPassword),
    });
    setErrors(found);
    if (Object.keys(found).length) {
      setFormError(t('validation.summary'));
      focusFirstInvalid(formRef.current);
      return;
    }
    setSaving(true);
    try {
      await admin.createUser({ ...values, fullName: values.fullName.trim(), email: values.email.trim() });
      onDone(t('users.created'));
    } catch (err) {
      const fieldErrors = fieldErrorsFrom(err);
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') fieldErrors.email = t('error.EMAIL_TAKEN');
      setErrors(fieldErrors);
      setFormError(errorMessage(err));
      focusFirstInvalid(formRef.current);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="form">
      <h2>{t('users.create.title')}</h2>
      {formError && <Alert tone="error">{formError}</Alert>}
      <TextField label={t('register.fullName')} required value={values.fullName} onChange={(e) => setValues({ ...values, fullName: e.target.value })} error={errors.fullName} />
      <TextField label={t('register.email')} type="email" required value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} error={errors.email} />
      <SelectField label={t('users.col.role')} value={values.role} onChange={(e) => setValues({ ...values, role: e.target.value as Role })} error={errors.role}>
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {t(`role.${role}`)}
          </option>
        ))}
      </SelectField>
      <TextField
        label={t('users.tempPassword')}
        type="password"
        autoComplete="new-password"
        required
        hint={t('users.tempPassword.hint')}
        value={values.temporaryPassword}
        onChange={(e) => setValues({ ...values, temporaryPassword: e.target.value })}
        error={errors.temporaryPassword}
      />
      <div className="row">
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? t('common.loading') : t('common.save')}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}

interface EditUserFormProps {
  userId: string;
  onDone: (text: string) => void;
  onCancel: () => void;
}

/** v1.1.0: the admin loads the full profile and can change name, email, role and status. */
function EditUserForm({ userId, onDone, onCancel }: EditUserFormProps) {
  const profile = useApi(() => admin.user(userId), [userId]);
  if (profile.loading && !profile.data) return <Loading />;
  if (!profile.data) return <ErrorState error={profile.error} onRetry={profile.reload} />;
  return (
    <div className="stack">
      <ProfileFields user={profile.data} onDone={onDone} onCancel={onCancel} />
      <TemporaryPasswordForm user={profile.data} />
    </div>
  );
}

function ProfileFields({ user, onDone, onCancel }: { user: AdminUser; onDone: (text: string) => void; onCancel: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({ fullName: user.fullName, email: user.email, role: user.role, active: user.active ? 'true' : 'false' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const found = compact({ fullName: requiredError(values.fullName), email: emailError(values.email) });
    setErrors(found);
    if (Object.keys(found).length) {
      setFormError(t('validation.summary'));
      focusFirstInvalid(formRef.current);
      return;
    }
    setSaving(true);
    try {
      await admin.updateUser(user.id, {
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        role: values.role,
        active: values.active === 'true',
      });
      onDone(t('users.updated'));
    } catch (err) {
      const fieldErrors = fieldErrorsFrom(err);
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') fieldErrors.email = t('error.EMAIL_TAKEN');
      setErrors(fieldErrors);
      setFormError(errorMessage(err));
      focusFirstInvalid(formRef.current);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="form">
      <h2>{t('users.edit.title')}</h2>
      {formError && <Alert tone="error">{formError}</Alert>}
      <TextField label={t('register.fullName')} required value={values.fullName} onChange={(e) => setValues({ ...values, fullName: e.target.value })} error={errors.fullName} />
      <TextField label={t('register.email')} type="email" required value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} error={errors.email} />
      <SelectField label={t('users.col.role')} value={values.role} onChange={(e) => setValues({ ...values, role: e.target.value as Role })} error={errors.role}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {t(`role.${r}`)}
          </option>
        ))}
      </SelectField>
      <SelectField label={t('users.col.status')} value={values.active} onChange={(e) => setValues({ ...values, active: e.target.value })}>
        <option value="true">{t('status.active')}</option>
        <option value="false">{t('status.inactive')}</option>
      </SelectField>
      <div className="row">
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? t('common.loading') : t('common.save')}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}

/** v1.1.0 PUT /admin/users/{id}/password: sets a temporary password and closes that user's web sessions. */
function TemporaryPasswordForm({ user }: { user: AdminUser }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    const found = passwordError(password);
    setError(found);
    if (found) return;
    setSaving(true);
    try {
      await admin.resetPassword(user.id, { temporaryPassword: password });
      setPassword('');
      setMessage({ tone: 'success', text: t('users.resetPassword.done') });
    } catch (err) {
      const fieldErrors = fieldErrorsFrom(err);
      setError(fieldErrors.temporaryPassword);
      setMessage({ tone: 'error', text: fieldErrors.userId ?? errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="form reset-password" aria-labelledby="reset-password-title">
      <h3 id="reset-password-title">{t('users.resetPassword.title')}</h3>
      <p className="muted small">{t('users.resetPassword.lead')}</p>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <TextField
        label={t('users.tempPassword')}
        type="password"
        autoComplete="new-password"
        required
        hint={t('users.tempPassword.hint')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error}
      />
      <button type="submit" className="btn" disabled={saving}>
        {saving ? t('common.loading') : t('users.resetPassword.submit')}
      </button>
    </form>
  );
}

/** HU-10: create, edit, activate or deactivate profiles and assign roles. */
export function AdminUsersPage() {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const q = useDebounced(query, 250);
  const { data, error, loading, reload } = useApi(
    () => admin.users({ q, role: (role || undefined) as Role | undefined, active: status ? status === 'true' : undefined, limit: 100 }),
    [q, role, status],
  );
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const done = (text: string) => {
    setPanel(null);
    setNotice({ tone: 'success', text });
    reload();
  };

  const toggle = async (user: AdminUser) => {
    setNotice(null);
    try {
      await admin.updateUser(user.id, { active: !user.active });
      setNotice({ tone: 'success', text: t('users.updated') });
      reload();
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) });
    }
  };

  const users = data?.items ?? [];

  return (
    <>
      <PageHeader
        title={t('users.title')}
        actions={
          <button type="button" className="btn btn--primary" onClick={() => setPanel({ mode: 'create' })}>
            {t('users.create')}
          </button>
        }
      />
      <NoClinicalNote />
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      <div className={`admin-layout${panel ? ' admin-layout--panel' : ''}`}>
        <section className="card">
          <div className="filters">
            <TextField label={t('users.search')} type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
            <SelectField label={t('users.filter.role')} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">{t('users.filter.all')}</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`role.${r}`)}
                </option>
              ))}
            </SelectField>
            <SelectField label={t('users.filter.status')} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t('users.filter.all')}</option>
              <option value="true">{t('status.active')}</option>
              <option value="false">{t('status.inactive')}</option>
            </SelectField>
          </div>
          {Boolean(error) && <ErrorState error={error} onRetry={reload} />}
          {loading && !data && <Loading />}
          {data && users.length === 0 && <EmptyState>{t('users.empty')}</EmptyState>}
          {users.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">{t('users.count', { n: users.length })}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('users.col.name')}</th>
                    <th scope="col">{t('users.col.email')}</th>
                    <th scope="col">{t('users.col.role')}</th>
                    <th scope="col">{t('users.col.status')}</th>
                    <th scope="col">{t('users.col.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td data-label={t('users.col.name')}>{user.fullName}</td>
                      <td data-label={t('users.col.email')} className="cell-email">
                        {user.email}
                      </td>
                      <td data-label={t('users.col.role')}>
                        <span className="role-chip">{t(`role.${user.role}`)}</span>
                      </td>
                      <td data-label={t('users.col.status')}>
                        <span className={`tag${user.active ? '' : ' tag--muted'}`}>{user.active ? t('status.active') : t('status.inactive')}</span>
                      </td>
                      <td>
                        <div className="row row--tight">
                          <button type="button" className="btn btn--sm" onClick={() => setPanel({ mode: 'edit', userId: user.id })} aria-label={t('users.editLabel', { name: user.fullName })}>
                            {t('common.edit')}
                          </button>
                          <button
                            type="button"
                            className="btn btn--sm"
                            onClick={() => toggle(user)}
                            aria-label={user.active ? t('users.deactivateLabel', { name: user.fullName }) : t('users.activateLabel', { name: user.fullName })}
                          >
                            {user.active ? t('users.deactivate') : t('users.activate')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {panel && (
          <aside className="card admin-layout__panel">
            {panel.mode === 'create' ? (
              <CreateUserForm onDone={done} onCancel={() => setPanel(null)} />
            ) : (
              <EditUserForm key={panel.userId} userId={panel.userId} onDone={done} onCancel={() => setPanel(null)} />
            )}
          </aside>
        )}
      </div>
    </>
  );
}

export function AdminAssignmentsPage() {
  const users = useApi(() => admin.users({ limit: 100 }), []);
  const assignments = useApi(() => admin.assignments(), []);
  const [professionalId, setProfessionalId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const all = users.data?.items ?? [];
  const nameOf = (id: string) => all.find((u) => u.id === id)?.fullName || t('assignments.unknownUser');
  const professionals = all.filter((u) => u.role === 'professional' && u.active);
  const patientsList = all.filter((u) => u.role === 'patient' && u.active);
  const items = assignments.data?.items ?? [];
  const unassigned = patientsList.filter((p) => !items.some((a) => a.patientId === p.id)).length;

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    const found = compact({ professionalId: requiredError(professionalId), patientId: requiredError(patientId) });
    setErrors(found);
    if (Object.keys(found).length) return;
    try {
      await admin.createAssignment({ professionalId, patientId });
      setNotice({ tone: 'success', text: t('assignments.created') });
      setPatientId('');
      assignments.reload();
    } catch (err) {
      setErrors(fieldErrorsFrom(err));
      setNotice({ tone: 'error', text: errorMessage(err) });
    }
  };

  const remove = async (assignmentId: string) => {
    setNotice(null);
    try {
      await admin.deleteAssignment(assignmentId);
      setNotice({ tone: 'success', text: t('assignments.removed') });
      assignments.reload();
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) });
    }
  };

  return (
    <>
      <PageHeader title={t('assignments.title')} lead={t('assignments.lead')} />
      <NoClinicalNote />
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      <div className="notes-layout">
        <section className="card" aria-labelledby="assign-title">
          <h2 id="assign-title">{t('assignments.create')}</h2>
          {users.data && <p className="muted">{t('assignments.unassigned', { n: unassigned })}</p>}
          <form onSubmit={create} noValidate className="form">
            <SelectField label={t('assignments.professional')} required value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} error={errors.professionalId}>
              <option value="">{t('assignments.choose')}</option>
              {professionals.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </SelectField>
            <SelectField label={t('assignments.patient')} required value={patientId} onChange={(e) => setPatientId(e.target.value)} error={errors.patientId}>
              <option value="">{t('assignments.choose')}</option>
              {patientsList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </SelectField>
            <button type="submit" className="btn btn--primary">
              {t('assignments.create')}
            </button>
          </form>
        </section>
        <section className="card" aria-labelledby="assign-list-title">
          <h2 id="assign-list-title">{t('nav.admin.assignments')}</h2>
          {(users.loading || assignments.loading) && <Loading />}
          {Boolean(assignments.error) && <ErrorState error={assignments.error} onRetry={assignments.reload} />}
          {assignments.data && items.length === 0 && <EmptyState>{t('assignments.empty')}</EmptyState>}
          {items.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">{t('assignments.professional')}</th>
                    <th scope="col">{t('assignments.patient')}</th>
                    <th scope="col">{t('assignments.since')}</th>
                    <th scope="col">
                      <span className="sr-only">{t('users.col.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <tr key={a.assignmentId}>
                      <td data-label={t('assignments.professional')}>{nameOf(a.professionalId)}</td>
                      <td data-label={t('assignments.patient')}>{nameOf(a.patientId)}</td>
                      <td data-label={t('assignments.since')}>{formatDate(a.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--sm"
                          onClick={() => remove(a.assignmentId)}
                          aria-label={t('assignments.removeLabel', { patient: nameOf(a.patientId), professional: nameOf(a.professionalId) })}
                        >
                          {t('assignments.remove')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export function AdminExportPage() {
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [working, setWorking] = useState<'json' | 'csv' | null>(null);

  const download = async (format: 'json' | 'csv') => {
    setWorking(format);
    setNotice(null);
    try {
      const blob = await admin.exportDataset(format);
      const file = `neurophobia-analisis-${new Date().toISOString().slice(0, 10)}.${format}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file;
      link.click();
      URL.revokeObjectURL(url);
      setNotice({ tone: 'success', text: t('export.done', { file }) });
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) });
    } finally {
      setWorking(null);
    }
  };

  return (
    <>
      <PageHeader title={t('export.title')} />
      <NoClinicalNote />
      <section className="card card--narrow stack">
        <p>{t('export.lead')}</p>
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        <div className="row">
          <button type="button" className="btn btn--primary" onClick={() => download('json')} disabled={working !== null}>
            {working === 'json' ? t('common.loading') : t('export.json')}
          </button>
          <button type="button" className="btn" onClick={() => download('csv')} disabled={working !== null}>
            {working === 'csv' ? t('common.loading') : t('export.csv')}
          </button>
        </div>
      </section>
    </>
  );
}
