"use client";

import { useEffect, useRef } from "react";
import { type NumberInputProps, set, unset, useClient, useFormValue } from "sanity";
import { durationSecondsFromWav } from "@/lib/audio-duration";

type FileValue = { asset?: { _ref?: string } };

function rangeTotal(contentRange: string | null) {
  const match = /\/(\d+)$/.exec(contentRange || "");
  return match ? Number(match[1]) : undefined;
}

function durationFromMediaElement(url: string) {
  return new Promise<number | undefined>((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    const finish = (value?: number) => {
      audio.removeAttribute("src");
      audio.load();
      resolve(value);
    };
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      finish(Number.isFinite(duration) && duration > 0 ? Math.max(1, Math.round(duration)) : undefined);
    };
    audio.onerror = () => finish(undefined);
    audio.src = url;
  });
}

async function durationFromAudioUrl(url: string, fileSize?: number) {
  try {
    const header = await fetch(url, { headers: { Range: "bytes=0-131071" } });
    const length = Number(header.headers.get("content-length") || 0);
    const total = rangeTotal(header.headers.get("content-range")) || fileSize;
    if (header.status === 206 || (header.ok && length > 0 && length <= 262144)) {
      const wav = durationSecondsFromWav(new Uint8Array(await header.arrayBuffer()), total);
      if (wav) return wav;
    } else {
      await header.body?.cancel();
    }
  } catch {
    /* use the media element */
  }
  return durationFromMediaElement(url);
}

export function MixDurationInput(props: NumberInputProps) {
  const master = useFormValue(["audio", "master"]) as FileValue | undefined;
  const assetId = master?.asset?._ref;
  const client = useClient({ apiVersion: "2026-08-24" });
  const valueRef = useRef(props.value);
  const onChangeRef = useRef(props.onChange);
  const lastAssetId = useRef<string | undefined>(undefined);

  useEffect(() => {
    valueRef.current = props.value;
    onChangeRef.current = props.onChange;
  }, [props.onChange, props.value]);

  useEffect(() => {
    let cancelled = false;
    if (!assetId) {
      if (lastAssetId.current) onChangeRef.current(unset());
      lastAssetId.current = undefined;
      return;
    }
    if (assetId === lastAssetId.current) return;
    lastAssetId.current = assetId;

    (async () => {
      const asset = await client.fetch<{ url?: string; size?: number } | null>("*[_id == $id][0]{url, size}", { id: assetId });
      const url = typeof asset?.url === "string" ? asset.url : "";
      if (!url || cancelled) return;
      const duration = await durationFromAudioUrl(url, typeof asset?.size === "number" ? asset.size : undefined);
      if (cancelled || !duration || valueRef.current === duration) return;
      onChangeRef.current(set(duration));
    })();

    return () => {
      cancelled = true;
    };
  }, [assetId, client]);

  return props.renderDefault({ ...props, readOnly: true });
}
