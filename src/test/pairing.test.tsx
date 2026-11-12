import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AppRoutes } from '../App';
import { deviceModelLabel } from '../api/deviceModel';
import { auth } from '../api/endpoints';
import type { Device, PairingCode } from '../api/types';
import { AuthProvider } from '../auth/AuthContext';
import { PAIRING_POLL_MS, usePairingWatch } from '../hooks/usePairingWatch';
import { formatTime, t } from '../i18n';
import { DEMO_PASSWORD } from '../mocks/fixtures';
import { server } from '../mocks/server';

const BASE = '/api/v1';
const PAIRED_AT = '2026-11-11T14:32:00Z';

function codeValidFor(ms: number): PairingCode {
  return { code: 'ABC-234', expiresAt: new Date(Date.now() + ms).toISOString() };
}

function headset(deviceId: string, revokedAt: string | null = null): Device {
  return { deviceId, model: 'quest3', appVersion: '0.2.0', pairedAt: PAIRED_AT, revokedAt };
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Lets the pending promise of a check settle after moving the clock. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('usePairingWatch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    setVisibility('visible');
  });

  test('reports the new headset and stops checking', async () => {
    const list = vi.fn<() => Promise<Device[]>>()
      .mockResolvedValueOnce([headset('old')])
      .mockResolvedValueOnce([headset('old')])
      .mockResolvedValue([headset('old'), headset('new')]);
    const code = codeValidFor(600_000);
    const { result } = renderHook(() => usePairingWatch(code, list));

    await advance(0);
    expect(result.current).toEqual({ status: 'waiting', offline: false });
    await advance(PAIRING_POLL_MS * 2);
    expect(result.current).toEqual({ status: 'paired', device: headset('new') });

    const calls = list.mock.calls.length;
    await advance(PAIRING_POLL_MS * 5);
    expect(list).toHaveBeenCalledTimes(calls);
  });

  test('a headset that was already paired, or a revoked one, is not the new one', async () => {
    const list = vi.fn<() => Promise<Device[]>>()
      .mockResolvedValueOnce([headset('old')])
      .mockResolvedValue([headset('old'), headset('gone', PAIRED_AT)]);
    const { result } = renderHook(({ code }) => usePairingWatch(code, list), { initialProps: { code: codeValidFor(600_000) } });
    await advance(PAIRING_POLL_MS * 3);
    expect(result.current.status).toBe('waiting');
  });

  test('never runs two checks at once', async () => {
    let resolve: (devices: Device[]) => void = () => undefined;
    const list = vi.fn(() => new Promise<Device[]>((done) => (resolve = done)));
    renderHook(({ code }) => usePairingWatch(code, list), { initialProps: { code: codeValidFor(600_000) } });
    await advance(PAIRING_POLL_MS * 4);
    expect(list).toHaveBeenCalledTimes(1);
    await act(async () => resolve([]));
    await advance(PAIRING_POLL_MS);
    expect(list).toHaveBeenCalledTimes(2);
  });

  test('backs off while offline and recovers', async () => {
    const list = vi.fn<() => Promise<Device[]>>()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue([headset('new')]);
    const { result } = renderHook(({ code }) => usePairingWatch(code, list), { initialProps: { code: codeValidFor(600_000) } });

    await advance(PAIRING_POLL_MS);
    expect(result.current).toEqual({ status: 'waiting', offline: true });
    // Second failure waits 3 s, the next attempt 6 s: no request in between.
    await advance(PAIRING_POLL_MS);
    expect(list).toHaveBeenCalledTimes(3);
    await advance(PAIRING_POLL_MS * 2 - 1);
    expect(list).toHaveBeenCalledTimes(3);
    await advance(1);
    expect(result.current).toEqual({ status: 'paired', device: headset('new') });
  });

  test('pauses while the tab is hidden and checks as soon as it is visible', async () => {
    const list = vi.fn<() => Promise<Device[]>>().mockResolvedValueOnce([]).mockResolvedValue([headset('new')]);
    const { result } = renderHook(({ code }) => usePairingWatch(code, list), { initialProps: { code: codeValidFor(600_000) } });
    await advance(0);
    act(() => setVisibility('hidden'));
    await advance(PAIRING_POLL_MS * 10);
    expect(list).toHaveBeenCalledTimes(1);

    act(() => setVisibility('visible'));
    await advance(0);
    expect(result.current.status).toBe('paired');
  });

  test('checks once more when the code expires, then stops', async () => {
    const list = vi.fn<() => Promise<Device[]>>().mockResolvedValue([]);
    const { result } = renderHook(({ code }) => usePairingWatch(code, list), { initialProps: { code: codeValidFor(PAIRING_POLL_MS + 500) } });
    await advance(PAIRING_POLL_MS + 500);
    expect(result.current).toEqual({ status: 'expired' });
    const calls = list.mock.calls.length;
    await advance(PAIRING_POLL_MS * 5);
    expect(list).toHaveBeenCalledTimes(calls);
  });

  test('a headset paired in the last seconds still counts', async () => {
    const list = vi.fn<() => Promise<Device[]>>().mockResolvedValueOnce([]).mockResolvedValue([headset('new')]);
    const { result } = renderHook(({ code }) => usePairingWatch(code, list), { initialProps: { code: codeValidFor(1000) } });
    await advance(1000);
    expect(result.current.status).toBe('paired');
  });

  test('does nothing without a code or without a way to list headsets', async () => {
    const list = vi.fn<() => Promise<Device[]>>().mockResolvedValue([]);
    const idle = renderHook(() => usePairingWatch(null, list));
    const unwatched = renderHook(({ code }) => usePairingWatch(code, undefined), { initialProps: { code: codeValidFor(600_000) } });
    await advance(PAIRING_POLL_MS * 3);
    expect(idle.result.current.status).toBe('idle');
    expect(unwatched.result.current.status).toBe('idle');
    expect(list).not.toHaveBeenCalled();
  });
});

describe('Mi visor', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  test('shows "Visor vinculado" as soon as the headset uses the code', async () => {
    let paired = false;
    let checks = 0;
    server.use(
      http.get(`${BASE}/me/devices`, () => {
        checks += 1;
        return HttpResponse.json({ items: paired ? [{ ...headset('new'), deviceModel: 'quest3' }] : [], nextCursor: null });
      }),
    );
    await auth.login({ email: 'ana@example.com', password: DEMO_PASSWORD });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(<MemoryRouter initialEntries={['/paciente/visor']}><AuthProvider><AppRoutes /></AuthProvider></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: t('pairing.generate') }));
    expect(await screen.findByText(t('pairing.waiting'))).toBeInTheDocument();

    paired = true;
    await advance(PAIRING_POLL_MS);
    const done = await screen.findByText(t('pairing.paired.title'));
    const status = done.closest('[role="status"]') as HTMLElement;
    expect(within(status).getByText('Meta Quest 3')).toBeInTheDocument();
    expect(within(status).getByText(t('pairing.paired.at', { time: formatTime(PAIRED_AT) }))).toBeInTheDocument();
    expect(screen.queryByText(t('pairing.waiting'))).not.toBeInTheDocument();
    // The list beside it shows the same headset without another request or a spinner.
    const list = screen.getByRole('heading', { name: t('devices.list.title') }).closest('section') as HTMLElement;
    expect(within(list).getByText('Meta Quest 3')).toBeInTheDocument();

    const after = checks;
    await advance(PAIRING_POLL_MS * 5);
    expect(checks).toBe(after);
    expect(screen.getByRole('button', { name: t('pairing.again') })).toBeEnabled();

    vi.useRealTimers();
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });

  test('tells the person when the connection drops and keeps the code on screen', async () => {
    server.use(http.get(`${BASE}/me/devices`, () => HttpResponse.error()));
    await auth.login({ email: 'ana@example.com', password: DEMO_PASSWORD });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MemoryRouter initialEntries={['/paciente/visor']}><AuthProvider><AppRoutes /></AuthProvider></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: t('pairing.generate') }));
    expect(await screen.findByText(t('pairing.offline'))).toBeInTheDocument();
    expect(screen.getByText(t('pairing.title'), { selector: '.pairing__label' })).toBeInTheDocument();
  });
});

test('deviceModelLabel names the headsets the app reports', () => {
  expect(deviceModelLabel('quest3')).toBe('Meta Quest 3');
  expect(deviceModelLabel('Oculus Quest 2')).toBe('Meta Quest 2');
  expect(deviceModelLabel('Meta Quest 3S')).toBe('Meta Quest 3S');
  expect(deviceModelLabel('Pico 4')).toBe('Pico 4');
});
