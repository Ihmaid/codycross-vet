import { MatchSettings, Puzzle } from './match';

// Mensagens trocadas entre o site e o servidor da competição (Socket.IO).

export type RoomStatus = 'lobby' | 'playing' | 'results' | 'final';

export interface PlayerView {
  id: string;
  name: string;
  host: boolean;
  online: boolean;
  /** Total da partida. */
  score: number;
  /** Pontos da rodada atual (ou da última). */
  roundScore: number;
  /** Palavras encontradas na rodada. */
  solved: number;
  finished: boolean;
}

/** O que só o próprio jogador vê: o que já resolveu (para voltar à partida depois de cair a internet). */
export interface YourProgress {
  id: string;
  /** Palavras-cruzadas: índice -> palavra certa. Caça-palavras: índice -> palavra encontrada. */
  solved: Record<number, string>;
  /** Caça-palavras: casas das palavras encontradas. */
  found: Record<number, number[]>;
  /** Palavras-cruzadas: começo revelado pelas dicas. */
  revealed: Record<number, string>;
  /** Caça-palavras: primeira casa revelada pela dica. */
  hintCells: Record<number, number>;
  hints: number;
}

/** Respostas da rodada, mostradas quando ela termina. */
export type Solution = { kind: 'cross'; words: string[] } | { kind: 'hunt'; words: string[]; coords: number[][] };

export interface RoomView {
  code: string;
  status: RoomStatus;
  settings: MatchSettings;
  /** Na sala de espera, por ordem de chegada; durante a partida, pela classificação. */
  players: PlayerView[];
  round: {
    number: number;
    total: number;
    stageId: string;
    words: number;
    endsAt: number;
    /** Começo automático da próxima rodada (no intervalo). */
    nextAt: number | null;
  } | null;
  solution: Solution | null;
  /** Hora do servidor, para o cronômetro de todos marcar o mesmo tempo. */
  serverNow: number;
  you: YourProgress;
}

export interface RoundView {
  number: number;
  stageId: string;
  puzzle: Puzzle;
}

/** Resposta de toda ação: ok ou uma mensagem de erro para mostrar ao jogador. */
export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface Joined {
  code: string;
  playerId: string;
  /** Guardado no aparelho para voltar à sala se a conexão cair. */
  token: string;
}

export interface AnswerResult {
  correct: boolean;
  word?: string;
}

export interface SelectResult {
  index: number;
  word?: string;
  coords?: number[];
}

export interface HintResult {
  index: number;
  prefix?: string;
  cell?: number;
}

/** Eventos que o site envia (com resposta). */
export interface ClientEvents {
  create: (p: { name: string }, ack: (r: Ack<Joined>) => void) => void;
  join: (p: { code: string; name: string }, ack: (r: Ack<Joined>) => void) => void;
  resume: (p: { code: string; token: string }, ack: (r: Ack<Joined>) => void) => void;
  settings: (p: { settings: MatchSettings }, ack: (r: Ack) => void) => void;
  start: (p: object, ack: (r: Ack) => void) => void;
  answer: (p: { round: number; index: number; answer: string }, ack: (r: Ack<AnswerResult>) => void) => void;
  select: (p: { round: number; from: number; to: number }, ack: (r: Ack<SelectResult>) => void) => void;
  hint: (p: { round: number; index: number; typed?: string }, ack: (r: Ack<HintResult>) => void) => void;
  next: (p: object, ack: (r: Ack) => void) => void;
  restart: (p: object, ack: (r: Ack) => void) => void;
  kick: (p: { playerId: string }, ack: (r: Ack) => void) => void;
  leave: (p: object, ack: (r: Ack) => void) => void;
}

/** Eventos que o servidor envia. */
export interface ServerEvents {
  state: (view: RoomView) => void;
  round: (round: RoundView) => void;
  /** Removido pelo organizador. */
  kicked: () => void;
  /** Sala encerrada (vazia ou antiga demais). */
  closed: () => void;
}
