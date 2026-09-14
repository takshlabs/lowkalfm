import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function surface(canSeek = true) {
  const source = readFileSync(new URL('../components/AudioWaveform.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const compiled = { exports: {} };
  const seeks = [];
  const refs = [];
  new Function('require', 'module', 'exports', code)((id) => {
    if (id === 'react') return { useEffect() {}, useRef(value) { const ref = { current: value }; refs.push(ref); return ref; } };
    if (id === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
    if (id.endsWith('content')) return { formatTime: String };
    if (id === 'wavesurfer.js') return {};
    throw new Error(id);
  }, compiled, compiled.exports);
  const node = compiled.exports.AudioWaveform({ currentTime: 40, duration: 100, canSeek, onSeek: value => seeks.push(value), deck: true });
  let captured;
  const target = { getBoundingClientRect: () => ({ left: 10, width: 200 }), setPointerCapture: id => { captured = id; } };
  refs[0].current = target;
  const pointer = x => ({ clientX: x, button: 0, pointerId: 7, currentTarget: target });
  return { props: node.props, seeks, pointer, captured: () => captured };
}

test('waveform dragging captures the pointer and clamps movement to track bounds', () => {
  const view = surface();
  view.props.onPointerDown(view.pointer(60));
  assert.equal(view.captured(), 7);
  view.props.onPointerMove(view.pointer(160));
  view.props.onPointerMove(view.pointer(260));
  view.props.onPointerMove(view.pointer(-10));
  assert.deepEqual(view.seeks, [25, 75, 100, 0]);
  view.props.onPointerUp();
  view.props.onPointerMove(view.pointer(100));
  assert.equal(view.seeks.length, 4);
});

test('disabled seeking and cancelled pointers cannot move playback', () => {
  const disabled = surface(false);
  disabled.props.onPointerDown(disabled.pointer(60));
  disabled.props.onPointerMove(disabled.pointer(160));
  assert.deepEqual(disabled.seeks, []);
  assert.equal(disabled.captured(), undefined);
  const view = surface();
  view.props.onPointerDown(view.pointer(60));
  view.props.onPointerCancel();
  view.props.onPointerMove(view.pointer(160));
  assert.deepEqual(view.seeks, [25]);
});

test('waveform keyboard seeking keeps fine and coarse steps', () => {
  const view = surface();
  let prevented = 0;
  const key = (key, shiftKey = false) => ({ key, shiftKey, preventDefault() { prevented++; } });
  view.props.onKeyDown(key('ArrowRight'));
  view.props.onKeyDown(key('ArrowLeft', true));
  view.props.onKeyDown(key('Home'));
  view.props.onKeyDown(key('End'));
  assert.deepEqual(view.seeks, [45, 10, 0, 100]);
  assert.equal(prevented, 4);
});
