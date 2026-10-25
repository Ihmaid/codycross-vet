import { normalize } from './text';
import { QuestionPair } from './types';

export type Direction = 'H' | 'V';

export interface CrossCell {
  x: number;
  y: number;
  ch: string;
  /** Índices das palavras que passam por esta casa. */
  belongs: number[];
}

export interface CrossEntry {
  index: number;
  word: string;
  clue: string;
  x: number;
  y: number;
  d: Direction;
}

export interface Crossword {
  width: number;
  height: number;
  cells: CrossCell[];
  entries: CrossEntry[];
}

type Placement = { x: number; y: number; d: Direction; score: number };
type MapCell = { x: number; y: number; ch: string; dirs: Set<Direction> };

/**
 * Monta palavras-cruzadas livres: começa pela palavra mais longa e encaixa as demais
 * onde cruzam mais letras ocupando menos área. Mesmo algoritmo do protótipo V5,
 * para que as grades sejam idênticas às aprovadas pela equipe.
 */
export function buildCrossword(list: QuestionPair[]): Crossword {
  const words = list.map(([answer, clue], index) => ({ word: normalize(answer), clue, index }));
  const map = new Map<string, MapCell>();
  const key = (x: number, y: number) => `${x},${y}`;
  const placed: (Omit<CrossEntry, 'clue'>)[] = [];
  let minX = 0, maxX = 0, minY = 0, maxY = 0;

  function tryPlace(word: string, x: number, y: number, d: Direction): Placement | null {
    const dx = d === 'H' ? 1 : 0;
    const dy = d === 'V' ? 1 : 0;
    // Não pode encostar em outra palavra antes do início nem depois do fim.
    if (map.get(key(x - dx, y - dy)) || map.get(key(x + dx * word.length, y + dy * word.length))) return null;

    let hits = 0;
    for (let i = 0; i < word.length; i++) {
      const px = x + i * dx;
      const py = y + i * dy;
      const existing = map.get(key(px, py));
      if (existing) {
        if (existing.ch !== word[i] || existing.dirs.has(d)) return null;
        hits++;
      } else {
        // Casas novas não podem ficar lado a lado com letras de outras palavras.
        const sides = d === 'H' ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
        for (const [ox, oy] of sides) if (map.has(key(px + ox, py + oy))) return null;
      }
    }
    if (map.size && hits === 0) return null;

    const nx = Math.min(minX, x), xx = Math.max(maxX, x + dx * (word.length - 1));
    const ny = Math.min(minY, y), yy = Math.max(maxY, y + dy * (word.length - 1));
    const area = (xx - nx + 1) * (yy - ny + 1);
    return { x, y, d, score: hits * 130 - area * 0.1 - Math.abs(x) * 0.15 - Math.abs(y) * 0.15 };
  }

  function apply(word: string, p: { x: number; y: number; d: Direction }, index: number): void {
    const dx = p.d === 'H' ? 1 : 0;
    const dy = p.d === 'V' ? 1 : 0;
    for (let i = 0; i < word.length; i++) {
      const x = p.x + i * dx;
      const y = p.y + i * dy;
      const k = key(x, y);
      if (!map.has(k)) map.set(k, { x, y, ch: word[i], dirs: new Set() });
      map.get(k)!.dirs.add(p.d);
    }
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x + dx * (word.length - 1));
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y + dy * (word.length - 1));
    placed.push({ index, word, x: p.x, y: p.y, d: p.d });
  }

  const remaining = [...words].sort((a, b) => b.word.length - a.word.length);
  const first = remaining.shift()!;
  apply(first.word, { x: 0, y: 0, d: 'H' }, first.index);

  while (remaining.length) {
    let best: Placement | null = null;
    let chosen = -1;
    for (let z = 0; z < remaining.length; z++) {
      const entry = remaining[z];
      for (const cell of map.values()) {
        for (let k = 0; k < entry.word.length; k++) {
          if (entry.word[k] !== cell.ch) continue;
          for (const d of ['H', 'V'] as const) {
            if (cell.dirs.has(d)) continue;
            const p = tryPlace(entry.word, cell.x - (d === 'H' ? k : 0), cell.y - (d === 'V' ? k : 0), d);
            if (p && (!best || p.score > best.score)) {
              best = p;
              chosen = z;
            }
          }
        }
      }
    }
    if (!best) throw new Error(`Não foi possível cruzar todas as palavras: ${remaining.map((e) => e.word).join(', ')}`);
    const entry = remaining.splice(chosen, 1)[0];
    apply(entry.word, best, entry.index);
  }

  const entries: CrossEntry[] = placed
    .map((p) => ({ ...p, x: p.x - minX, y: p.y - minY, clue: words[p.index].clue }))
    .sort((a, b) => a.index - b.index);
  const cells: CrossCell[] = [...map.values()].map((c) => {
    const x = c.x - minX;
    const y = c.y - minY;
    return { x, y, ch: c.ch, belongs: entries.filter((e) => covers(e, x, y)).map((e) => e.index) };
  });

  return { width: maxX - minX + 1, height: maxY - minY + 1, cells, entries };
}

/** A palavra passa pela casa (x, y)? */
export function covers(e: Pick<CrossEntry, 'x' | 'y' | 'd' | 'word'>, x: number, y: number): boolean {
  return e.d === 'H'
    ? y === e.y && x >= e.x && x < e.x + e.word.length
    : x === e.x && y >= e.y && y < e.y + e.word.length;
}

/** Posição (0..n-1) da casa dentro da palavra. */
export function positionIn(e: Pick<CrossEntry, 'x' | 'y' | 'd'>, x: number, y: number): number {
  return e.d === 'H' ? x - e.x : y - e.y;
}
