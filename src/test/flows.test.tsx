import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, test } from 'vitest';
import axe from 'axe-core';
import { AppRoutes } from '../App';
import { AuthProvider } from '../auth/AuthContext';
import { http, HttpResponse } from 'msw';
import { auth, me } from '../api/endpoints';
import { server } from '../mocks/server';
import { DEMO_PASSWORD, IDS } from '../mocks/fixtures';
import { t } from '../i18n';

function page(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><AppRoutes /></AuthProvider></MemoryRouter>);
}
async function session(email = 'ana@example.com') {
  await auth.login({ email, password: DEMO_PASSWORD });
}
async function fillLogin(password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(t('login.email'), { exact: false }), 'ana@example.com');
  await user.type(screen.getByLabelText(t('login.password'), { exact: false }), password);
  await user.click(screen.getByRole('button', { name: t('login.submit') }));
  return user;
}

describe('cuentas y navegación', () => {
  test('inicio correcto muestra el progreso del paciente', async () => {
    page('/iniciar-sesion');
    await fillLogin(DEMO_PASSWORD);
    expect(await screen.findByRole('heading', { name: t('progress.title') })).toBeInTheDocument();
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
  test('el error de credenciales permite reintentar sin volver a escribir el correo', async () => {
    page('/iniciar-sesion');
    const user = await fillLogin('incorrecta');
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t('error.INVALID_CREDENTIALS'));
    // The UI moves focus to the error on the next animation frame. Wait for
    // that accessible state before starting a new interaction; otherwise a
    // faster CI runner can move focus away while userEvent is typing.
    await waitFor(() => expect(alert).toHaveFocus());
    const password = screen.getByLabelText(t('login.password'), { exact: false });
    expect(password).toHaveValue('');
    await user.type(password, DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: t('login.submit') }));
    expect(await screen.findByRole('heading', { name: t('progress.title') })).toBeInTheDocument();
  });
  test.each(['/profesional', '/admin'])('paciente no entra en %s', async path => {
    await session();
    page(path);
    expect(await screen.findByRole('heading', { name: t('forbidden.title') })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: t('users.title') })).not.toBeInTheDocument();
  });
  test('sin sesión vuelve a iniciar sesión', async () => {
    page('/paciente');
    expect(await screen.findByRole('heading', { name: t('login.title') })).toBeInTheDocument();
  });
  test('valida obligatorios y enfoca el primer campo inválido', async () => {
    page('/registro');
    await userEvent.click(screen.getByRole('button', { name: t('register.submit') }));
    const field = screen.getByLabelText(t('register.fullName'), { exact: false });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(field).toHaveFocus());
    expect(screen.getByRole('alert')).toHaveTextContent(t('validation.summary'));
  });
  test('registro muestra EMAIL_TAKEN para un correo repetido', async () => {
    const user = userEvent.setup();
    page('/registro');
    await user.type(screen.getByLabelText(t('register.fullName'), { exact: false }), 'Persona de prueba');
    await user.type(screen.getByLabelText(t('register.email'), { exact: false }), 'ana@example.com');
    await user.type(screen.getByLabelText(/^Contraseña/), DEMO_PASSWORD);
    await user.type(screen.getByLabelText(t('register.passwordConfirm'), { exact: false }), DEMO_PASSWORD);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: t('register.submit') }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t('error.EMAIL_TAKEN'));
    expect(screen.getByLabelText(t('register.email'), { exact: false })).toHaveAttribute('aria-invalid', 'true');
  });
  test('profesional crea y ve una nota', async () => {
    await session('profesional@neurophobia.test');
    page(`/profesional/pacientes/${IDS.ana}/notas`);
    const field = await screen.findByLabelText(t('notes.text'), { exact: false });
    await userEvent.type(field, 'Observación ficticia de prueba.');
    await userEvent.click(screen.getByRole('button', { name: t('notes.save') }));
    expect(await screen.findByText('Observación ficticia de prueba.')).toBeInTheDocument();
    expect(screen.getAllByRole('status').some((region) => region.textContent?.includes(t('notes.saved')))).toBe(true);
  });
});

describe('accesibilidad de pantallas principales', () => {
  test.each([
    ['/', null, 'home.levels.title'],
    ['/iniciar-sesion', null, 'login.title'],
    ['/registro', null, 'register.title'],
    ['/paciente', 'ana@example.com', 'progress.title'],
    ['/profesional', 'profesional@neurophobia.test', 'patients.title'],
    ['/admin', 'admin@neurophobia.test', 'users.title'],
  ] as const)('%s no presenta infracciones graves de axe', async (path, email, heading) => {
    if (email) await session(email);
    const { container } = page(path);
    await screen.findByRole('heading', { name: t(heading) });
    await waitFor(() => expect(screen.queryByText(t('common.loading'))).not.toBeInTheDocument());
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  });
});

describe('iniciar terapia (BPMN: ajustar grado → comenzar)', () => {
  const storageUnavailable = () =>
    HttpResponse.json(
      { type: 'https://neurophobia/errors/storage-unavailable', title: 'Almacenamiento no disponible', status: 503, code: 'STORAGE_UNAVAILABLE' },
      { status: 503, headers: { 'Content-Type': 'application/problem+json', 'Retry-After': '5' } },
    );

  test('el paciente guarda su grado de fobia y queda listo para el visor', async () => {
    await session();
    page('/paciente');
    const slider = await screen.findByRole('slider', { name: t('therapy.grade.label') });
    fireEvent.change(slider, { target: { value: '4' } });
    expect(slider).toHaveAttribute('aria-valuetext', expect.stringContaining('4'));
    await userEvent.click(screen.getByRole('button', { name: t('therapy.action.save') }));
    expect(await screen.findByText(t('therapy.status.ready.title'))).toBeInTheDocument();
    expect(await me.therapy()).toMatchObject({ phobiaGrade: 4 });
  });
  test('un 503 al guardar muestra el mensaje de almacenamiento y permite reintentar', async () => {
    await session();
    server.use(http.put('*/api/v1/me/phobia-grade', storageUnavailable, { once: true }));
    page('/paciente');
    await userEvent.click(await screen.findByRole('button', { name: t('therapy.action.save') }));
    expect(await screen.findByText(t('error.STORAGE_UNAVAILABLE'))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t('common.retry') }));
    expect(await screen.findByText(t('therapy.status.ready.title'))).toBeInTheDocument();
  });
  test('sin visor vinculado invita a vincularlo antes de comenzar', async () => {
    await session();
    const base = await me.therapy();
    server.use(http.get('*/api/v1/me/therapy', () => HttpResponse.json({ ...base, pairedDevices: 0 })));
    page('/paciente');
    expect(await screen.findByRole('link', { name: t('therapy.action.pair') })).toHaveAttribute('href', '/paciente/visor');
    expect(screen.queryByRole('button', { name: t('therapy.action.save') })).not.toBeInTheDocument();
  });
  test('una sesión abierta en el visor se muestra en curso', async () => {
    await session();
    const base = await me.therapy();
    server.use(http.get('*/api/v1/me/therapy', () => HttpResponse.json({ ...base, openSession: { sessionId: 'abierta', startedAt: '2026-11-05T15:00:00Z' } })));
    page('/paciente');
    expect(await screen.findByText(t('therapy.status.running.title'))).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: t('therapy.grade.label') })).toBeDisabled();
  });
});

describe('retroalimentación para el profesional', () => {
  test('lista las sesiones analizadas como pendientes de validar y filtra las notas por sesión', async () => {
    await session('profesional@neurophobia.test');
    page(`/profesional/pacientes/${IDS.ana}/retroalimentacion`);
    const notesLinks = await screen.findAllByRole('link', { name: t('feedback.notesLink', { n: 1 }) });
    expect(screen.getAllByText(t('clinical.pending')).length).toBeGreaterThanOrEqual(5);
    await userEvent.click(notesLinks[0]!);
    expect(await screen.findByRole('link', { name: t('notes.filter.clear') })).toBeInTheDocument();
    expect(await screen.findByText(/29 de octubre/)).toBeInTheDocument();
    expect(screen.queryByText(/21 de octubre/)).not.toBeInTheDocument();
  });
});

describe('gestión de perfiles (administrador)', () => {
  test('edita el nombre y el correo de un perfil y asigna una contraseña temporal', async () => {
    const user = userEvent.setup();
    await session('admin@neurophobia.test');
    page('/admin');
    await user.click(await screen.findByRole('button', { name: t('users.editLabel', { name: 'Carlos Ruiz' }) }));
    const email = await screen.findByLabelText(t('register.email'), { exact: false, selector: 'aside input' });
    await user.clear(email);
    await user.type(email, 'ana@example.com');
    await user.click(screen.getByRole('button', { name: t('common.save') }));
    expect(await screen.findByText(t('error.EMAIL_TAKEN'), { selector: '.field__error' })).toBeInTheDocument();
    await user.clear(email);
    await user.type(email, 'carlos.ruiz@neurophobia.test');
    await user.click(screen.getByRole('button', { name: t('common.save') }));
    expect(await screen.findByText('carlos.ruiz@neurophobia.test')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t('users.editLabel', { name: 'Carlos Ruiz' }) }));
    await user.type(await screen.findByLabelText(t('users.tempPassword'), { exact: false, selector: 'input' }), 'temporal-2026');
    await user.click(screen.getByRole('button', { name: t('users.resetPassword.submit') }));
    expect(await screen.findByText(t('users.resetPassword.done'))).toBeInTheDocument();
  });
});

describe('registro', () => {
  test('el registro inicia la sesión al crear la cuenta', async () => {
    const user = userEvent.setup();
    page('/registro');
    await user.type(await screen.findByLabelText(t('register.fullName'), { exact: false }), 'Paciente Nueva');
    await user.type(screen.getByLabelText(t('register.email'), { exact: false }), 'nueva@example.com');
    await user.type(screen.getByLabelText(new RegExp(`^${t('register.password')}`)), 'clave-segura-123');
    await user.type(screen.getByLabelText(t('register.passwordConfirm'), { exact: false }), 'clave-segura-123');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: t('register.submit') }));

    expect(await screen.findByText(t('register.success.signedIn'))).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: t('register.success.continue') }));
    await waitFor(() => expect(screen.getByRole('heading', { name: t('progress.title') })).toBeInTheDocument());
  });
});
