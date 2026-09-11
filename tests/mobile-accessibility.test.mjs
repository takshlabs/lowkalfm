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

test('mobile PWA notices and playback controls stay fully on screen', async () => {
  const source = await read('app/pwa-audio.css');
  assert.match(source, /\.lowkal-player\s*\{[\s\S]*?overflow:\s*visible;[\s\S]*?transform:\s*none;/);
  assert.match(source, /grid-template-rows:\s*auto;/);
  assert.match(source, /\.lowkal-player-art\s*\{[\s\S]*?grid-row:\s*auto;[\s\S]*?grid-column:\s*auto;/);
  assert.match(source, /\.lowkal-player-timeline\s*\{[\s\S]*?grid-row:\s*auto;[\s\S]*?grid-column:\s*auto;/);
  assert.match(source, /\.pwa-status\s*\{\s*bottom:\s*calc\(202px \+ var\(--safe-bottom\)\)/);
  assert.doesNotMatch(source, /var\(--chalk\)/);
});

test('phone pages reserve enough space for the expanded persistent player', async () => {
  const source = await read('app/pwa-audio.css');
  const phoneRule = source.match(/@media \(max-width: 760px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(phoneRule, /body\s*\{\s*padding-bottom:\s*calc\(206px \+ var\(--safe-bottom\)\);/);
});
