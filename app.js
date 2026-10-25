// SPDX-License-Identifier: GPL-3.0-only
import {Game, PRESETS, radical} from './engine.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const storage = {
  get(key, fallback) {try {return JSON.parse(localStorage.getItem(`complexweeper:${key}`)) ?? fallback;} catch {return fallback;}},
  set(key, value) {try {localStorage.setItem(`complexweeper:${key}`, JSON.stringify(value));} catch { /* Play remains available without storage. */ }},
};
let mode = storage.get('mode', 'complex');
if (!['complex', 'hyper'].includes(mode)) mode = 'complex';
let difficulty = storage.get('difficulty', 'easy');
if (!Object.hasOwn(PRESETS, difficulty)) difficulty = 'easy';
let custom = {width: 12, height: 12, mines: 24};
let game, buttons = [], selectedType = 1, action = 'reveal', timer = null, startTime = 0, elapsed = 0, focusIndex = 0, toastTimeout;
let holdTimer, holdStart, suppressTouchClickUntil = 0;
const labels = () => ['', '+1', '−1', mode === 'hyper' ? '+j' : '+i', mode === 'hyper' ? '−j' : '−i'];
const formatTime = ms => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const currentBestKey = () => `${mode}:${game.width}x${game.height}:${game.mines}`;

function toast(message) {
  clearTimeout(toastTimeout);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimeout = setTimeout(() => {$('#toast').hidden = true;}, 3200);
}

function updateBest() {
  const best = storage.get(`best:${currentBestKey()}`, null);
  $('#best-time').textContent = typeof best === 'number' ? formatTime(best) : '等待你的第一次胜利';
}

function stopTimer() {
  if (timer !== null) {
    elapsed = performance.now() - startTime;
    clearInterval(timer);
    timer = null;
    $('#timer').textContent = formatTime(elapsed);
  }
}

function ensureTimer() {
  if (timer !== null || !game.started || game.over) return;
  startTime = performance.now();
  timer = setInterval(() => {$('#timer').textContent = formatTime(performance.now() - startTime);}, 250);
}

function updateMode() {
  $$('[data-mode]').forEach(button => button.setAttribute('aria-pressed', button.dataset.mode === mode));
  const hyper = mode === 'hyper', names = labels();
  $$('[data-type]').forEach(button => {button.querySelector('.type-token').textContent = names[Number(button.dataset.type)];});
  $('#positive-unit-name').textContent = hyper ? '正双曲虚雷' : '正虚雷';
  $('#negative-unit-name').textContent = hyper ? '负双曲虚雷' : '负虚雷';
  $('#positive-unit-en').textContent = hyper ? 'HYPERBOLIC +' : 'IMAGINARY +';
  $('#negative-unit-en').textContent = hyper ? 'HYPERBOLIC −' : 'IMAGINARY −';
  $('#formula').innerHTML = hyper ? 'S = √<span class="overline">a² − b²</span>' : '|z| = √<span class="overline">a² + b²</span>';
  $('#formula-description').textContent = hyper ? '相加得到 a + bj，用形式平方根表示时空间隔；负值线索带 i。' : '数字是周围八格中，所有雷相加后的模长。';
  $('.example .type-3').textContent = hyper ? '+j' : '+i';
  $('#example-answer').textContent = hyper ? '0' : '√2';
  $('#example-caption').textContent = hyper ? '1 + j 的形式模长是 0，周围却有两颗雷' : '1 + i 的模长是 √2';
  storage.set('mode', mode);
}

function setAction(next) {
  action = next;
  $$('[data-action]').forEach(button => button.setAttribute('aria-pressed', button.dataset.action === action));
  document.body.classList.toggle('marking', action === 'flag');
}

function chooseType(type) {
  selectedType = type;
  $$('[data-type]').forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.type) === type));
  setAction('flag');
}

function newGame() {
  clearTimeout(holdTimer);
  holdStart = null;
  stopTimer();
  elapsed = 0;
  game = new Game({...difficulty === 'custom' ? custom : PRESETS[difficulty], mode});
  focusIndex = 0;
  setAction('reveal');
  $('#timer').textContent = '00:00';
  $('#result').hidden = true;
  $('#toast').hidden = true;
  $('#difficulty').value = difficulty;
  $('#custom-edit').hidden = difficulty !== 'custom';
  $('#difficulty option[value="custom"]').textContent = difficulty === 'custom' ? `自定义 · ${game.width} × ${game.height}` : '自定义…';
  $('#board').style.setProperty('--cols', game.width);
  if (game.width > 9) $('#board').style.setProperty('--size', '30px');
  else $('#board').style.removeProperty('--size');
  $('#board').setAttribute('aria-label', `${game.height} 行 ${game.width} 列扫雷棋盘`);
  const fragment = document.createDocumentFragment();
  buttons = game.cells.map((_, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cell';
    button.dataset.index = index;
    button.tabIndex = index === 0 ? 0 : -1;
    fragment.append(button);
    return button;
  });
  $('#board').replaceChildren(fragment);
  $('#board-scroll').scrollLeft = 0;
  updateMode();
  render();
  updateBest();
  if (difficulty !== 'custom') storage.set('difficulty', difficulty);
}

function render() {
  const flags = game.flags, flagCount = flags.reduce((a, b) => a + b, 0), names = labels();
  for (let index = 0; index < game.cells.length; index++) {
    const cell = game.cells[index], button = buttons[index];
    let classes = ['cell'], text = '', description = '未翻开';
    if (cell.open && !cell.mine) {
      classes.push('open');
      text = cell.adjacent ? radical(cell.clue) : '';
      description = cell.adjacent ? `线索 ${text}，点击尝试展开` : '空白';
      classes.push(!cell.adjacent ? 'blank' : cell.clue === 0 ? 'clue-zero' : cell.clue < 0 ? 'clue-imaginary' : cell.clue === 1 ? 'clue-one' : cell.clue <= 8 ? 'clue-two' : 'clue-high');
      if (text.length > 2) classes.push('long-value');
    } else if (game.over && cell.mine) {
      classes.push('mine', `type-${cell.mine}`);
      text = names[cell.mine];
      description = `雷 ${text}`;
      if (index === game.boom) {classes.push('boom'); description += '，引爆';}
      if (cell.flag) {
        const correct = cell.flag === cell.mine;
        classes.push(correct ? 'correct' : 'wrong');
        text += `<span class="review-mark" aria-hidden="true">${correct ? '✓' : '×'}</span>`;
        description += `，你的标记 ${names[cell.flag]}，${correct ? '正确' : '错误'}`;
      }
    } else if (cell.flag) {
      classes.push('flagged', `type-${cell.flag}`);
      text = `<span class="flag-symbol" aria-hidden="true">⚑</span><span class="type-value">${names[cell.flag]}</span>`;
      description = `已标记 ${names[cell.flag]}`;
      if (game.over) {classes.push('wrong'); text += '<span class="review-mark" aria-hidden="true">×</span>'; description += '，此处无雷，标记错误';}
    }
    button.className = classes.join(' ');
    button.innerHTML = text;
    button.setAttribute('aria-label', `第 ${Math.floor(index / game.width) + 1} 行，第 ${index % game.width + 1} 列，${description}`);
    button.setAttribute('aria-disabled', String(game.over));
  }
  $('#remaining').textContent = String(game.mines - flagCount).padStart(3, '0');
  for (let type = 1; type <= 4; type++) $(`[data-count="${type}"]`).textContent = game.started ? game.totals[type] - flags[type] : '—';
  $('#state-text').textContent = game.over ? game.won ? '推理成功' : '触雷了' : game.started ? '推理进行中' : '准备就绪';
  $('#game-state').dataset.state = game.over ? game.won ? 'won' : 'lost' : game.started ? 'playing' : 'ready';
  const safe = game.cells.length - game.mines;
  $('#progress-count').textContent = `${game.opened} / ${safe}`;
  $('#progress-fill').style.width = `${game.opened / safe * 100}%`;
  $('#moves').textContent = `${game.moves} 步`;
  $('#board-caption').textContent = game.over ? '结局复盘：✓ 类型正确 · × 标记错误 · 格内显示实际雷型' : game.started ? '0 可能藏着抵消的雷。相信线索，也留意正负。' : '✦ 从任意一格开始，第一步总是安全的。';
}

function finish() {
  stopTimer();
  if (game.won) {
    const key = `best:${currentBestKey()}`, best = storage.get(key, null);
    if (typeof best !== 'number' || elapsed < best) storage.set(key, elapsed);
    updateBest();
  }
  $('#result-title').textContent = game.won ? '漂亮，所有安全格都找到了。' : '差一点，再推理一局。';
  $('#result-copy').textContent = `用时 ${formatTime(elapsed)} · ${game.moves} 步 · 类型标对 ${game.correctFlags} / ${game.mines} 颗雷`;
  $('#result').hidden = false;
  toast(game.won ? '恭喜！所有安全格已翻开。' : '触雷了。棋盘已显示所有实际雷型，可以复盘。');
}

function perform(index, kind = action) {
  if (game.over) return;
  let result;
  if (kind === 'cycle') game.cycleFlag(index);
  else if (kind === 'flag') game.setFlag(index, game.cells[index].flag === selectedType ? 0 : selectedType);
  else if (game.cells[index].open) result = game.expand(index);
  else result = game.reveal(index);
  if (result === 'mismatch') toast('暂时无法展开：旗帜数量或实虚组合尚不符合判据。');
  else if (result === 'expanded') toast('判据通过，已展开周围未标记格。');
  ensureTimer();
  render();
  if (game.over) finish();
}

function focusCell(index) {
  buttons[focusIndex].tabIndex = -1;
  focusIndex = index;
  buttons[index].tabIndex = 0;
}

$('#board').addEventListener('click', event => {
  const cell = event.target.closest('[data-index]');
  if (!cell || performance.now() < suppressTouchClickUntil) return;
  const index = Number(cell.dataset.index);
  focusCell(index);
  perform(index, game.cells[index].open ? 'reveal' : action);
});
$('#board').addEventListener('contextmenu', event => {
  event.preventDefault();
  const cell = event.target.closest('[data-index]');
  if (!cell || performance.now() < suppressTouchClickUntil) return;
  perform(Number(cell.dataset.index), 'cycle');
});
$('#board').addEventListener('pointerdown', event => {
  if (event.pointerType !== 'touch' || holdStart) return;
  const cell = event.target.closest('[data-index]');
  if (!cell) return;
  holdStart = {x: event.clientX, y: event.clientY, id: event.pointerId};
  holdTimer = setTimeout(() => {
    suppressTouchClickUntil = performance.now() + 900;
    perform(Number(cell.dataset.index), 'flag');
  }, 450);
});
$('#board').addEventListener('pointermove', event => {
  if (holdStart && Math.hypot(event.clientX - holdStart.x, event.clientY - holdStart.y) > 10) clearTimeout(holdTimer);
});
for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, () => {clearTimeout(holdTimer); holdStart = null;});
$('#board').addEventListener('keydown', event => {
  const cell = event.target.closest('[data-index]');
  if (!cell) return;
  const index = Number(cell.dataset.index), row = Math.floor(index / game.width), col = index % game.width;
  let next = index;
  if (event.key === 'ArrowLeft') next = row * game.width + Math.max(0, col - 1);
  else if (event.key === 'ArrowRight') next = row * game.width + Math.min(game.width - 1, col + 1);
  else if (event.key === 'ArrowUp') next = Math.max(0, row - 1) * game.width + col;
  else if (event.key === 'ArrowDown') next = Math.min(game.height - 1, row + 1) * game.width + col;
  else return;
  event.preventDefault();
  focusCell(next);
  buttons[next].focus();
});

$$('[data-action]').forEach(button => button.addEventListener('click', () => setAction(button.dataset.action)));
$$('[data-type]').forEach(button => button.addEventListener('click', () => chooseType(Number(button.dataset.type))));
$$('[data-mode]').forEach(button => button.addEventListener('click', () => {
  if (button.dataset.mode === mode) return;
  mode = button.dataset.mode;
  newGame();
  toast(mode === 'hyper' ? '已开始双曲复数模式新棋盘。' : '已开始圆复数模式新棋盘。');
}));
$('#new-game').addEventListener('click', newGame);
$('#play-again').addEventListener('click', newGame);
$('#custom-edit').addEventListener('click', () => {$('#custom-error').textContent = ''; $('#custom-dialog').showModal();});
$('#difficulty').addEventListener('change', event => {
  if (event.target.value === 'custom') {
    $('#custom-error').textContent = '';
    $('#custom-dialog').showModal();
    event.target.value = difficulty;
  } else {
    difficulty = event.target.value;
    newGame();
  }
});
$('#custom-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.target);
  const config = {width: Number(form.get('width')), height: Number(form.get('height')), mines: Number(form.get('mines'))};
  try {new Game(config);} catch {$('#custom-error').textContent = '请填写有效整数；雷数最多为宽 × 高 − 9。'; return;}
  custom = config;
  difficulty = 'custom';
  $('#custom-dialog').close();
  newGame();
});
$('#help-button').addEventListener('click', () => $('#help-dialog').showModal());
$('#start-playing').addEventListener('click', () => $('#help-dialog').close());
$$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
}));
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || document.querySelector('dialog[open]') || event.target.closest('input,select,textarea,[contenteditable="true"]')) return;
  const key = event.key.toLowerCase();
  if (key === 'd') setAction('reveal');
  else if (key === 'f') setAction('flag');
  else if (/^[1-4]$/.test(key)) chooseType(Number(key));
  else if (key === 'r') newGame();
});

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#theme-button').setAttribute('aria-label', theme === 'dark' ? '切换浅色主题' : '切换深色主题');
  $('meta[name="theme-color"]').content = theme === 'dark' ? '#18211d' : '#f5f5f0';
}
const preferredTheme = storage.get('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
applyTheme(preferredTheme === 'dark' ? 'dark' : 'light');
$('#theme-button').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(theme);
  storage.set('theme', theme);
});
newGame();
