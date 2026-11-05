import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, test } from 'vitest';
import axe from 'axe-core';
import { AppRoutes } from '../App';
import { AuthProvider } from '../auth/AuthContext';
import { auth } from '../api/endpoints';
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
