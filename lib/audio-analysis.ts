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

export type MixerSettings = { bass: number; mid: number; treble: number; enabled: boolean };
export type MixerState = MixerSettings & { available: boolean };
const defaultMixer = (): MixerSettings => ({ bass: 0, mid: 0, treble: 0, enabled: true });

type AnalysisGraph = {
  source: MediaElementAudioSourceNode;
  analyser: AnalyserNode;
  filters: BiquadFilterNode[];
  headroom: GainNode;
  connected: boolean;
  frequency: Uint8Array<ArrayBuffer>;
  waveform: Uint8Array<ArrayBuffer>;
};

export function createAudioAnalysis(createContext: () => AudioContext, origin: string) {
  let context: AudioContext | null = null;
  let element: HTMLAudioElement | null = null;
  const graphs = new WeakMap<HTMLAudioElement, AnalysisGraph>();
  const mixer = defaultMixer();
  const mixerListeners = new Set<() => void>();
  const notifyMixer = () => { for (const listener of mixerListeners) listener(); };
  const subscribeMixer = (listener: () => void) => {
    mixerListeners.add(listener);
    return () => { mixerListeners.delete(listener); };
  };

  const liveSource = (media: HTMLAudioElement | null) => media?.currentSrc || media?.src;
  const liveAvailable = () => Boolean(
    element && !element.error && element.crossOrigin === "anonymous"
    && graphs.get(element)?.connected && context?.state === "running"
    && isAnalysisSource(liveSource(element), origin)
  );
  const getMixer = (): MixerState => ({ ...mixer, available: liveAvailable() });
  const applyMixer = (graph: AnalysisGraph, immediate = false) => {
    const levels = [mixer.bass, mixer.mid, mixer.treble].map((value) => mixer.enabled ? value : 0);
    const headroom = 10 ** (-levels.reduce((sum, value) => sum + Math.max(0, value), 0) / 20);
    const now = context!.currentTime;
    const ramp = (parameter: AudioParam, value: number, exponential = false) => {
      if (immediate) { parameter.value = value; return; }
      parameter.cancelAndHoldAtTime(now);
      if (exponential) parameter.exponentialRampToValueAtTime(value, now + 0.05);
      else parameter.linearRampToValueAtTime(value, now + 0.05);
    };
    // Linear dB ramps and an exponential gain ramp keep conservative headroom
    // throughout the transition, including when a new command interrupts it.
    ramp(graph.headroom.gain, headroom, true);
    graph.filters.forEach((filter, index) => ramp(filter.gain, levels[index]));
  };
  const setMixer = (settings: unknown) => {
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) return getMixer();
    const input = settings as Record<string, unknown>;
    for (const band of ["bass", "mid", "treble"] as const) {
      const value = input[band];
      if (typeof value === "number" && Number.isFinite(value)) mixer[band] = Math.min(6, Math.max(-12, value));
    }
    if (typeof input.enabled === "boolean") mixer.enabled = input.enabled;
    const graph = element && graphs.get(element);
    if (graph) applyMixer(graph);
    notifyMixer();
    return getMixer();
  };

  const setElement = (next: HTMLAudioElement | null) => {
    if (element === next) return;
    const previous = element && graphs.get(element);
    previous?.source.disconnect();
    previous?.analyser.disconnect();
    previous?.headroom.disconnect();
    previous?.filters.forEach((filter) => filter.disconnect());
    if (previous) previous.connected = false;
    element = next;
    notifyMixer();
  };

  const activate = (nextSource?: string) => {
    const sourceUrl = nextSource ?? (element?.currentSrc || element?.src);
    if (!isAnalysisSource(sourceUrl, origin) || (!nextSource && element?.crossOrigin !== "anonymous")) return;
    try {
      context ??= createContext();
      context.onstatechange = notifyMixer;
      const target = nextSource ? null : element;
      const activeContext = context;
      void activeContext.resume().then(() => {
        if (!target || element !== target || activeContext.state !== "running") return;
        if (target.crossOrigin !== "anonymous" || !isAnalysisSource(liveSource(target), origin)) return;
        let graph = graphs.get(target);
        if (!graph) {
          const analyser = activeContext.createAnalyser();
          analyser.fftSize = 2048;
          analyser.smoothingTimeConstant = 0.7;
          const headroom = activeContext.createGain();
          const filters = ([['lowshelf', 250], ['peaking', 1000], ['highshelf', 4000]] as const).map(([type, frequency]) => {
            const filter = activeContext.createBiquadFilter();
            filter.type = type;
            filter.frequency.value = frequency;
            filter.Q.value = 1;
            return filter;
          });
          // Prepare all optional nodes before capturing the media element.
          const prepared = { analyser, headroom, filters, connected: false, frequency: new Uint8Array(analyser.frequencyBinCount), waveform: new Uint8Array(analyser.fftSize) };
          const source = activeContext.createMediaElementSource(target);
          graph = { source, ...prepared };
          graphs.set(target, graph);
        }
        if (graph.connected) return;
        applyMixer(graph, true);
        graph.headroom.connect(graph.filters[0]);
        graph.filters[0].connect(graph.filters[1]);
        graph.filters[1].connect(graph.filters[2]);
        // One audible path; the independent FFT tap reads the post-EQ signal.
        graph.filters[2].connect(activeContext.destination);
        graph.filters[2].connect(graph.analyser);
        graph.source.connect(graph.headroom);
        graph.connected = true;
        notifyMixer();
      }).catch(() => { /* Analysis must not prevent media playback. */ });
    } catch { /* Web Audio is optional; the media element still plays. */ }
  };

  const read = (): AudioSpectrum => {
    const graph = element && graphs.get(element);
    if (!graph || !context || !liveAvailable()) return unavailable();
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
    mixerListeners.clear();
  };
  return { setElement, activate, read, dispose, getMixer, setMixer, subscribeMixer, resetMixer: () => setMixer(defaultMixer()) };
}

const documentPath = (path: string) => path.replace(/\/index(?:\.html)?$/, "").replace(/\/$/, "");

export function startMixerBridge(scope: Window, controller: Pick<ReturnType<typeof createAudioAnalysis>, "getMixer" | "setMixer" | "subscribeMixer">, roomPath = "/soundroom/index.html") {
  const origin = scope.location.origin;
  const expectedPath = documentPath(roomPath);
  const targets = () => {
    const result: Window[] = [];
    for (const frame of scope.document.querySelectorAll<HTMLIFrameElement>('iframe[title="Lowkal Soundroom"]')) {
      try {
        const url = new URL(frame.src, origin);
        const target = frame.contentWindow;
        if (!frame.isConnected || frame.title !== "Lowkal Soundroom" || !target || url.username || url.password
          || url.origin !== origin || documentPath(url.pathname) !== expectedPath) continue;
        if (target.location.origin !== origin || documentPath(target.location.pathname) !== expectedPath) continue;
        result.push(target);
      } catch { /* Ignore inaccessible or removed frames. */ }
    }
    return result;
  };
  const post = (target: Window) => {
    try { target.postMessage({ channel: "lowkal.mixer.v1", type: "state", state: controller.getMixer() }, origin); }
    catch { /* A frame can be removed before posting. */ }
  };
  const broadcast = () => { for (const target of targets()) post(target); };
  const onMessage = (event: MessageEvent) => {
    if (event.origin !== origin || !targets().some((target) => target === event.source)) return;
    const data = event.data;
    if (!data || data.channel !== "lowkal.mixer.v1" || data.type !== "command" || !data.command) return;
    if (data.command.action === "request-state") post(event.source as Window);
    if (data.command.action === "set") {
      controller.setMixer(data.command.settings);
      // Invalid input also receives the authoritative, unchanged state.
      post(event.source as Window);
    }
  };
  scope.addEventListener("message", onMessage);
  const unsubscribe = controller.subscribeMixer(broadcast);
  broadcast();
  return () => { scope.removeEventListener("message", onMessage); unsubscribe(); };
}

export function startAnalysisBridge(scope: Window, read: () => AudioSpectrum, isPlaying: () => boolean, roomPath = "/soundroom/index.html") {
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