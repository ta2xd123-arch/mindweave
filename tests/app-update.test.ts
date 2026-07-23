import { describe, expect, it } from 'vitest';
import {
  getServiceWorkerVersion,
  shouldAutoApplyUpdate,
  shouldReloadForVersion,
  startUpdateChecks,
} from '../src/lib/app-update';

describe('safe app update decisions', () => {
  it('reads the deployment version from a service worker URL', () => {
    expect(getServiceWorkerVersion('https://example.com/sw.js?v=deploy-123')).toBe('deploy-123');
  });

  it('auto-applies only when no important activity is registered', () => {
    expect(shouldAutoApplyUpdate(0)).toBe(true);
    expect(shouldAutoApplyUpdate(1)).toBe(false);
  });

  it('checks for an update once when the app starts', () => {
    let updateCount = 0;
    let visibilityListener: (() => void) | null = null;
    const visibilitySource = {
      visibilityState: 'visible',
      addEventListener: (_type: 'visibilitychange', listener: () => void) => {
        visibilityListener = listener;
      },
      removeEventListener: () => {
        visibilityListener = null;
      },
    };

    const stop = startUpdateChecks({ update: () => { updateCount += 1; } }, visibilitySource);
    expect(updateCount).toBe(1);
    expect(visibilityListener).toBeTypeOf('function');
    stop();
  });

  it('checks again only when the app returns to the foreground', () => {
    let updateCount = 0;
    let visibilityListener: (() => void) | null = null;
    const visibilitySource = {
      visibilityState: 'visible',
      addEventListener: (_type: 'visibilitychange', listener: () => void) => {
        visibilityListener = listener;
      },
      removeEventListener: () => {
        visibilityListener = null;
      },
    };

    const stop = startUpdateChecks({ update: () => { updateCount += 1; } }, visibilitySource);
    visibilitySource.visibilityState = 'hidden';
    (visibilityListener as (() => void) | null)?.();
    expect(updateCount).toBe(1);

    visibilitySource.visibilityState = 'visible';
    (visibilityListener as (() => void) | null)?.();
    expect(updateCount).toBe(2);
    stop();
  });

  it('reloads once per deployment version', () => {
    expect(shouldReloadForVersion('deploy-2', null)).toBe(true);
    expect(shouldReloadForVersion('deploy-2', 'deploy-1')).toBe(true);
    expect(shouldReloadForVersion('deploy-2', 'deploy-2')).toBe(false);
  });
});
