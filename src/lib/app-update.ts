export const APPLYING_VERSION_KEY = 'mindweave-sw-applying-version';
export const RELOADED_VERSION_KEY = 'mindweave-sw-reloaded-version';

type UpdateRegistration = {
  update: () => unknown;
};

type VisibilitySource = {
  visibilityState: string;
  addEventListener: (type: 'visibilitychange', listener: () => void) => void;
  removeEventListener: (type: 'visibilitychange', listener: () => void) => void;
};

export function getServiceWorkerVersion(scriptUrl: string): string {
  try {
    return new URL(scriptUrl).searchParams.get('v') || 'fallback';
  } catch {
    return 'fallback';
  }
}

export function shouldReloadForVersion(version: string | null, reloadedVersion: string | null): boolean {
  return Boolean(version && version !== reloadedVersion);
}

export function shouldAutoApplyUpdate(activeActivityCount: number): boolean {
  return activeActivityCount === 0;
}

export function startUpdateChecks(
  registration: UpdateRegistration,
  visibilitySource: VisibilitySource,
): () => void {
  const checkForUpdate = () => {
    try {
      Promise.resolve(registration.update()).catch(() => undefined);
    } catch {
      // A failed update check must not interrupt the current user session.
    }
  };

  const onVisibilityChange = () => {
    if (visibilitySource.visibilityState === 'visible') checkForUpdate();
  };

  // Check once when the app starts.
  checkForUpdate();
  visibilitySource.addEventListener('visibilitychange', onVisibilityChange);

  return () => visibilitySource.removeEventListener('visibilitychange', onVisibilityChange);
}
