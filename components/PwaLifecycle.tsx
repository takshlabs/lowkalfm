"use client";

import { useEffect, useRef } from "react";
import { PLAYBACK_ACTIVITY_STORAGE_KEY } from "@/lib/audio-playback";
import { useAudio } from "./AudioProvider";

function hasSharedPlaybackActivity() {
  try {
    const value = JSON.parse(window.localStorage.getItem(PLAYBACK_ACTIVITY_STORAGE_KEY) ?? "null") as { expiresAt?: number } | null;
    return Number(value?.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

export function PwaLifecycle() {
  const { isPlaying, isLoading, isExternalMediaPlaying } = useAudio();
  const playbackActive = isPlaying || isLoading || isExternalMediaPlaying;
  const playbackActiveRef = useRef(playbackActive);

  useEffect(() => {
    playbackActiveRef.current = playbackActive;
  }, [playbackActive]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;
    let trackedWorker: ServiceWorker | null = null;
    let deferredWorker: ServiceWorker | null = null;
    let updateActivationSent = false;
    let reloadAfterPlayback = false;
    let reloading = false;
    let hadController = Boolean(navigator.serviceWorker.controller);

    const playbackIsActive = () => playbackActiveRef.current || hasSharedPlaybackActivity();
    const activateWorker = (worker: ServiceWorker) => {
      if (playbackIsActive()) {
        deferredWorker = worker;
        return;
      }
      if (updateActivationSent) return;
      updateActivationSent = true;
      worker.postMessage({ type: "SKIP_WAITING" });
    };
    const handleStateChange = () => {
      if (!cancelled && trackedWorker?.state === "installed" && navigator.serviceWorker.controller) activateWorker(trackedWorker);
    };
    const handleUpdateFound = () => {
      trackedWorker?.removeEventListener("statechange", handleStateChange);
      trackedWorker = registration?.installing ?? null;
      trackedWorker?.addEventListener("statechange", handleStateChange);
    };
    const handleControllerChange = () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      if (reloading) return;
      if (playbackIsActive()) {
        reloadAfterPlayback = true;
        return;
      }
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((nextRegistration) => {
      if (cancelled) return;
      registration = nextRegistration;
      if (registration.waiting) activateWorker(registration.waiting);
      registration.addEventListener("updatefound", handleUpdateFound);
      void registration.update();
    }).catch(() => {
      // The application remains usable when worker registration is unavailable.
    });

    const idleCheck = window.setInterval(() => {
      if (playbackIsActive()) return;
      if (deferredWorker && !updateActivationSent) activateWorker(deferredWorker);
      if (reloadAfterPlayback && !reloading) {
        reloading = true;
        window.location.reload();
      }
    }, 1_500);

    return () => {
      cancelled = true;
      window.clearInterval(idleCheck);
      trackedWorker?.removeEventListener("statechange", handleStateChange);
      registration?.removeEventListener("updatefound", handleUpdateFound);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  return null;
}