const TRUSTED_AUDIO_ORIGINS = new Set([
  "https://cdn.sanity.io",
  "https://lowkal-audio-sync.lowkal-audio-737a.workers.dev",
]);

export type AudioSpectrum = { bass: number; mid: number; treble: number; level: number; available: boolean };
const unavailable = (): AudioSpectrum => ({ bass: 0, mid: 0, treble: 0, level: 0, available: false });

export function spectrumFromBins(frequency: Uint8Array, waveform: Uint8Array, sampleRate: number): AudioSpectrum {
  if (!frequency.length || !Number.isFinite(sampleRate) || sampleRate <= 0) return unavailable();
  const binHz = sampleRate / (frequency.length * 2);
  const band = (low: number, high: number) => {
    const start = Math.min(frequency.length, Math.ceil(low / binHz));
    const end = Math.min(frequency.length, Math.ceil(high / binHz));
    let sum = 0;
    for (let index = start; index < end; index += 1) sum += frequency[index];
    return end > start ? sum / ((end - start) * 255) : 0;
  };
  let energy = 0;
  for (const sample of waveform) energy += ((sample - 128) / 128) ** 2;
  return { bass: band(20, 250), mid: band(250, 2000), treble: band(2000, 16000), level: waveform.length ? Math.min(1, Math.sqrt(energy / waveform.length)) : 0, available: true };
}

export function isAnalysisSource(source: string | undefined, origin: string): boolean {
  if (!source) return false;
  try {
    const url = new URL(source, origin);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password
      && (url.origin === origin || TRUSTED_AUDIO_ORIGINS.has(url.origin));
  } catch { return false; }
}

type AnalysisGraph = {
  source: MediaElementAudioSourceNode;
  analyser: AnalyserNode;
  frequency: Uint8Array<ArrayBuffer>;
  waveform: Uint8Array<ArrayBuffer>;
};

export function createAudioAnalysis(createContext: () => AudioContext, origin: string) {
  let context: AudioContext | null = null;
  let element: HTMLAudioElement | null = null;
  const graphs = new WeakMap<HTMLAudioElement, AnalysisGraph>();

  const setElement = (next: HTMLAudioElement | null) => {
    if (element === next) return;
    const previous = element && graphs.get(element);
    previous?.source.disconnect();
    previous?.analyser.disconnect();
    element = next;
  };

  const activate = (nextSource?: string) => {
    const sourceUrl = nextSource ?? (element?.currentSrc || element?.src);
    if (!isAnalysisSource(sourceUrl, origin) || (!nextSource && element?.crossOrigin !== "anonymous")) return;
    try {
      context ??= createContext();
      const target = nextSource ? null : element;
      const activeContext = context;
      void activeContext.resume().then(() => {
        if (!target || element !== target || activeContext.state !== "running") return;
        let graph = graphs.get(target);
        if (!graph) {
          const analyser = activeContext.createAnalyser();
          analyser.fftSize = 2048;
          analyser.smoothingTimeConstant = 0.7;
          const source = activeContext.createMediaElementSource(target);
          graph = { source, analyser, frequency: new Uint8Array(analyser.frequencyBinCount), waveform: new Uint8Array(analyser.fftSize) };
          graphs.set(target, graph);
        }
        // The output path does not depend on sampling or frame visibility.
        graph.source.connect(activeContext.destination);
        graph.source.connect(graph.analyser);
      }).catch(() => { /* Analysis must not prevent media playback. */ });
    } catch { /* Web Audio is optional; the media element still plays. */ }
  };

  const read = (): AudioSpectrum => {
    const graph = element && graphs.get(element);
    if (!graph || context?.state !== "running") return unavailable();
    try {
      graph.analyser.getByteFrequencyData(graph.frequency);
      graph.analyser.getByteTimeDomainData(graph.waveform);
      return spectrumFromBins(graph.frequency, graph.waveform, context.sampleRate);
    } catch { return unavailable(); }
  };

  const dispose = () => {
    setElement(null);
    try { if (context) void context.close().catch(() => undefined); } catch { /* Already closed. */ }
    context = null;
  };
  return { setElement, activate, read, dispose };
}

export function startAnalysisBridge(scope: Window, read: () => AudioSpectrum, isPlaying: () => boolean, roomPath = "/soundroom/index.html") {
  const documentPath = (path: string) => path.replace(/\/index(?:\.html)?$/, "").replace(/\/$/, "");
  const expectedPath = documentPath(roomPath);
  const document = scope.document;
  const origin = scope.location.origin;
  const lastAvailable = new WeakMap<Window, boolean>();
  let timer: number | undefined;

  const tick = () => {
    if (document.visibilityState !== "visible") return;
    const targets: Window[] = [];
    for (const frame of document.querySelectorAll<HTMLIFrameElement>('iframe[title="Lowkal Soundroom"]')) {
      try {
        const url = new URL(frame.src, origin);
        const target = frame.contentWindow;
        if (!frame.isConnected || url.origin !== origin || documentPath(url.pathname) !== expectedPath || !target) continue;
        // Check the current document too: an iframe can navigate after src was set.
        if (target.location.origin !== origin || documentPath(target.location.pathname) !== expectedPath) continue;
        const style = scope.getComputedStyle(frame);
        const rect = frame.getBoundingClientRect();
        if (style.display === "none" || style.visibility !== "visible" || style.opacity === "0"
          || rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.right <= 0
          || rect.top >= scope.innerHeight || rect.left >= scope.innerWidth) continue;
        targets.push(target);
      } catch { /* Ignore cross-origin, unloaded, or removed frames. */ }
    }
    if (!targets.length) return;
    const data = isPlaying() ? read() : unavailable();
    for (const target of targets) {
      if (!data.available && lastAvailable.get(target) === false) continue;
      try {
        target.postMessage({ channel: "lowkal.analysis.v1", type: "spectrum", data }, origin);
        lastAvailable.set(target, data.available);
      } catch { /* A frame can be removed between discovery and posting. */ }
    }
  };
  const visibilityChanged = () => {
    if (timer !== undefined) scope.clearInterval(timer);
    timer = undefined;
    if (document.visibilityState === "visible") {
      tick();
      timer = scope.setInterval(tick, 1000 / 30);
    }
  };
  document.addEventListener("visibilitychange", visibilityChanged);
  visibilityChanged();
  return () => {
    if (timer !== undefined) scope.clearInterval(timer);
    document.removeEventListener("visibilitychange", visibilityChanged);
  };
}