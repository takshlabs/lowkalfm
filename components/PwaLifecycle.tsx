"use client";

import { Download, RefreshCw, WifiOff, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PLAYBACK_ACTIVITY_STORAGE_KEY } from "@/lib/audio-playback";
import { useAudio } from "./AudioProvider";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIosSafari() {
  const platform = navigator.userAgent;
  return /iP(?:hone|ad|od)/.test(platform) && /Safari/.test(platform) && !/(CriOS|FxiOS|EdgiOS)/.test(platform);
}

function hasSharedPlaybackActivity() {
  try {
    const value = JSON.parse(window.localStorage.getItem(PLAYBACK_ACTIVITY_STORAGE_KEY) ?? "null") as { expiresAt?: number } | null;
    return Number(value?.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

export function PwaLifecycle() {
  const { isPlaying, isLoading } = useAudio();
  const playbackActive = isPlaying || isLoading;
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updateAfterPlayback, setUpdateAfterPlayback] = useState(false);
  const [dismissedInstall, setDismissedInstall] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [iosInstallAvailable, setIosInstallAvailable] = useState(false);
  const [reloadAfterPlayback, setReloadAfterPlayback] = useState(false);
  const installConsumedRef = useRef(false);
  const updateActivationSentRef = useRef(false);
  const reloadingRef = useRef(false);
  const hadControllerRef = useRef(false);
  const playbackActiveRef = useRef(playbackActive);

  useEffect(() => { playbackActiveRef.current = playbackActive; }, [playbackActive]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      installConsumedRef.current = false;
      setInstallPrompt(event as InstallPromptEvent);
      setDismissedInstall(false);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowIosHelp(false);
    };
    // Keep the server and first client render equal. Read browser state after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOnline(navigator.onLine);
    setInstalled(isStandalone());
    setIosInstallAvailable(isIosSafari() && !isStandalone());
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;
    let trackedWorker: ServiceWorker | null = null;
    hadControllerRef.current = Boolean(navigator.serviceWorker.controller);
    const handleStateChange = () => {
      if (!cancelled && trackedWorker?.state === "installed" && navigator.serviceWorker.controller) setWaitingWorker(trackedWorker);
    };
    const handleUpdateFound = () => {
      trackedWorker?.removeEventListener("statechange", handleStateChange);
      trackedWorker = registration?.installing ?? null;
      trackedWorker?.addEventListener("statechange", handleStateChange);
    };
    const handleControllerChange = () => {
      if (!hadControllerRef.current) {
        hadControllerRef.current = true;
        return;
      }
      if (reloadingRef.current) return;
      if (playbackActiveRef.current || hasSharedPlaybackActivity()) {
        setReloadAfterPlayback(true);
        return;
      }
      reloadingRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((nextRegistration) => {
      if (cancelled) return;
      registration = nextRegistration;
      if (registration.waiting) setWaitingWorker(registration.waiting);
      registration.addEventListener("updatefound", handleUpdateFound);
      void registration.update();
    }).catch(() => {
      // The application remains usable when worker registration is unavailable.
    });
    return () => {
      cancelled = true;
      trackedWorker?.removeEventListener("statechange", handleStateChange);
      registration?.removeEventListener("updatefound", handleUpdateFound);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const activateUpdate = useCallback(() => {
    if (!waitingWorker) return;
    if (playbackActive || hasSharedPlaybackActivity()) {
      setUpdateAfterPlayback(true);
      return;
    }
    if (updateActivationSentRef.current) return;
    updateActivationSentRef.current = true;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  }, [playbackActive, waitingWorker]);

  useEffect(() => {
    if (!updateAfterPlayback || !waitingWorker) return;
    const timer = window.setInterval(() => {
      if (playbackActiveRef.current || hasSharedPlaybackActivity() || updateActivationSentRef.current) return;
      updateActivationSentRef.current = true;
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }, 1_500);
    return () => window.clearInterval(timer);
  }, [updateAfterPlayback, waitingWorker]);

  useEffect(() => {
    if (!reloadAfterPlayback) return;
    const timer = window.setInterval(() => {
      if (playbackActiveRef.current || hasSharedPlaybackActivity() || reloadingRef.current) return;
      reloadingRef.current = true;
      window.location.reload();
    }, 1_500);
    return () => window.clearInterval(timer);
  }, [reloadAfterPlayback]);

  const requestInstall = useCallback(async () => {
    if (installConsumedRef.current) return;
    if (!installPrompt) {
      if (isIosSafari() && !installed) setShowIosHelp(true);
      return;
    }
    installConsumedRef.current = true;
    const promptEvent = installPrompt;
    setInstallPrompt(null);
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch {
      // The browser can consume or revoke the prompt at any time.
    }
  }, [installPrompt, installed]);

  const canInstall = !installed && !dismissedInstall && (Boolean(installPrompt) || iosInstallAvailable);
  if (isOnline && !waitingWorker && !canInstall && !showIosHelp && !updateAfterPlayback) return null;

  return (
    <aside className="pwa-status" aria-label="Application status">
      {!isOnline ? (
        <div className="pwa-status-item" role="status">
          <WifiOff aria-hidden="true" />
          <span><strong>Offline.</strong> Opened pages remain available. Streaming needs a connection.</span>
        </div>
      ) : null}
      {waitingWorker || updateAfterPlayback ? (
        <div className="pwa-status-item" role="status">
          <RefreshCw aria-hidden="true" />
          <span>{updateAfterPlayback ? "Update queued. It will install when playback pauses." : "A new Lowkal build is ready."}</span>
          {!updateAfterPlayback ? <button type="button" onClick={activateUpdate}>{playbackActive ? "Update after playback" : "Update now"}</button> : null}
          <button type="button" className="pwa-status-close" aria-label="Dismiss update" onClick={() => { setWaitingWorker(null); setUpdateAfterPlayback(false); }}><X aria-hidden="true" /></button>
        </div>
      ) : null}
      {canInstall ? (
        <div className="pwa-status-item">
          <Download aria-hidden="true" />
          <span>Install Lowkal for a full-screen listening app.</span>
          <button type="button" onClick={requestInstall}>Install</button>
          <button type="button" className="pwa-status-close" aria-label="Dismiss install prompt" onClick={() => setDismissedInstall(true)}><X aria-hidden="true" /></button>
        </div>
      ) : null}
      {showIosHelp ? (
        <div className="pwa-status-item" role="status">
          <Download aria-hidden="true" />
          <span>In Safari, open Share, then select <strong>Add to Home Screen</strong>.</span>
          <button type="button" className="pwa-status-close" aria-label="Close installation help" onClick={() => setShowIosHelp(false)}><X aria-hidden="true" /></button>
        </div>
      ) : null}
    </aside>
  );
}
