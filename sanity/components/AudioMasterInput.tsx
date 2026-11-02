"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Button, Card, Stack, Text } from "@sanity/ui";
import { set, setIfMissing, unset, useClient, type FileInputProps } from "sanity";
import { audioUploadError, uploadAudioMaster, AUDIO_UPLOAD_ATTEMPTS } from "@/lib/audio-master-upload";

export function AudioMasterInput(props: FileInputProps) {
  const client = useClient({ apiVersion: "2026-01-01" });
  const input = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const selectedFile = useRef<File | null>(null);
  const [filename, setFilename] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    if (!running) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  function cancel() {
    controller.current?.abort();
    controller.current = null;
    setRunning(false);
    props.onChange(unset(["_upload"]));
    setMessage("Upload cancelled. Select the audio master to try again.");
    setError("");
  }

  async function upload(file: File) {
    if (props.readOnly || controller.current) return;
    if (!/\.(wav|flac)$/i.test(file.name) || file.size === 0) {
      setError("Select a WAV or FLAC file that is not empty.");
      return;
    }
    selectedFile.current = file;
    setFilename(file.name);
    const active = new AbortController();
    controller.current = active;
    setRunning(true);
    setError("");
    setMessage("");
    const createdAt = new Date().toISOString();
    let lastPercent = -1;
    try {
      const assetId = await uploadAudioMaster(client, file, {
        signal: active.signal,
        onAttempt(number) {
          setAttempt(number);
          setProgress(0);
          lastPercent = -1;
          props.onChange([
            setIfMissing({ _type: "file" }),
            set({ createdAt, updated: new Date().toISOString(), progress: 0, file: { name: file.name, type: file.type } }, ["_upload"])
          ]);
        },
        onProgress(percent) {
          if (active.signal.aborted || percent === lastPercent) return;
          lastPercent = percent;
          setProgress(percent);
          props.onChange([set(percent, ["_upload", "progress"]), set(new Date().toISOString(), ["_upload", "updated"])]);
        }
      });
      if (active.signal.aborted) return;
      props.onChange([set({ _type: "reference", _ref: assetId }, ["asset"]), unset(["_upload"])]);
      selectedFile.current = null;
      setMessage("Audio uploaded. Wait for Studio to save, then publish the mix.");
    } catch (failure) {
      if (active.signal.aborted) return;
      // Leave _upload in place so a failed replacement cannot publish the old master.
      setError(`${audioUploadError(failure)} Use Retry upload, or select the file again.`);
    } finally {
      if (controller.current === active) {
        controller.current = null;
        setRunning(false);
      }
    }
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) void upload(file);
  }

  return (
    <Stack gap={3}>
      {props.value?.asset && !props.value._upload ? props.renderDefault({ ...props, readOnly: true }) : null}
      <div>
        <Button text={props.value?.asset ? "Replace audio master" : "Choose audio master"} tone="primary" disabled={props.readOnly || running} onClick={() => input.current?.click()} />
        <input ref={input} type="file" hidden aria-label="Choose WAV or FLAC master" accept=".wav,.flac,audio/wav,audio/flac" disabled={props.readOnly || running} onChange={selectFile} />
      </div>
      {running ? (
        <Card padding={3} radius={2} tone="primary">
          <Stack gap={3}>
            <Text size={1}>{filename}</Text>
            <progress aria-label="Audio upload progress" value={progress} max={100} style={{ width: "100%" }} />
            <Text size={1} role="status">{progress >= 100 ? "File sent. Waiting for Sanity to save it." : `Upload: ${progress}%. Attempt ${attempt} of ${AUDIO_UPLOAD_ATTEMPTS}.`}</Text>
            {attempt > 1 ? <Text size={1}>The connection stopped. The upload restarted from the beginning.</Text> : null}
            <Text size={1}>Keep this Studio tab open. A stopped upload retries automatically.</Text>
            <Button text="Cancel upload" tone="critical" disabled={props.readOnly} onClick={cancel} />
          </Stack>
        </Card>
      ) : null}
      {!running && props.value?._upload ? (
        <Card padding={3} radius={2} tone="caution">
          <Stack gap={3}>
            <Text size={1} role="alert">{error || "This upload is incomplete. Select the audio master again to restart it."}</Text>
            {error && filename ? <Button text="Retry upload" disabled={props.readOnly} onClick={() => { if (selectedFile.current) void upload(selectedFile.current); }} /> : null}
            <Button text="Clear incomplete upload" disabled={props.readOnly} onClick={cancel} />
          </Stack>
        </Card>
      ) : error ? <Text size={1} role="alert">{error}</Text> : null}
      {message ? <Text size={1} role="status">{message}</Text> : null}
    </Stack>
  );
}
