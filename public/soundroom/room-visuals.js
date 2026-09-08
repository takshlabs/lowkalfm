import { readSpectrum, visualFrame } from './visual-state.js';

const canvas = document.getElementById('shader-canvas-ANIMATION_5');
const motion = document.getElementById('visual-motion');
const intensity = document.getElementById('visual-intensity');
const status = document.getElementById('visual-status');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let still = reducedMotion.matches;
let signal = readSpectrum(null);
let receivedAt = -Infinity;
let meterTimeout;
let playing = false;
let raf = 0;
let lastFrame = 0;
let elapsed = 0;
let renderer = null;
let current = [0, 0, 0, 0];
let palette = [[0.01, 0.02, 0.05], [0.30, 0.04, 0.28], [0.94, 0.14, 0.32]];
let targetPalette = palette.map((color) => [...color]);
const pointer = [.5, .5];
const vertexShaderSource = `attribute vec2 a_position;
varying vec2 v_uv;
void main() { v_uv = a_position * .5 + .5; gl_Position = vec4(a_position, 0., 1.); }`;
const fragmentShaderSource = `precision highp float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec4 u_audio;
uniform float u_intensity;
uniform float u_pointerWeight;
uniform vec2 u_pointer;
uniform vec3 u_paletteBase;
uniform vec3 u_paletteMid;
uniform vec3 u_paletteAccent;
vec3 permute(vec3 x){return mod(((x*34.0)+1.0)*x,289.0);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));
  vec2 x0=v-i+dot(i,C.xx);
  vec2 i1;
  i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz;
  x12.xy-=i1;
  i=mod(i,289.0);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m=m*m;m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0;
  vec3 h=abs(x)-0.5;
  vec3 ox=floor(x+0.5);
  vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g;
  g.x=a0.x*x0.x+h.x*x0.y;
  g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}
void main(){
  // Keep the original liquid field and palette. Audio only modulates it.
  vec2 uv=v_uv;
  vec4 audio=u_audio*u_intensity;
  vec2 flow=uv+vec2(sin(uv.y*6.28),cos(uv.x*6.28))*audio.x*0.08;
  float noise1=snoise(flow*2.0+u_time*0.1);
  float noise2=snoise(flow*(4.0+audio.y*0.5)-u_time*0.2+noise1);
  float dist=distance(uv,u_pointer);
  float mouseEffect=(1.0-smoothstep(0.0,0.5,dist))*0.5*u_pointerWeight;
  float pulse=sin(u_time*0.5)*0.5+0.5;
  float signal=noise2+mouseEffect+(pulse*0.1)*u_pointerWeight;
  signal+=audio.x*0.55+audio.y*noise1*0.2+audio.w*0.35;
  float body=smoothstep(-0.35,0.72,signal);
  float highlight=smoothstep(0.30,1.10,signal+noise1*0.18+audio.z*0.3);
  vec3 color=mix(u_paletteBase,u_paletteMid,body*0.72);
  color=mix(color,u_paletteAccent,highlight*0.52);
  float grain=fract(sin(dot(uv,vec2(12.9898,78.233)))*43758.5453);
  color+=(grain-0.5)*0.05;
  gl_FragColor=vec4(color,1.0);
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
    const uniforms = Object.fromEntries(['resolution','time','audio','intensity','pointerWeight','pointer','paletteBase','paletteMid','paletteAccent'].map((name) => [name, gl.getUniformLocation(program, `u_${name}`)]));
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
  gl.uniform1f(u.pointerWeight, frame.pointerWeight);
  gl.uniform2fv(u.pointer, pointer);
  gl.uniform3fv(u.paletteBase, palette[0]);
  gl.uniform3fv(u.paletteMid, palette[1]);
  gl.uniform3fv(u.paletteAccent, palette[2]);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  document.documentElement.style.setProperty('--bass', current[0].toFixed(3));
  canvas.dataset.energy = current[3].toFixed(3);
  canvas.dataset.pointerActive = String(frame.pointerWeight === 1);
  const mode = frame.mode;
  if (document.body.dataset.visualMode !== mode) {
    document.body.dataset.visualMode = mode;
    status.textContent = mode === 'reactive' ? 'Audio reactive' : mode === 'still' ? 'Still frame' : 'Ambient motion';
    status.title = mode === 'ambient' ? 'Original liquid motion and pointer response. No measured audio is available.' : 'Measured bass, mid and high frequencies control the liquid shader. Pointer influence is paused.';
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

function paintMeters(data) {
  // The mixer remains live when motion is paused or WebGL is unavailable.
  ['bass', 'mid', 'treble'].forEach((band) => {
    document.getElementById(`signal-${band}`).style.transform = `scaleY(${data[band]})`;
  });
}

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin || event.source !== window.parent || window.parent === window) return;
  const message = event.data;
  if (message?.channel === 'lowkal.analysis.v1' && message.type === 'spectrum') {
    signal = readSpectrum(message.data);
    receivedAt = performance.now();
    paintMeters(signal);
    clearTimeout(meterTimeout);
    meterTimeout = setTimeout(() => paintMeters(readSpectrum(null)), 1000);
  }
  if (message?.channel === 'lowkal.audio.v1' && message.type === 'state') {
    playing = Boolean(message.state?.isPlaying);
    if (!playing) {
      signal = readSpectrum(null);
      paintMeters(signal);
    }
  }
});
motion.addEventListener('click', () => setStill(!still));
intensity.addEventListener('input', () => draw(performance.now(), true));
window.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch' || !visualFrame(signal, { playing, age: performance.now() - receivedAt, still }).pointerWeight) return;
  pointer[0] = event.clientX / innerWidth;
  pointer[1] = 1 - event.clientY / innerHeight;
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
