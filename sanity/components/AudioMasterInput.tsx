"use client";

import { useEffect, useState } from "react";
import { Card, Stack, Text } from "@sanity/ui";
import { type FileInputProps } from "sanity";
import { audioUploadStatus } from "@/lib/audio-upload";

export function AudioMasterInput(props: FileInputProps) {
  const [now, setNow] = useState(() => Date.now());
  const uploading = Boolean(props.value?._upload);

  useEffect(() => {
    if (!uploading) return;
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, [uploading]);

  const status = audioUploadStatus(props.value, now);

  return (
    <Stack gap={3}>
      {props.renderDefault(props)}
      {status ? (
        <Card padding={3} radius={2} tone={status.stalled ? "caution" : "transparent"} role={status.stalled ? "alert" : "status"}>
          <Text size={1}>
            {status.stalled
              ? "No upload progress for at least 2 minutes. Cancel this upload, then select the file again. Keep Studio open until the file is saved."
              : `Upload: ${status.progress}%. Keep this Studio tab open until the file is saved.`}
          </Text>
        </Card>
      ) : null}
    </Stack>
  );
}
