import { WorkflowEntrypoint } from "cloudflare:workers";
import { copyAudioMaster } from "./audio-sync.ts";

export { default } from "./audio-sync.ts";

export class AudioSyncWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    return step.do("copy master and publish audio", {
      timeout: "30 minutes",
      retries: { limit: 3, delay: "30 seconds", backoff: "exponential" }
    }, async () => {
      const response = await copyAudioMaster(event.payload, this.env);
      if (!response.ok) throw new Error(`Audio copy failed: ${response.status} ${await response.text()}`);
      return response.json();
    });
  }
}
