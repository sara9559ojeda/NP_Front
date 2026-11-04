import { useEffect, useRef, useState, type FormEvent } from 'react';
import { admin } from '../../api/endpoints';
import type { AdminUser, Role } from '../../api/types';
import { Alert, EmptyState, ErrorState, Loading } from '../../components/Feedback';
import { SelectField, TextField } from '../../components/Field';
import { PageHeader } from '../../components/Layout';
import { compact, emailError, focusFirstInvalid, passwordError, requiredError } from '../../components/validation';
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
  return <p className="note-banner">{t('admin.noClinical')}</p>;
}

type Panel = { mode: 'create' } | { mode: 'edit'; user: AdminUser } | null;

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
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}

function EditUserForm({ user, onDone, onCancel }: { user: AdminUser; onDone: (text: string) => void; onCancel: () => void }) {
  const [role, setRole] = useState<Role>(user.role);
  const [active, setActive] = useState(user.active ? 'true' : 'false');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await admin.updateUser(user.id, { role, active: active === 'true' });
      onDone(t('users.updated'));
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="form">
      <h2>{t('users.edit.title')}</h2>
      {formError && <Alert tone="error">{formError}</Alert>}
      <TextField label={t('register.fullName')} value={user.fullName} readOnly />
      <TextField label={t('register.email')} value={user.email} readOnly hint={t('users.edit.readonly')} />
      <SelectField label={t('users.col.role')} value={role} onChange={(e) => setRole(e.target.value as Role)}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {t(`role.${r}`)}
          </option>
        ))}
      </SelectField>
      <SelectField label={t('users.col.status')} value={active} onChange={(e) => setActive(e.target.value)}>
        <option value="true">{t('status.active')}</option>
        <option value="false">{t('status.inactive')}</option>
      </SelectField>
      <div className="row">
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? t('common.loading') : t('common.save')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
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
      <div className={`split split--admin${panel ? ' split--panel' : ''}`}>
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
                        <span className={`role-pill role-pill--${user.role}`}>{t(`role.${user.role}`)}</span>
                      </td>
                      <td data-label={t('users.col.status')}>
                        <span className={`chip ${user.active ? 'chip--ok' : 'chip--muted'}`}>{user.active ? t('status.active') : t('status.inactive')}</span>
                      </td>
                      <td>
                        <div className="row row--tight">
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPanel({ mode: 'edit', user })} aria-label={t('users.editLabel', { name: user.fullName })}>
                            {t('common.edit')}
                          </button>
                          <button
                            type="button"
                            className="btn btn--outline btn--sm"
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
          <aside className="card side-panel">
            {panel.mode === 'create' ? (
              <CreateUserForm onDone={done} onCancel={() => setPanel(null)} />
            ) : (
              <EditUserForm key={panel.user.id} user={panel.user} onDone={done} onCancel={() => setPanel(null)} />
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
      <div className="grid-notes">
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
                          className="btn btn--outline btn--sm"
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
      <section className="card card--narrow-left">
        <p>{t('export.lead')}</p>
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        <div className="row">
          <button type="button" className="btn btn--primary" onClick={() => download('json')} disabled={working !== null}>
            {working === 'json' ? t('common.loading') : t('export.json')}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => download('csv')} disabled={working !== null}>
            {working === 'csv' ? t('common.loading') : t('export.csv')}
          </button>
        </div>
      </section>
    </>
  );
}
