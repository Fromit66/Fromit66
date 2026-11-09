import { useEffect, useState, useRef, useCallback } from 'react';

interface WakeLockSentinelLike {
  released: boolean;
  type: string;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: EventListener) => void;
  removeEventListener?: (type: string, listener: EventListener) => void;
  onrelease?: ((this: WakeLockSentinelLike, ev: Event) => void) | null;
}

type SafeWakeLockNavigator = {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

export function useWorkoutWakeLock(isWorkoutActive: boolean) {
  const [isSupported, setIsSupported] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [userEnabled, setUserEnabled] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string>('Iniciando...');

  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  // Check API availability
  useEffect(() => {
    const supported =
      typeof navigator !== 'undefined' &&
      'wakeLock' in navigator &&
      Boolean((navigator as unknown as SafeWakeLockNavigator).wakeLock?.request);
    setIsSupported(supported);
    if (!supported) {
      setStatusMessage('Wake Lock no soportado');
    }
  }, []);

  // Request the screen wake lock
  const requestLock = useCallback(async () => {
    if (typeof navigator === 'undefined') return false;
    const nav = navigator as unknown as SafeWakeLockNavigator;

    if (!nav.wakeLock?.request || !userEnabled) {
      return false;
    }

    try {
      // Release existing if any
      if (sentinelRef.current && !sentinelRef.current.released) {
        try {
          await sentinelRef.current.release();
        } catch {}
      }

      const sentinel = await nav.wakeLock.request('screen');
      sentinelRef.current = sentinel;
      setIsLocked(true);
      setStatusMessage('Pantalla activa');

      sentinel.onrelease = () => {
        setIsLocked(false);
        setStatusMessage('Pantalla liberada');
      };

      return true;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn('Wake Lock request failed:', errorMsg);
      setIsLocked(false);
      setStatusMessage('No se pudo activar');
      return false;
    }
  }, [userEnabled]);

  // Release the screen wake lock
  const releaseLock = useCallback(async () => {
    try {
      if (sentinelRef.current && !sentinelRef.current.released) {
        await sentinelRef.current.release();
      }
    } catch (err) {
      console.warn('Wake Lock release error:', err);
    } finally {
      sentinelRef.current = null;
      setIsLocked(false);
      setStatusMessage('Pantalla desactivada');
    }
  }, []);

  // Toggle user preference
  const toggleUserEnabled = useCallback(() => {
    setUserEnabled((prev) => {
      const next = !prev;
      if (!next) {
        releaseLock();
      }
      return next;
    });
  }, [releaseLock]);

  // Acquire or release when isWorkoutActive or userEnabled changes
  useEffect(() => {
    if (isWorkoutActive && userEnabled && isSupported) {
      requestLock();
    } else {
      releaseLock();
    }

    return () => {
      releaseLock();
    };
  }, [isWorkoutActive, userEnabled, isSupported, requestLock, releaseLock]);

  // Auto re-acquire wake lock when tab becomes visible again after app switching
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isWorkoutActive && userEnabled) {
        await requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isWorkoutActive, userEnabled, requestLock]);

  return {
    isSupported,
    isLocked,
    userEnabled,
    statusMessage,
    requestLock,
    releaseLock,
    toggleUserEnabled,
  };
}
