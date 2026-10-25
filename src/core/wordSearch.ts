import { normalize } from './text';
import { QuestionPair } from './types';

export interface PlacedWord {
  word: string;
  clue: string;
  /** Índices das casas (linha * n + coluna), da primeira à última letra. */
  coords: number[];
}

export interface WordSearch {
  n: number;
  grid: string[];
  /** Na mesma ordem das pistas. */
  placed: PlacedWord[];
}

const SIZE = 16;
const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [-1, 1], [-1, 0], [0, -1], [-1, -1], [1, -1]];
/** Letras de preenchimento com mais vogais, para o quadro parecer português. */
const FILLER = 'AAAAEEEEIIIIOOOOUUUUBCDFGHLMNPRSTV';

/** Gerador pseudoaleatório (xorshift) com semente: o mesmo nível gera sempre o mesmo quadro. */
export function seededRandom(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

/** Monta o caça-palavras 16x16 (mesmo algoritmo do protótipo V5). */
export function buildWordSearch(list: QuestionPair[], seed: number): WordSearch {
  const n = SIZE;
  const rng = seededRandom(seed * 137 + 512);
  const grid: string[] = Array(n * n).fill('');
  const placed: PlacedWord[] = [];
  const byLength = [...list].sort((a, b) => normalize(b[0]).length - normalize(a[0]).length);

  for (const [answer, clue] of byLength) {
    const word = normalize(answer);
    const options: { coords: number[]; crosses: number; rand: number }[] = [];
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        for (const [dx, dy] of DIRECTIONS) {
          const ex = x + (word.length - 1) * dx;
          const ey = y + (word.length - 1) * dy;
          if (ex < 0 || ex >= n || ey < 0 || ey >= n) continue;
          const coords: number[] = [];
          let crosses = 0;
          let ok = true;
          for (let i = 0; i < word.length; i++) {
            const c = (y + i * dy) * n + (x + i * dx);
            if (grid[c] && grid[c] !== word[i]) {
              ok = false;
              break;
            }
            if (grid[c]) crosses++;
            coords.push(c);
          }
          if (ok) options.push({ coords, crosses, rand: rng() });
        }
      }
    }
    if (!options.length) throw new Error(`Caça-palavras sem espaço para ${word}`);
    options.sort((a, b) => b.crosses - a.crosses || a.rand - b.rand);
    const best = options[0];
    best.coords.forEach((pos, j) => (grid[pos] = word[j]));
    placed.push({ word, clue, coords: best.coords });
  }

  const filled = grid.map((ch) => ch || FILLER[Math.floor(rng() * FILLER.length)]);
  return { n, grid: filled, placed: list.map(([answer]) => placed.find((p) => p.word === normalize(answer))!) };
}

/** Casas em linha reta de a até b (horizontal, vertical ou diagonal); [] se não for reta. */
export function linePath(a: number, b: number, n: number): number[] {
  const ax = a % n, ay = Math.floor(a / n), bx = b % n, by = Math.floor(b / n);
  if (a === b) return [a];
  if (ax !== bx && ay !== by && Math.abs(ax - bx) !== Math.abs(ay - by)) return [];
  const dx = Math.sign(bx - ax), dy = Math.sign(by - ay);
  const distance = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
  return Array.from({ length: distance + 1 }, (_, i) => (ay + i * dy) * n + ax + i * dx);
}

/** Índice da palavra (ainda não encontrada) que corresponde à seleção, em qualquer sentido; -1 se nenhuma. */
export function matchSelection(puzzle: WordSearch, selection: number[], found: number[]): number {
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
  return puzzle.placed.findIndex(
    (w, i) => !found.includes(i) && (same(w.coords, selection) || same([...w.coords].reverse(), selection))
  );
}
