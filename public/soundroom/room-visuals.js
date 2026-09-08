import { readSpectrum, visualFrame } from './visual-state.js';

const canvas = document.getElementById('shader-canvas-ANIMATION_5');
const motion = document.getElementById('visual-motion');
const scene = document.getElementById('visual-scene');
const intensity = document.getElementById('visual-intensity');
const focus = document.getElementById('visual-focus');
const status = document.getElementById('visual-status');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let still = reducedMotion.matches;
let signal = readSpectrum(null);
let receivedAt = -Infinity;
let playing = false;
let raf = 0;
let lastFrame = 0;
let elapsed = 0;
let renderer = null;
let current = [0, 0, 0, 0];
let palette = [[0.015, 0.025, 0.065], [0.1, 0.2, 0.6], [0.48, 0.66, 1]];
let targetPalette = palette.map((color) => [...color]);
const pointer = [0, 0];
const vertexShaderSource = `attribute vec2 a_position;
varying vec2 v_uv;
void main() { v_uv = a_position * .5 + .5; gl_Position = vec4(a_position, 0., 1.); }`;
const fragmentShaderSource = `precision mediump float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec4 u_audio;
uniform float u_intensity;
uniform float u_scene;
uniform vec2 u_pointer;
uniform vec3 u_paletteBase;
uniform vec3 u_paletteMid;
uniform vec3 u_paletteAccent;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p) {
  float value=0., amplitude=.5;
  for(int i=0; i<4; i++) { value+=amplitude*noise(p); p=mat2(.8,-.6,.6,.8)*p*2.03+3.4; amplitude*=.5; }
  return value;
}
void main() {
  vec2 uv = v_uv;
  vec2 p = (uv-.5)*vec2(u_resolution.x/u_resolution.y,1.);
  p += u_pointer*.015;
  float t=u_time*.11;
  float bass=u_audio.x, mid=u_audio.y, high=u_audio.z;
  float light=0., haze=0.;
  if(u_scene < .5) {
    // Folded light curtains: bass opens the folds, mids bend the field.
    vec2 q=p*2.;
    float flow=fbm(q+vec2(t*.32,-t*.23));
    float warp=fbm(q*1.3+flow*2.5+vec2(-t*.18,t*.32));
    float folds=q.x*1.5+q.y*.65+warp*(2.8+bass*.55)+t*.16;
    float ribbon=abs(sin(folds*3.6));
    float fine=pow(1.-ribbon,16.);
    light=fine*.48+pow(1.-ribbon,3.)*.22;
    light*=smoothstep(-.8,.6,p.y+flow)*(.6+mid*.3);
    haze=warp*.18+flow*.08;
    light+=pow(1.-abs(sin(folds*3.6+.13)),35.)*.16;
  } else if(u_scene < 1.5) {
    // A fluid topographic surface, with measured audio displacing contours.
    float field=fbm(p*2.+vec2(t*.16,t*.09));
    field+=sin(p.x*2.5+t*.4)*.14+cos(p.y*2.-t*.3)*.13;
    float bands=field*(17.+bass*1.2)+mid*.22;
    float line=abs(fract(bands)-.5);
    light=(1.-smoothstep(.012,.046,line))*.42;
    light+=(1.-smoothstep(.04,.22,line))*.08;
    haze=field*.18;
  } else {
    // Interference rings: no beat is invented when the audio is unavailable.
    vec2 q=p-vec2(-.15,.08);
    q=mat2(.94,-.34,.34,.94)*q;
    q.y*=1.4;
    float r=length(q), a=atan(q.y,q.x);
    float ripple=sin(a*3.+t*.5)*.02+sin(a*5.-t*.4)*.014;
    float ring=r+ripple*(1.+bass*2.);
    float envelope=exp(-pow((r-.38-bass*.035)*3.2,2.));
    float bands=abs(sin(ring*65.-t*.8-mid*.5));
    light=pow(1.-bands,12.)*envelope*.63;
    light+=exp(-abs(ring-.38-bass*.035)*80.)*.28;
    haze=envelope*.17;
  }
  vec3 cobalt=mix(vec3(.11,.23,.7),u_paletteMid,.36);
  vec3 ice=mix(vec3(.48,.66,1.),u_paletteAccent,.3);
  vec3 color=mix(vec3(.014,.024,.057),u_paletteBase,.25);
  color+=cobalt*(haze+light*1.6)*(.45+u_intensity);
  color+=ice*pow(light,2.)*(1.8+high*.65)*u_intensity;
  float vignette=1.-smoothstep(.25,1.2,length((uv-.5)*vec2(1.,.85)));
  color*=.45+.55*vignette;
  gl_FragColor=vec4(color,1.);
}`;

window.setSoundroomShaderPalette = (next) => {
  if (!Array.isArray(next) || next.length !== 3 || !next.every((color) => Array.isArray(color) && color.length === 3 && color.every(Number.isFinite))) return;
  targetPalette = next.map((color) => color.map((channel) => Math.min(1, Math.max(0, channel))));
  if (still) { palette = targetPalette.map((color) => [...color]); draw(performance.now(), true); }
};

function createRenderer() {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;
  const shaders = [];
  let program;
  let buffer;
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexShaderSource], [gl.FRAGMENT_SHADER, fragmentShaderSource]]) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Shader unavailable');
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Shader failed');
    }
    program = gl.createProgram();
    if (!program) throw new Error('Program unavailable');
    shaders.forEach((shader) => gl.attachShader(program, shader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Program failed');
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniforms = Object.fromEntries(['resolution','time','audio','intensity','scene','pointer','paletteBase','paletteMid','paletteAccent'].map((name) => [name, gl.getUniformLocation(program, `u_${name}`)]));
    return { gl, program, buffer, shaders, uniforms };
  } catch (error) {
    shaders.forEach((shader) => gl.deleteShader(shader));
    if (program) gl.deleteProgram(program);
    if (buffer) gl.deleteBuffer(buffer);
    console.warn('Soundroom uses its static light field:', error.message);
    return null;
  }
}

function resize() {
  // Bound fill rate on high-DPI screens and phones. No postprocessing passes.
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5, 1600 / Math.max(innerWidth, innerHeight));
  canvas.width = Math.max(1, Math.round(innerWidth * ratio));
  canvas.height = Math.max(1, Math.round(innerHeight * ratio));
  draw(performance.now(), true);
}

function draw(now, force = false) {
  if (document.hidden || !renderer) return;
  const dt = Math.min((now - lastFrame) / 1000, .06);
  if (!force && now - lastFrame < 32) return;
  lastFrame = now;
  if (!still) elapsed += dt;
  const frame = visualFrame(signal, { playing, age: now - receivedAt, still });
  current = current.map((value, index) => value + ([frame.bass, frame.mid, frame.treble, frame.level][index] - value) * .2);
  if (still) current = [0, 0, 0, 0];
  palette = palette.map((color, i) => color.map((channel, j) => channel + (targetPalette[i][j] - channel) * .035));
  const { gl, uniforms: u } = renderer;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(u.resolution, canvas.width, canvas.height);
  gl.uniform1f(u.time, elapsed);
  gl.uniform4fv(u.audio, current);
  gl.uniform1f(u.intensity, Number(intensity.value) / 100);
  gl.uniform1f(u.scene, Number(scene.value));
  gl.uniform2fv(u.pointer, pointer);
  gl.uniform3fv(u.paletteBase, palette[0]);
  gl.uniform3fv(u.paletteMid, palette[1]);
  gl.uniform3fv(u.paletteAccent, palette[2]);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  // The meters report measured bands only, never procedural animation.
  ['bass','mid','treble'].forEach((band, index) => {
    document.getElementById(`signal-${band}`).style.transform = `scaleX(${Math.max(.025, current[index])})`;
  });
  document.documentElement.style.setProperty('--bass', current[0].toFixed(3));
  canvas.dataset.energy = current[3].toFixed(3);
  canvas.dataset.scene = scene.options[scene.selectedIndex].text;
  const mode = frame.mode;
  if (document.body.dataset.visualMode !== mode) {
    document.body.dataset.visualMode = mode;
    status.textContent = mode === 'reactive' ? 'Audio reactive' : mode === 'still' ? 'Still frame' : 'Ambient motion';
    status.title = mode === 'ambient' ? 'The light field moves freely while measured audio data is unavailable.' : 'Measured bass, mid and high frequencies shape the light field.';
  }
}

function loop(now) {
  raf = 0;
  draw(now);
  if (!still && !document.hidden && renderer) raf = requestAnimationFrame(loop);
}

function start() {
  cancelAnimationFrame(raf);
  raf = 0;
  lastFrame = performance.now();
  draw(lastFrame, true);
  if (!still && !document.hidden && renderer) raf = requestAnimationFrame(loop);
}

function setStill(value) {
  still = value;
  motion.setAttribute('aria-pressed', String(still));
  motion.textContent = still ? 'Resume visuals' : 'Pause visuals';
  start();
}

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin || event.source !== window.parent || window.parent === window) return;
  const message = event.data;
  if (message?.channel === 'lowkal.analysis.v1' && message.type === 'spectrum') {
    signal = readSpectrum(message.data);
    receivedAt = performance.now();
  }
  if (message?.channel === 'lowkal.audio.v1' && message.type === 'state') {
    playing = Boolean(message.state?.isPlaying);
    if (!playing) signal = readSpectrum(null);
  }
});
motion.addEventListener('click', () => setStill(!still));
scene.addEventListener('change', () => draw(performance.now(), true));
intensity.addEventListener('input', () => draw(performance.now(), true));
focus.addEventListener('click', () => {
  const active = document.body.classList.toggle('room-focus');
  focus.setAttribute('aria-pressed', String(active));
  focus.textContent = active ? 'Exit focus' : 'Focus view';
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && document.body.classList.contains('room-focus')) {
    document.body.classList.remove('room-focus');
    focus.setAttribute('aria-pressed', 'false');
    focus.textContent = 'Focus view';
    focus.focus();
  }
});
window.addEventListener('pointermove', (event) => {
  if (still || event.pointerType === 'touch') return;
  pointer[0] = event.clientX / innerWidth - .5;
  pointer[1] = .5 - event.clientY / innerHeight;
}, { passive: true });
reducedMotion.addEventListener('change', (event) => setStill(event.matches));
document.addEventListener('visibilitychange', start);
window.addEventListener('resize', resize, { passive: true });
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  cancelAnimationFrame(raf);
  renderer = null;
  document.body.dataset.renderer = 'fallback';
  delete document.body.dataset.visualMode;
  status.textContent = 'Static light field';
});
canvas.addEventListener('webglcontextrestored', () => {
  renderer = createRenderer();
  document.body.dataset.renderer = renderer ? 'webgl' : 'fallback';
  resize();
  start();
});
window.addEventListener('pagehide', () => { cancelAnimationFrame(raf); });
window.addEventListener('pageshow', start);
renderer = createRenderer();
document.body.dataset.renderer = renderer ? 'webgl' : 'fallback';
// The inline player can receive the CMS catalog before this module executes.
if (window._appInstance?.activeMix) window.applyShaderMood?.(window._appInstance.activeMix);
resize();
setStill(still);
if (!renderer) status.textContent = 'Static light field';
