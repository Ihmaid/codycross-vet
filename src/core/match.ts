import { stageIndex, STAGES } from './content';
import { buildCrossword, Crossword, Direction } from './crossword';
import { normalize } from './text';
import { Mode } from './types';
import { buildWordSearch, WordSearch } from './wordSearch';

// Regras da competição (salas com até 30 jogadores, como no Gartic).
// Arquivo usado pelo site e pelo servidor: os dois seguem as mesmas regras.

export const MAX_PLAYERS = 30;
export const MAX_ROUNDS = 5;
export const NAME_MAX = 16;
export const ROUND_SECONDS = [120, 180, 300, 600] as const;
/** Pontos por palavra certa. */
export const WORD_POINTS = 100;
/** Pontos descontados por dica. */
export const HINT_COST = 25;
/** Tempo entre o fim de uma rodada e o começo da próxima. */
export const BREAK_SECONDS = 15;
/** Sorteia a fase da rodada. */
export const RANDOM_STAGE = '*';

export interface MatchSettings {
  mode: Mode;
  /** Uma fase por rodada (id da fase ou RANDOM_STAGE). */
  stages: string[];
  seconds: number;
  hints: boolean;
}

export const DEFAULT_SETTINGS: MatchSettings = { mode: 'cross', stages: [STAGES[0].id], seconds: 300, hints: true };

/** Confere as configurações recebidas; devolve uma cópia limpa ou null se não forem válidas. */
export function cleanSettings(value: unknown): MatchSettings | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (v.mode !== 'cross' && v.mode !== 'hunt') return null;
  if (!Array.isArray(v.stages) || v.stages.length < 1 || v.stages.length > MAX_ROUNDS) return null;
  if (!v.stages.every((id) => id === RANDOM_STAGE || (typeof id === 'string' && stageIndex(id) >= 0))) return null;
  if (!ROUND_SECONDS.includes(v.seconds as (typeof ROUND_SECONDS)[number])) return null;
  if (typeof v.hints !== 'boolean') return null;
  return { mode: v.mode, stages: [...(v.stages as string[])], seconds: v.seconds as number, hints: v.hints };
}

/** Escolhe as fases sorteadas sem repetir as já escolhidas na partida. */
export function resolveStages(stages: string[], random: () => number = Math.random): string[] {
  const used = new Set(stages.filter((id) => id !== RANDOM_STAGE));
  return stages.map((id) => {
    if (id !== RANDOM_STAGE) return id;
    const pool = STAGES.map((s) => s.id).filter((s) => !used.has(s));
    const pick = pool[Math.floor(random() * pool.length)];
    used.add(pick);
    return pick;
  });
}

/** Apelido: sem espaços extras nem caracteres de controle, até NAME_MAX letras. */
export function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value
    .replace(/[\p{C}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name || [...name].length > NAME_MAX) return null;
  return name;
}

// ---------------------------------------------------------------- grades enviadas aos jogadores (sem respostas)

export interface CrossPuzzle {
  kind: 'cross';
  width: number;
  height: number;
  cells: { x: number; y: number; belongs: number[] }[];
  entries: { index: number; x: number; y: number; d: Direction; length: number; clue: string }[];
}

export interface HuntPuzzle {
  kind: 'hunt';
  n: number;
  grid: string[];
  words: { index: number; length: number; clue: string }[];
}

export type Puzzle = CrossPuzzle | HuntPuzzle;

/** Rodada montada no servidor: a grade pública e as respostas, que ficam só com ele. */
export interface RoundPuzzle {
  stageId: string;
  puzzle: Puzzle;
  cross?: Crossword;
  hunt?: WordSearch;
  /** Quantidade de palavras da rodada. */
  total: number;
}

/** Mesmas grades do jogo individual (mesmo algoritmo e mesma semente). */
export function buildRound(stageId: string, mode: Mode): RoundPuzzle {
  const index = stageIndex(stageId);
  const stage = STAGES[index];
  if (mode === 'cross') {
    const cross = buildCrossword(stage.cross);
    return {
      stageId,
      cross,
      total: cross.entries.length,
      puzzle: {
        kind: 'cross',
        width: cross.width,
        height: cross.height,
        cells: cross.cells.map(({ x, y, belongs }) => ({ x, y, belongs })),
        entries: cross.entries.map(({ index: i, x, y, d, word, clue }) => ({ index: i, x, y, d, length: word.length, clue })),
      },
    };
  }
  const hunt = buildWordSearch(stage.hunt, index + 15);
  return {
    stageId,
    hunt,
    total: hunt.placed.length,
    puzzle: {
      kind: 'hunt',
      n: hunt.n,
      grid: hunt.grid,
      words: hunt.placed.map((w, i) => ({ index: i, length: w.word.length, clue: w.clue })),
    },
  };
}

/** A resposta digitada está certa? (sem acentos, maiúsculas ou espaços) */
export const isRightAnswer = (word: string, typed: unknown): boolean => normalize(typed) === word;

/**
 * Dica das palavras-cruzadas: parte do começo já certo (digitado ou revelado antes) e revela mais uma letra.
 */
export function hintPrefix(word: string, typed: unknown, revealed = 0): string {
  const t = normalize(typed);
  let k = 0;
  while (k < word.length && t[k] === word[k]) k++;
  return word.slice(0, Math.min(word.length, Math.max(revealed, k) + 1));
}

/** Bônus por terminar antes do tempo: 1 ponto por segundo que sobrou. */
export const finishBonus = (remainingMs: number): number => Math.max(0, Math.ceil(remainingMs / 1000));

/** Pontos da rodada: palavras + bônus - dicas, nunca abaixo de zero. */
export const roundScore = (words: number, bonus: number, hints: number): number =>
  Math.max(0, words * WORD_POINTS + bonus - hints * HINT_COST);

export interface Rankable {
  id: string;
  name: string;
  score: number;
  /** Quando chegou à pontuação atual (desempate: quem chegou antes). */
  scoredAt: number;
  joinedAt: number;
}

/** Classificação: mais pontos; no empate, quem chegou primeiro à pontuação. */
export function rank<T extends Rankable>(players: T[]): T[] {
  return [...players].sort(
    (a, b) => b.score - a.score || a.scoredAt - b.scoredAt || a.joinedAt - b.joinedAt || a.name.localeCompare(b.name, 'pt-BR')
  );
}

/** Código da sala: 5 letras e números sem os que se confundem (0/O, 1/I/L). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;
export const cleanCode = (value: unknown): string =>
  String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_LENGTH);
