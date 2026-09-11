import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('shared navigation provides a keyboard skip target', async () => {
  const header = await read('components/SiteHeader.tsx');
  assert.match(header, /className="skip-link"/);
  assert.match(header, /href="#main-content"/);
});

test('public routes expose the shared main-content target', async () => {
  for (const path of ['app/page.tsx', 'app/listen/page.tsx', 'app/listen/archive/page.tsx', 'app/read/page.tsx', 'app/go-out/page.tsx']) {
    const source = await read(path);
    assert.match(source, /<main[^>]*id="main-content"/, `${path} must expose the skip target`);
  }
});

test('transmission genres use valid list semantics', async () => {
  const source = await read('components/HomeTransmissionDeck.tsx');
  assert.match(source, /className="transmission-tags" role="list" aria-label="Genres"/);
  assert.match(source, /<span role="listitem"/);
});

test('Soundroom click surfaces are keyboard-native controls', async () => {
  const source = await read('public/soundroom/index.html');
  assert.match(source, /<button[^>]*id="header-logo"/);
  assert.match(source, /<button[^>]*id="mini-player-info-click"/);
  assert.match(source, /document\.createElement\('button'\)/);
  assert.match(source, /node\.type = 'button'/);
  assert.match(source, /node\.setAttribute\('aria-label'/);
});

test('Soundroom mobile chrome uses safe areas and touch-sized controls', async () => {
  const source = await read('public/soundroom/room.css');
  assert.match(source, /safe-area-inset-left/);
  assert.match(source, /safe-area-inset-right/);
  assert.match(source, /min-height:\s*44px/);
  assert.match(source, /min-width:\s*44px/);
  assert.match(source, /button:focus-visible/);
  assert.match(source, /#modal-settings\s*\{[\s\S]*?safe-area-inset-right/);
  assert.match(source, /@media \(max-width: 760px\)[\s\S]*?#modal-settings\s*\{[\s\S]*?safe-area-inset-left/);
});

test('Soundroom keeps the production mobile control geometry', async () => {
  const source = await read('public/soundroom/room.css');
  assert.match(source, /#main-scrubber, #main-volume-slider\s*\{[\s\S]*?min-height:\s*28px/);
  assert.match(source, /#btn-main-shuffle,[\s\S]*?width:\s*40px;[\s\S]*?min-width:\s*40px/);
  assert.match(source, /#mini-youtube-video,[\s\S]*?width:\s*42px[^\n]*height:\s*42px[^\n]*min-width:\s*42px/);
  assert.match(source, /@media \(max-width: 380px\)[\s\S]*?#btn-main-shuffle, #btn-main-repeat \{ display: none; \}/);
});

test('PWA additions do not override the production player or header geometry', async () => {
  const source = await read('app/pwa-audio.css');
  assert.doesNotMatch(source, /\.lowkal-player(?:[\s.{:#-])/);
  assert.doesNotMatch(source, /\.site-header\s*\{/);
  assert.doesNotMatch(source, /\.brand-lockup|\.header-nav/);
});

test('PWA lifecycle is headless and leaves installation to browser chrome', async () => {
  const source = await read('components/PwaLifecycle.tsx');
  assert.doesNotMatch(source, /preventDefault\(\)/);
  assert.doesNotMatch(source, /pwa-status/);
  assert.doesNotMatch(source, /Install Lowkal|Add to Home Screen/);
  assert.match(source, /serviceWorker\.register/);
  assert.match(source, /hasSharedPlaybackActivity/);
});
