import test from 'node:test';
import assert from 'node:assert/strict';
import {Game, PRESETS, radical} from './engine.js';

function fixture(mines, mode = 'complex') {
  const game = new Game({width: 5, height: 5, mines: Math.max(1, mines.length), mode, seed: 123});
  for (const [index, type] of mines) game.cells[index].mine = type;
  game.started = true;
  game.computeClues();
  return game;
}

test('first click and every neighbor are safe; exact mine totals for all presets', () => {
  for (const preset of Object.values(PRESETS)) for (const mode of ['complex', 'hyper']) for (let seed = 1; seed <= 20; seed++) {
    const game = new Game({...preset, mode, seed});
    const start = seed % 2 ? 0 : Math.floor(game.cells.length / 2);
    game.reveal(start);
    assert.ok(game.started);
    assert.ok(game.cells[start].open);
    assert.equal(game.cells[start].adjacent, 0);
    for (const i of [start, ...game.neighbors(start)]) assert.equal(game.cells[i].mine, 0);
    assert.equal(game.totals.reduce((a, b) => a + b, 0), preset.mines);
    assert.equal(game.cells.filter(c => c.mine).length, preset.mines);
  }
});

test('seed and first click reproduce the same board', () => {
  const a = new Game({seed: 456}), b = new Game({seed: 456});
  a.reveal(40); b.reveal(40);
  assert.deepEqual(a.cells, b.cells);
});

test('neighbors do not wrap across edges', () => {
  const game = new Game();
  assert.deepEqual(game.neighbors(0), [1, 9, 10]);
  assert.deepEqual(game.neighbors(8), [7, 16, 17]);
  assert.equal(game.neighbors(40).length, 8);
});

test('clues use vector sums; radicals simplify exactly', () => {
  const game = fixture([[11, 1], [13, 3]]);
  assert.equal(game.cells[12].clue, 2);
  for (const [n, expected] of [[0, '0'], [1, '1'], [2, '√2'], [8, '2√2'], [18, '3√2'], [40, '2√10'], [64, '8'], [-3, '√3i'], [-1, 'i']]) assert.equal(radical(n), expected);
});

test('a cancelling zero is revealed without flooding', () => {
  const game = fixture([[11, 1], [13, 2]]);
  assert.equal(game.cells[12].clue, 0);
  assert.equal(game.cells[12].adjacent, 2);
  game.reveal(12);
  assert.equal(game.opened, 1);
  assert.equal(game.cells[7].open, false);
});

test('hyperbolic null and imaginary clues', () => {
  const nullGame = fixture([[11, 1], [13, 3]], 'hyper');
  assert.equal(nullGame.cells[12].clue, 0);
  nullGame.reveal(12);
  assert.equal(nullGame.opened, 1);
  const negativeGame = fixture([[11, 3], [13, 3]], 'hyper');
  assert.equal(negativeGame.cells[12].clue, -4);
  assert.equal(radical(negativeGame.cells[12].clue), '2i');
});

test('flags protect cells from cascade and block first reveal', () => {
  const game = new Game({seed: 7});
  game.setFlag(40, 1);
  assert.equal(game.reveal(40), 'ignored');
  assert.equal(game.started, false);
  game.reveal(0);
  assert.equal(game.cells[40].open, false);
  assert.equal(game.flags[1], 1);
});

test('right click flag cycle and direct removal', () => {
  const game = new Game();
  for (const expected of [1, 2, 3, 4, 0]) {game.cycleFlag(1); assert.equal(game.cells[1].flag, expected);}
  assert.equal(game.setFlag(1, 5), false);
  assert.equal(game.setFlag(1, 1.5), false);
  assert.equal(game.setFlag(1, 3), true);
  assert.equal(game.setFlag(1, 0), true);
});

test('circular expansion accepts axis exchange and ignores signs', () => {
  const game = fixture([[6, 1], [7, 2], [8, 3]]);
  game.reveal(12);
  game.setFlag(6, 3); game.setFlag(7, 4); game.setFlag(8, 2);
  assert.equal(game.canExpand(12), true);
  assert.equal(game.expand(12), 'expanded');
  assert.equal(game.over, false);
});

test('circular expansion rejects incorrect real/imaginary proportions', () => {
  const game = fixture([[6, 1], [7, 2], [8, 3]]);
  game.reveal(12);
  game.setFlag(6, 1); game.setFlag(7, 1); game.setFlag(8, 1);
  assert.equal(game.expand(12), 'mismatch');
});

test('hyperbolic expansion checks net absolute components, not just clue or counts', () => {
  const game = fixture([[6, 1], [7, 2], [8, 3], [11, 4]], 'hyper');
  game.reveal(12);
  for (const i of [6, 7, 8, 11]) game.setFlag(i, 1);
  assert.equal(game.canExpand(12), false);
  game.setFlag(6, 1); game.setFlag(7, 2); game.setFlag(8, 1); game.setFlag(11, 2);
  assert.equal(game.canExpand(12), true);
  // Same clue 0 and four flags, but net (2,2) differs from truth (0,0).
  game.setFlag(6, 1); game.setFlag(7, 1); game.setFlag(8, 3); game.setFlag(11, 3);
  assert.equal(game.canExpand(12), false);
});

test('passing expansion with wrong flag positions can still lose', () => {
  const game = fixture([[11, 1], [13, 3]]);
  game.reveal(12);
  game.setFlag(6, 1); game.setFlag(7, 3);
  assert.equal(game.canExpand(12), true);
  assert.equal(game.expand(12), 'lost');
  assert.equal(game.over, true);
  assert.equal(game.won, false);
});

test('win requires all safe cells and does not require flags', () => {
  const game = fixture([[0, 4]]);
  game.reveal(24);
  for (let i = 1; i < 25; i++) game.reveal(i);
  assert.equal(game.won, true);
  assert.equal(game.opened, 24);
  assert.equal(game.correctFlags, 0);
  assert.equal(game.reveal(0), 'ignored');
  assert.equal(game.setFlag(0, 4), false);
});

test('direct mine reveal loses and freezes input', () => {
  const game = fixture([[0, 4]]);
  assert.equal(game.reveal(0), 'lost');
  assert.equal(game.boom, 0);
  assert.equal(game.cycleFlag(1), false);
  assert.equal(game.reveal(2), 'ignored');
});

test('custom board constraints preserve the 3×3 safe opening', () => {
  for (const config of [{width: 4}, {height: 31}, {width: 5, height: 5, mines: 17}, {mines: 0}, {width: 9.5}, {mode: 'invalid'}]) assert.throws(() => new Game(config), RangeError);
  const game = new Game({width: 5, height: 5, mines: 16, seed: 10});
  game.reveal(12);
  assert.equal(game.totals.reduce((a, b) => a + b), 16);
  assert.equal(game.won, true);
});

test('random boards finish with consistent counts when safe cells are revealed', () => {
  for (const mode of ['complex', 'hyper']) for (let seed = 0; seed < 100; seed++) {
    const game = new Game({mode, seed});
    game.reveal(seed % 81);
    for (let i = 0; i < game.cells.length; i++) if (!game.cells[i].mine) game.reveal(i);
    assert.equal(game.won, true);
    assert.equal(game.opened, 71);
    assert.equal(game.cells.filter(c => c.open).length, 71);
  }
});
