"use client";

import { useEffect, useRef } from "react";

const vertexShaderSource = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision mediump float;

  uniform vec2 u_resolution;
  uniform vec2 u_pointer;
  uniform float u_time;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p = p * 2.03 + 11.7;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 p = uv - 0.5;
    p.x *= u_resolution.x / u_resolution.y;

    float drift = u_time * 0.025;
    float field = fbm(vec2(p.x * 1.15 - drift, p.y * 1.55 + drift * 0.7));
    float ribbon = sin((p.x + field * 0.42) * 7.0 - u_time * 0.16) * 0.5 + 0.5;
    ribbon *= smoothstep(0.72, 0.02, abs(p.y + (field - 0.5) * 0.34));

    vec2 pointer = u_pointer - 0.5;
    pointer.x *= u_resolution.x / u_resolution.y;
    float halo = exp(-3.2 * length(p - pointer));
    float grain = noise(gl_FragCoord.xy * 0.17 + u_time * 0.4);

    vec3 night = vec3(0.063, 0.043, 0.086);
    vec3 red = vec3(0.714, 0.184, 0.157);
    vec3 signal = vec3(0.784, 1.0, 0.141);
    vec3 color = mix(night, red, smoothstep(0.40, 0.76, field));
    color = mix(color, signal, smoothstep(0.72, 0.98, ribbon + halo * 0.18) * 0.28);

    float edgeFade = smoothstep(0.92, 0.22, length(p * vec2(0.76, 1.0)));
    float alpha = (0.025 + field * 0.07 + ribbon * 0.055 + halo * 0.025) * edgeFade;
    alpha *= 0.9 + grain * 0.1;
    gl_FragColor = vec4(color, alpha);
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function ArchiveAtmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false
    });
    if (!gl) return;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    gl.useProgram(program);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolution = gl.getUniformLocation(program, "u_resolution");
    const pointerLocation = gl.getUniformLocation(program, "u_pointer");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const pointer = { x: 0.66, y: 0.48 };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true;
    let frame = 0;
    let start = performance.now();

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    };

    const render = (now: number) => {
      resize();
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform2f(pointerLocation, pointer.x, 1 - pointer.y);
      gl.uniform1f(timeLocation, reduceMotion ? 0 : (now - start) / 1000);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!reduceMotion && visible) frame = window.requestAnimationFrame(render);
    };

    const handlePointer = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      pointer.x += (Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)) - pointer.x) * 0.18;
      pointer.y += (Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)) - pointer.y) * 0.18;
    };

    const observer = new IntersectionObserver(([entry]) => {
      const nextVisible = entry.isIntersecting;
      if (nextVisible && !visible && !reduceMotion) {
        visible = true;
        start = performance.now();
        frame = window.requestAnimationFrame(render);
      } else {
        visible = nextVisible;
        if (!visible) window.cancelAnimationFrame(frame);
      }
    });

    observer.observe(canvas);
    window.addEventListener("pointermove", handlePointer, { passive: true });
    render(performance.now());

    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", handlePointer);
      window.cancelAnimationFrame(frame);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return <canvas ref={canvasRef} className="archive-atmosphere" aria-hidden="true" />;
}
