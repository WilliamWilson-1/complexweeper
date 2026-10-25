// Browser port of the rules in Yueqing-Chen/complexweeper-A-minesweeper-game.
// Original author: 青月晓 (Yueqing-Chen). SPDX-License-Identifier: GPL-3.0-only
export const VECTORS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
export const PRESETS = {
  easy: {width: 9, height: 9, mines: 10},
  medium: {width: 16, height: 16, mines: 40},
  hard: {width: 30, height: 16, mines: 99},
};

// Every sum reachable with n unit mines, including additional cancelling pairs.
const POSSIBLE_SUMS = Array.from({length: 9}, (_, n) => {
  const sums = [];
  for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
    const distance = Math.abs(a) + Math.abs(b);
    if (distance <= n && (n - distance) % 2 === 0) sums.push([a, b]);
  }
  return sums;
});

export function randomSeed() {
  return globalThis.crypto?.getRandomValues(new Uint32Array(1))[0] ?? (Math.random() * 2 ** 32) >>> 0;
}

export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ state >>> 15, state | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function radical(value) {
  const n = Math.abs(value);
  if (!n) return '0';
  let factor = 1;
  for (let k = 2; k * k <= n; k++) if (n % (k * k) === 0) factor = k;
  const rest = n / factor ** 2;
  const text = rest === 1 ? String(factor) : `${factor === 1 ? '' : factor}√${rest}`;
  return value < 0 ? (text === '1' ? 'i' : text + 'i') : text;
}

export class Game {
  constructor({width = 9, height = 9, mines = 10, mode = 'complex', seed = randomSeed()} = {}) {
    if (![width, height, mines].every(Number.isInteger) || width < 5 || width > 40 || height < 5 || height > 30 || mines < 1 || mines > width * height - 9) throw new RangeError('棋盘或雷数超出范围');
    if (!['complex', 'hyper'].includes(mode)) throw new RangeError('未知模式');
    Object.assign(this, {width, height, mines, mode, seed: seed >>> 0, started: false, over: false, won: false, boom: -1, moves: 0, opened: 0});
    this.cells = Array.from({length: width * height}, () => ({mine: 0, flag: 0, open: false, clue: 0, adjacent: 0}));
    this.totals = [0, 0, 0, 0, 0];
  }

  neighbors(index) {
    const row = Math.floor(index / this.width), col = index % this.width, result = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = row + dr, c = col + dc;
      if (r >= 0 && r < this.height && c >= 0 && c < this.width) result.push(r * this.width + c);
    }
    return result;
  }

  sums(index, flags = false) {
    return this.neighbors(index).reduce(([a, b], i) => {
      const [x, y] = VECTORS[flags ? this.cells[i].flag : this.cells[i].mine];
      return [a + x, b + y];
    }, [0, 0]);
  }

  valueOf(a, b) {
    return a * a + (this.mode === 'hyper' ? -1 : 1) * b * b;
  }

  flagClue(index) {
    const [a, b] = this.sums(index, true);
    const count = this.neighbors(index).filter(i => this.cells[i].flag).length;
    const value = this.valueOf(a, b);
    return {count, value, matches: count > 0 && value === this.cells[index].clue};
  }

  computeClues() {
    this.totals.fill(0);
    for (let i = 0; i < this.cells.length; i++) {
      const cell = this.cells[i], [a, b] = this.sums(i);
      cell.adjacent = this.neighbors(i).filter(j => this.cells[j].mine).length;
      cell.clue = a * a + (this.mode === 'hyper' ? -1 : 1) * b * b;
      if (cell.mine) this.totals[cell.mine]++;
    }
  }

  generate(index) {
    const rng = mulberry32(this.seed), safe = new Set([index, ...this.neighbors(index)]);
    const pool = this.cells.map((_, i) => i).filter(i => !safe.has(i));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (const i of pool.slice(0, this.mines)) this.cells[i].mine = 1 + Math.floor(rng() * 4);
    this.computeClues();
    this.started = true;
  }

  cascade(indices) {
    const stack = [...indices], queued = new Set(stack);
    while (stack.length) {
      const i = stack.pop(), cell = this.cells[i];
      if (cell.open || cell.flag || cell.mine) continue;
      cell.open = true;
      this.opened++;
      // A numeric zero can hide cancelling mines. Only truly blank cells flood.
      if (!cell.adjacent) for (const j of this.neighbors(i)) if (!queued.has(j)) {
        queued.add(j);
        stack.push(j);
      }
    }
  }

  checkWin() {
    if (this.opened === this.cells.length - this.mines) this.over = this.won = true;
  }

  reveal(index) {
    const cell = this.cells[index];
    if (!cell || this.over || cell.open || cell.flag) return 'ignored';
    if (!this.started) this.generate(index);
    this.moves++;
    if (cell.mine) {
      cell.open = true;
      this.over = true;
      this.boom = index;
      return 'lost';
    }
    this.cascade([index]);
    this.checkWin();
    return this.won ? 'won' : 'revealed';
  }

  setFlag(index, type) {
    const cell = this.cells[index];
    if (!cell || this.over || cell.open || !Number.isInteger(type) || type < 0 || type > 4 || cell.flag === type) return false;
    cell.flag = type;
    this.moves++;
    return true;
  }

  cycleFlag(index) {
    const cell = this.cells[index];
    return cell ? this.setFlag(index, (cell.flag + 1) % 5) : false;
  }

  canExpand(index) {
    const neighbors = this.neighbors(index);
    const truth = neighbors.filter(i => this.cells[i].mine);
    const flags = neighbors.filter(i => this.cells[i].flag);
    if (truth.length !== flags.length) return false;
    if (this.mode === 'hyper') {
      const [a, b] = this.sums(index), [x, y] = this.sums(index, true);
      return Math.abs(a) === Math.abs(x) && Math.abs(b) === Math.abs(y);
    }
    const real = truth.filter(i => this.cells[i].mine <= 2).length;
    const flagReal = flags.filter(i => this.cells[i].flag <= 2).length;
    return flagReal === real || flagReal === truth.length - real;
  }

  expand(index) {
    const cell = this.cells[index];
    if (!cell?.open || cell.mine || this.over) return 'ignored';
    const hidden = this.neighbors(index).filter(i => !this.cells[i].open && !this.cells[i].flag);
    if (!hidden.length) return 'ignored';
    if (!this.canExpand(index)) return 'mismatch';
    this.moves++;
    const mine = hidden.find(i => this.cells[i].mine);
    if (mine !== undefined) {
      this.over = true;
      this.boom = mine;
      this.cells[mine].open = true;
      return 'lost';
    }
    this.cascade(hidden);
    this.checkWin();
    return this.won ? 'won' : 'expanded';
  }

  get flags() {
    return this.cells.reduce((counts, c) => { if (c.flag) counts[c.flag]++; return counts; }, [0, 0, 0, 0, 0]);
  }

  get correctFlags() {
    return this.cells.filter(c => c.mine && c.flag === c.mine).length;
  }

  reviewFlags() {
    // Exact truth and clue-compatible combinations are separate achievements.
    // Alternate types earn credit only with a completely marked, revealed clue.
    // Other revealed clues must also remain possible, even when partly marked.
    const related = this.cells.map(() => []);
    for (let index = 0; index < this.cells.length; index++) {
      const cell = this.cells[index];
      if (!cell.open || cell.mine || !cell.adjacent) continue;
      const neighbors = this.neighbors(index);
      const mines = neighbors.filter(i => this.cells[i].mine);
      const wrongPosition = neighbors.some(i => this.cells[i].flag && !this.cells[i].mine);
      const missing = mines.filter(i => !this.cells[i].flag).length;
      const [a, b] = this.sums(index, true);
      const possible = !wrongPosition && POSSIBLE_SUMS[missing].some(([x, y]) => this.valueOf(a + x, b + y) === cell.clue);
      const judgment = {index, possible, complete: !wrongPosition && missing === 0};
      for (const i of mines) related[i].push(judgment);
    }
    const summary = {cells: [], exact: 0, compatible: 0, unverified: 0, wrong: 0};
    summary.cells = this.cells.map((cell, index) => {
      if (!cell.flag) return null;
      let status;
      const evidence = related[index];
      const supporting = evidence.filter(clue => clue.complete && clue.possible);
      if (!cell.mine) status = 'wrong';
      else if (cell.mine === cell.flag) status = 'exact';
      else if (evidence.some(clue => !clue.possible)) status = 'wrong';
      else if (supporting.length) status = 'compatible';
      else status = 'unverified';
      summary[status]++;
      return {status, clues: supporting.map(clue => clue.index)};
    });
    return summary;
  }
}
