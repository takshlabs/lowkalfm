type Bands = { bass: number[]; mids: number[]; highs: number[] };
type DisplayData = { peaks: number[]; bands: Bands | null };
export function timeFromProgress(percent: number, duration: number) {
  if (!Number.isFinite(percent) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(duration, Math.max(0, Math.round(percent / 100 * duration * 1000) / 1000));
}
const validValues = (value: unknown): value is number[] => Array.isArray(value) && value.length > 0 && value.length <= 16384 && value.every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1);

export function parseWaveformData(payload: unknown): DisplayData {
  if (!payload || typeof payload !== "object") throw new Error("Invalid waveform data");
  const data = payload as { version?: number; peaks?: unknown; bands?: Partial<Bands> };
  if (!validValues(data.peaks)) throw new Error("Invalid waveform peaks");
  if (data.version !== 2) return { peaks: data.peaks, bands: null };
  const peakLength = data.peaks.length;
  const bands = data.bands;
  if (!bands || !validValues(bands.bass) || !validValues(bands.mids) || !validValues(bands.highs) || [bands.bass, bands.mids, bands.highs].some(v => v.length !== peakLength)) throw new Error("Invalid waveform bands");
  return { peaks: data.peaks, bands: bands as Bands };
}

// RMS aggregation preserves interval energy at every display width.
export function aggregateWaveform(values: number[], count: number) {
  if (!values.length) return [];
  const size = Math.max(1, Math.min(values.length, Math.floor(count)));
  return Array.from({ length: size }, (_, index) => {
    const start = Math.floor(index * values.length / size), end = Math.max(start + 1, Math.floor((index + 1) * values.length / size));
    let sum = 0;
    for (let i = start; i < end; i++) sum += values[i] * values[i];
    return Math.sqrt(sum / (end - start));
  });
}

function timeLabel(seconds: number) {
  const value = Math.floor(Math.max(0, seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

export function createSpectrumWaveform(container: HTMLElement, options: { compact?: boolean; duration: number; canSeek: () => boolean; onSeek: (seconds: number) => void }) {
  const canvas = document.createElement("canvas"), preview = document.createElement("output");
  canvas.setAttribute("aria-hidden", "true");
  preview.className = "spectrum-waveform-preview"; preview.hidden = true; preview.setAttribute("aria-live", "off");
  container.classList.add("spectrum-waveform");
  container.replaceChildren(canvas, preview);
  let data: DisplayData = { peaks: [], bands: null }, position = 0, drag: { id: number; time: number } | null = null;
  let destroyed = false, lastWidth = 0, lastHeight = 0;
  let geometry: number[] = [];
  const ctx = canvas.getContext("2d");
  const draw = () => {
    if (!ctx || destroyed) return;
    const width = container.clientWidth, height = container.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    const style = getComputedStyle(container), cursor = style.getPropertyValue("--spectrum-cursor").trim() || "#f1eadb";
    if (lastWidth !== width || lastHeight !== height || !geometry.length) {
      lastWidth = width; lastHeight = height;
      const source = data.bands ? data.peaks.map((_, i) => Math.sqrt((data.bands!.bass[i] ** 2 + data.bands!.mids[i] ** 2 + data.bands!.highs[i] ** 2) / 3)) : data.peaks;
      const values = aggregateWaveform(source, Math.min(160, width / 5));
      const maximum = Math.max(.001, ...values);
      // Smooth measured interval energy into one ribbon. Retain real silence.
      geometry = values.map((value, i) => {
        if (value === 0) return 0;
        const weights = [1, 2, 3, 2, 1];
        const smoothed = weights.reduce((sum, weight, j) => sum + values[Math.max(0, Math.min(values.length - 1, i + j - 2))] * weight, 0) / 9;
        return Math.pow(smoothed / maximum, .8);
      });
    }
    const x = width * Math.max(0, Math.min(1, (drag?.time ?? position) / Math.max(1, options.duration)));
    if (!data.peaks.length) {
      ctx.fillStyle = cursor; ctx.globalAlpha = .25; ctx.fillRect(0, height / 2 - 1, width, 2); ctx.globalAlpha = .85; ctx.fillRect(0, height / 2 - 1, x, 2);
    } else {
      const path = new Path2D();
      const step = width / Math.max(1, geometry.length - 1), amplitude = height * .32;
      const points = geometry.map((v, i) => [i * step, height / 2 - v * amplitude]);
      points.push(...geometry.map((v, i) => [i * step, height / 2 + v * amplitude]).reverse());
      path.moveTo(points[0][0], points[0][1]);
      for (let i = 0; i < points.length - 1; i++) {
        const previous = points[Math.max(0, i - 1)], from = points[i], to = points[i + 1], next = points[Math.min(points.length - 1, i + 2)];
        // Keep both end caps straight; smooth only the upper and lower edges.
        if (i === geometry.length - 1) path.lineTo(to[0], to[1]);
        else path.bezierCurveTo(from[0] + (to[0] - previous[0]) / 6, from[1] + (to[1] - previous[1]) / 6, to[0] - (next[0] - from[0]) / 6, to[1] - (next[1] - from[1]) / 6, to[0], to[1]);
      }
      path.closePath();
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      ["--spectrum-mids", "--spectrum-bass", "--spectrum-highs"].forEach((token, i) => gradient.addColorStop(i / 2, style.getPropertyValue(token).trim() || ["#a5dccb", "#eaa7b8", "#b8b2ec"][i]));
      ctx.fillStyle = data.bands ? gradient : cursor; ctx.strokeStyle = data.bands ? gradient : cursor; ctx.lineWidth = 1;
      ctx.globalAlpha = .25; ctx.fill(path); ctx.globalAlpha = .45; ctx.stroke(path);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, x, height); ctx.clip(); ctx.globalAlpha = .9; ctx.fill(path); ctx.globalAlpha = .9; ctx.stroke(path); ctx.restore();
    }
    ctx.globalAlpha = .9; ctx.fillStyle = cursor; ctx.fillRect(Math.min(width - 1.5, x), height * .12, 1.5, height * .76);
    ctx.beginPath(); ctx.arc(Math.max(2.5, Math.min(width - 2.5, x)), height * .12, 2.5, 0, Math.PI * 2); ctx.fill();
  };
  const target = (clientX: number) => {
    const bounds = container.getBoundingClientRect();
    return timeFromProgress((clientX - bounds.left) / Math.max(1, bounds.width) * 100, options.duration);
  };
  const showPreview = (clientX: number) => {
    const seconds = target(clientX); preview.textContent = timeLabel(seconds); preview.hidden = false;
    preview.style.left = `${Math.max(26, Math.min(container.clientWidth - 26, seconds / Math.max(1, options.duration) * container.clientWidth))}px`;
    return seconds;
  };
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || !options.canSeek()) return;
    drag = { id: event.pointerId, time: showPreview(event.clientX) }; container.setPointerCapture(event.pointerId); draw();
  };
  const move = (event: PointerEvent) => {
    if (!options.canSeek()) return;
    const time = showPreview(event.clientX); if (drag?.id === event.pointerId) { drag.time = time; draw(); }
  };
  const up = (event: PointerEvent) => {
    if (drag?.id !== event.pointerId) return;
    const seconds = target(event.clientX); drag = null; preview.hidden = true;
    if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
    if (options.canSeek()) options.onSeek(seconds); draw();
  };
  const cancel = () => { drag = null; preview.hidden = true; draw(); };
  const leave = () => { if (!drag) preview.hidden = true; };
  container.addEventListener("pointerdown", down); container.addEventListener("pointermove", move); container.addEventListener("pointerup", up); container.addEventListener("pointercancel", cancel); container.addEventListener("lostpointercapture", cancel); container.addEventListener("pointerleave", leave);
  const observer = new ResizeObserver(draw); observer.observe(container); draw();
  return {
    setData(payload: unknown) { data = parseWaveformData(payload); geometry = []; container.dataset.state = data.bands ? "spectrum" : "ready"; container.setAttribute("aria-description", data.bands ? "Recorded bass, mid, and high frequency levels." : "Recorded amplitude. Frequency data is not available."); draw(); },
    setTime(seconds: number, duration = options.duration) { position = Number.isFinite(seconds) ? seconds : 0; options.duration = Number.isFinite(duration) && duration > 0 ? duration : 0; draw(); },
    destroy() { destroyed = true; observer.disconnect(); container.removeEventListener("pointerdown", down); container.removeEventListener("pointermove", move); container.removeEventListener("pointerup", up); container.removeEventListener("pointercancel", cancel); container.removeEventListener("lostpointercapture", cancel); container.removeEventListener("pointerleave", leave); container.replaceChildren(); }
  };
}
