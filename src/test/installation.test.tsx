import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { expect, test } from 'vitest';
import { AppRoutes } from '../App';
import { auth } from '../api/endpoints';
import { AuthProvider } from '../auth/AuthContext';
import { t } from '../i18n';
import { DEMO_PASSWORD } from '../mocks/fixtures';
import { server } from '../mocks/server';

function guide() {
  return render(<MemoryRouter initialEntries={['/instalar']}><AuthProvider><AppRoutes /></AuthProvider></MemoryRouter>);
}

test('the public guide explains installation before pairing and does not offer a missing APK', async () => {
  guide();
  expect(await screen.findByText(t('installation.release.unavailable'))).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: t('installation.step.install.title') })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: t('installation.step.pair.title') })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: t('installation.release.download') })).not.toBeInTheDocument();
});

test('the guide remains usable with an older backend without the release endpoint', async () => {
  server.use(http.get('*/api/v1/public/app-release', () => HttpResponse.json({ code: 'NOT_FOUND' }, { status: 404 })));
  guide();
  expect(await screen.findByText(t('installation.release.unavailable'))).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: t('installation.steps.title') })).toBeInTheDocument();
});

test('a public visitor cannot download an available protected build', async () => {
  server.use(http.get('*/api/v1/public/app-release', () => HttpResponse.json({ status: 'available', version: '0.2.0', bytes: 25, downloadRole: 'admin', headsetTested: true })));
  guide();
  expect(await screen.findByText(t('installation.release.available'))).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: t('installation.release.download') })).not.toBeInTheDocument();
});

test('an HTML fallback is never downloaded as an APK', async () => {
  await auth.login({ email: 'admin@neurophobia.test', password: DEMO_PASSWORD });
  server.use(
    http.get('*/api/v1/public/app-release', () => HttpResponse.json({ status: 'available', bytes: 25, downloadRole: 'admin', headsetTested: true })),
    http.get('*/api/v1/admin/app-release/download', () => HttpResponse.html('<html>SPA fallback</html>')),
  );
  guide();
  await userEvent.click(await screen.findByRole('button', { name: t('installation.release.download') }));
  expect(await screen.findByText(t('error.INVALID_DOWNLOAD'))).toBeInTheDocument();
});
