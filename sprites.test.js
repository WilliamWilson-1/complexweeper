import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ATLAS, clueSprite, mineSprite, counterText, counterSprites} from './sprites.js';

test('atlas dimensions match the actual PNG', () => {
  const png = readFileSync(new URL('./atlas.png', import.meta.url));
  assert.equal(png.readUInt32BE(16), ATLAS.width);
  assert.equal(png.readUInt32BE(20), ATLAS.height);
});

test('every original atlas slot stays inside the source image', () => {
  const source = JSON.parse(readFileSync(new URL('./atlas.json', import.meta.url), 'utf8'));
  assert.equal(Object.keys(ATLAS.slots).length, source.slots.length);
  for (const slot of source.slots) {
    assert.deepEqual(ATLAS.slots[slot.name], [slot.x, slot.y, slot.w, slot.h]);
    assert.ok(slot.x >= 0 && slot.y >= 0 && slot.x + slot.w <= ATLAS.width && slot.y + slot.h <= ATLAS.height);
  }
});

test('every mathematically reachable clue in either mode has a pixel sprite', () => {
  for (let a = -8; a <= 8; a++) for (let b = -8; b <= 8; b++) {
    if (Math.abs(a) + Math.abs(b) > 8) continue;
    for (const value of [a * a + b * b, a * a - b * b]) assert.ok(clueSprite(value), `Missing clue sprite for ${value}`);
  }
  assert.equal(clueSprite(0), 'num_0');
  assert.equal(clueSprite(2), 'num_2');
  assert.equal(clueSprite(-3), 'hnum_3_i');
});

test('all four mine types have flag, mine, hit, correct and wrong sprites in both modes', () => {
  for (const mode of ['complex', 'hyper']) for (let type = 1; type <= 4; type++) {
    for (const kind of ['flag', 'mine', 'boom', 'right', 'wrong']) assert.ok(ATLAS.slots[mineSprite(kind, type, mode)]);
  }
});

test('LED values include negative counts and large custom boards', () => {
  for (const [n, expected] of [[0,'000'],[10,'010'],[999,'999'],[1000,'1000'],[-1,'-01'],[-1200,'-1200']]) {
    assert.equal(counterText(n), expected);
    assert.equal((counterSprites(n).match(/class="sprite /g) || []).length, expected.length);
  }
});

test('all normal, pressed, thinking, lost and won faces exist', () => {
  for (const face of ['face_normal','face_down','face_scan','face_dead','face_win']) assert.ok(ATLAS.slots[face]);
});
