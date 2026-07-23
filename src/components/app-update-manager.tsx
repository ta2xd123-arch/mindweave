'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  APPLYING_VERSION_KEY,
  getServiceWorkerVersion,
  RELOADED_VERSION_KEY,
  shouldAutoApplyUpdate,
  shouldReloadForVersion,
  startUpdateChecks,
} from '@/lib/app-update';

type PendingUpdate = {
  version: string;
  worker: ServiceWorker | null;
};

type UpdateActivityContextValue = {
  setActivity: (key: string, active: boolean) => void;
};

type AppUpdateStatus = 'current' | 'ready' | 'applying';

const UpdateActivityContext = createContext<UpdateActivityContextValue | null>(null);
const UpdateStatusContext = createContext<AppUpdateStatus>('current');

export function useUpdateActivity(key: string, active: boolean) {
  const context = useContext(UpdateActivityContext);

  useEffect(() => {
    context?.setActivity(key, active);
    return () => context?.setActivity(key, false);
  }, [active, context, key]);
}

export function AppVersionBadge() {
  const status = useContext(UpdateStatusContext);
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0';
  const label = status === 'applying'
    ? '업데이트 중'
    : status === 'ready'
      ? '새 버전 준비됨'
      : '최신 버전';

  return (
    <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full glass-card mb-8" role="status" aria-live="polite">
      <span className={`w-2 h-2 rounded-full ${status === 'ready' ? 'bg-secondary animate-pulse' : status === 'applying' ? 'bg-primary animate-pulse' : 'bg-primary'}`} aria-hidden="true" />
      <span className="font-label-caps text-on-surface-variant text-[11px]">
        v{appVersion} · {label}
      </span>
    </div>
  );
}

export function AppUpdateManager({ children }: { children: React.ReactNode }) {
  const activitiesRef = useRef(new Set<string>());
  const busyRef = useRef(false);
  const forceReloadRef = useRef(false);
  const [activeActivityCount, setActiveActivityCount] = useState(0);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const setActivity = useCallback((key: string, active: boolean) => {
    const activities = activitiesRef.current;
    if (active) activities.add(key);
    else activities.delete(key);
    busyRef.current = activities.size > 0;
    setActiveActivityCount(activities.size);
  }, []);

  const contextValue = useMemo(() => ({ setActivity }), [setActivity]);

  const reloadForVersion = useCallback((version: string) => {
    const reloadedVersion = sessionStorage.getItem(RELOADED_VERSION_KEY);
    if (!shouldReloadForVersion(version, reloadedVersion)) {
      sessionStorage.removeItem(APPLYING_VERSION_KEY);
      setPendingUpdate(null);
      setIsApplying(false);
      return;
    }

    sessionStorage.setItem(RELOADED_VERSION_KEY, version);
    sessionStorage.removeItem(APPLYING_VERSION_KEY);
    window.location.reload();
  }, []);

  const applyUpdate = useCallback((update: PendingUpdate, forceReload = false) => {
    forceReloadRef.current = forceReload;
    setIsApplying(true);
    sessionStorage.setItem(APPLYING_VERSION_KEY, update.version);

    if (!update.worker || update.worker.state === 'activated') {
      reloadForVersion(update.version);
      return;
    }

    update.worker.postMessage({ type: 'SKIP_WAITING' });
  }, [reloadForVersion]);

  useEffect(() => {
    if (!pendingUpdate || isApplying || !shouldAutoApplyUpdate(activeActivityCount)) return;
    const applyTimer = window.setTimeout(() => applyUpdate(pendingUpdate), 0);
    return () => window.clearTimeout(applyTimer);
  }, [activeActivityCount, applyUpdate, isApplying, pendingUpdate]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      return;
    }

    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;
    let stopUpdateChecks: (() => void) | undefined;
    let hadController = Boolean(navigator.serviceWorker.controller);

    const offerUpdate = (worker: ServiceWorker) => {
      if (disposed) return;
      const version = getServiceWorkerVersion(worker.scriptURL);
      if (sessionStorage.getItem(RELOADED_VERSION_KEY) === version) return;
      setPendingUpdate({ worker, version });
    };

    const observeInstallingWorker = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const onStateChange = () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          offerUpdate(worker);
        }
      };
      worker.addEventListener('statechange', onStateChange);
    };

    const onControllerChange = () => {
      const applyingVersion = sessionStorage.getItem(APPLYING_VERSION_KEY);
      const controllerVersion = navigator.serviceWorker.controller
        ? getServiceWorkerVersion(navigator.serviceWorker.controller.scriptURL)
        : null;

      // The first controller on a fresh install does not require a reload.
      if (!hadController && !applyingVersion) {
        hadController = true;
        return;
      }
      hadController = true;

      const version = applyingVersion || controllerVersion;
      if (!version) return;

      sessionStorage.removeItem(APPLYING_VERSION_KEY);
      setIsApplying(false);

      if (forceReloadRef.current || !busyRef.current) {
        forceReloadRef.current = false;
        reloadForVersion(version);
      } else {
        setPendingUpdate({ worker: null, version });
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const deploymentId = document.documentElement.dataset.dplId || 'fallback';
    const serviceWorkerUrl = `/sw.js?v=${encodeURIComponent(deploymentId)}`;

    navigator.serviceWorker.register(serviceWorkerUrl, { updateViaCache: 'none' })
      .then((nextRegistration) => {
        if (disposed) return;
        registration = nextRegistration;

        if (registration.waiting) offerUpdate(registration.waiting);
        observeInstallingWorker(registration.installing);

        registration.addEventListener('updatefound', () => {
          observeInstallingWorker(registration?.installing ?? null);
        });

        stopUpdateChecks = startUpdateChecks(registration, document);
      })
      .catch((error) => {
        console.warn('Service worker registration failed:', error);
      });

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      stopUpdateChecks?.();
    };
  }, [reloadForVersion]);

  const isBusy = activeActivityCount > 0;
  const updateStatus: AppUpdateStatus = isApplying
    ? 'applying'
    : pendingUpdate
      ? 'ready'
      : 'current';

  return (
    <UpdateActivityContext.Provider value={contextValue}>
      <UpdateStatusContext.Provider value={updateStatus}>
        {children}

        {pendingUpdate && isBusy && (
          <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+12px)] z-[120] mx-auto max-w-xl rounded-2xl border border-primary/30 bg-surface-container-highest/95 p-3 shadow-2xl backdrop-blur-xl" role="status" aria-live="polite">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined shrink-0 text-primary" aria-hidden="true">system_update</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-on-surface">새 버전이 준비되었습니다</p>
                <p className="mt-0.5 text-xs text-on-surface-variant">현재 작업을 마치면 자동으로 적용됩니다. 지금 업데이트하면 작성 중인 내용이 사라질 수 있습니다.</p>
              </div>
              <button
                type="button"
                onClick={() => applyUpdate(pendingUpdate, true)}
                disabled={isApplying}
                className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-60"
              >
                {isApplying ? '적용 중' : '지금 업데이트'}
              </button>
            </div>
          </div>
        )}
      </UpdateStatusContext.Provider>
    </UpdateActivityContext.Provider>
  );
}
