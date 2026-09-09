import vinext from "vinext";
import { defineConfig, type Plugin } from "vite";

function staticRscMetadata(): Plugin {
  let compatibilityId = "";
  return {
    name: "lowkal-static-rsc-metadata",
    apply: "build",
    configResolved(config) {
      compatibilityId = JSON.parse(config.define?.["process.env.__VINEXT_RSC_COMPATIBILITY_ID"] ?? '""');
    },
    generateBundle() {
      if (this.environment.name !== "client") return;
      if (!compatibilityId) throw new Error("Vinext did not expose its RSC compatibility ID");
      this.emitFile({ type: "asset", fileName: "lowkal-rsc-compatibility.json", source: JSON.stringify({ compatibilityId }) });
    }
  };
}

const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"]
};

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : undefined,
    plugins: [
      vinext(),
      staticRscMetadata(),
      cloudflare({ viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] }, config: localBindingConfig })
    ]
  };
});
