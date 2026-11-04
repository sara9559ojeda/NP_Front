import { setupWorker } from 'msw/browser';
import { handlers, setPersistentRefresh } from './handlers';

export async function startMockServer(): Promise<void> {
  setPersistentRefresh(true);
  await setupWorker(...handlers).start({ onUnhandledRequest: 'bypass', quiet: true });
}
