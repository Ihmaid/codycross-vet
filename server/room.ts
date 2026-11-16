import { randomBytes } from 'crypto';
import { linePath, matchSelection } from '../src/core/wordSearch';
import {
  BREAK_SECONDS,
  buildRound,
  cleanSettings,
  DEFAULT_SETTINGS,
  finishBonus,
  hintPrefix,
  isRightAnswer,
  MatchSettings,
  MAX_PLAYERS,
  rank,
  resolveStages,
  roundScore,
  RoundPuzzle,
} from '../src/core/match';
import { AnswerResult, HintResult, PlayerView, RoomStatus, RoomView, RoundView, SelectResult } from '../src/core/protocol';

/** Erro que vira mensagem para o jogador. */
export class RoomError extends Error {}

/** Quanto tempo um jogador desconectado continua na sala de espera. */
export const LOBBY_GRACE_MS = 60_000;
/** Depois desse tempo sem conexão, o organizador passa a vez para outro jogador. */
export const HOST_GRACE_MS = 20_000;

interface PlayerRound {
  solved: Map<number, string>;
  found: Map<number, number[]>;
  revealed: Map<number, string>;
  hintCells: Map<number, number>;
  hints: number;
  bonus: number;
  finishedAt: number | null;
}

export interface Player {
  id: string;
  token: string;
  name: string;
  online: boolean;
  joinedAt: number;
  disconnectedAt: number | null;
  /** Pontos das rodadas já encerradas. */
  banked: number;
  scoredAt: number;
  round: PlayerRound;
}

export interface RoomHooks {
  /** Algo mudou: reenviar o estado da sala. */
  changed(): void;
  /** Rodada nova: enviar a grade a todos. */
  roundStarted(): void;
  /** Jogador removido pelo organizador. */
  kicked(playerId: string): void;
}

const emptyRound = (): PlayerRound => ({
  solved: new Map(),
  found: new Map(),
  revealed: new Map(),
  hintCells: new Map(),
  hints: 0,
  bonus: 0,
  finishedAt: null,
});

const id = (bytes: number) => randomBytes(bytes).toString('hex');

export class Room {
  status: RoomStatus = 'lobby';
  settings: MatchSettings = { ...DEFAULT_SETTINGS, stages: [...DEFAULT_SETTINGS.stages] };
  /** Em ordem de chegada. */
  readonly players = new Map<string, Player>();
  hostId = '';
  /** Momento em que a sala ficou sem ninguém conectado (para apagá-la depois). */
  emptySince: number | null = null;

  private stages: string[] = [];
  private roundNumber = 0;
  private current: RoundPuzzle | null = null;
  private endsAt = 0;
  private nextAt: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly code: string,
    private readonly hooks: RoomHooks,
    private readonly now: () => number = Date.now
  ) {}

  // ---------------------------------------------------------------- jogadores

  addPlayer(name: string): Player {
    if (this.players.size >= MAX_PLAYERS) throw new RoomError(`A sala está cheia (${MAX_PLAYERS} jogadores).`);
    const key = name.toLocaleLowerCase('pt-BR');
    if ([...this.players.values()].some((p) => p.name.toLocaleLowerCase('pt-BR') === key)) {
      throw new RoomError('Já tem alguém com esse apelido na sala. Escolha outro.');
    }
    const t = this.now();
    const player: Player = {
      id: id(6),
      token: id(16),
      name,
      online: true,
      joinedAt: t,
      disconnectedAt: null,
      banked: 0,
      scoredAt: t,
      round: emptyRound(),
    };
    this.players.set(player.id, player);
    if (!this.hostId) this.hostId = player.id;
    this.emptySince = null;
    this.hooks.changed();
    return player;
  }

  byToken(token: string): Player | undefined {
    return [...this.players.values()].find((p) => p.token === token);
  }

  setOnline(playerId: string, online: boolean): void {
    const p = this.players.get(playerId);
    if (!p || p.online === online) return;
    p.online = online;
    p.disconnectedAt = online ? null : this.now();
    this.emptySince = this.onlineCount() ? null : this.now();
    this.hooks.changed();
    // Quem sai no meio da rodada não segura o fim antecipado dos outros.
    if (!online) this.endIfAllFinished();
  }

  remove(playerId: string): void {
    if (!this.players.delete(playerId)) return;
    if (this.hostId === playerId) this.passHost();
    this.emptySince = this.onlineCount() ? null : (this.emptySince ?? this.now());
    if (!this.players.size) this.clearTimer();
    this.hooks.changed();
    this.endIfAllFinished();
  }

  kick(byId: string, playerId: string): void {
    this.requireHost(byId);
    if (playerId === byId) throw new RoomError('Você não pode se remover. Use "Sair da sala".');
    if (!this.players.has(playerId)) throw new RoomError('Esse jogador já saiu.');
    this.remove(playerId);
    this.hooks.kicked(playerId);
  }

  /** Chamado periodicamente: tira da sala de espera quem caiu e passa a vez do organizador ausente. */
  sweep(): void {
    const t = this.now();
    let changed = false;
    if (this.status === 'lobby') {
      for (const p of [...this.players.values()]) {
        if (!p.online && p.disconnectedAt !== null && t - p.disconnectedAt >= LOBBY_GRACE_MS) {
          this.players.delete(p.id);
          if (this.hostId === p.id) this.passHost();
          changed = true;
        }
      }
    }
    const host = this.players.get(this.hostId);
    if (host && !host.online && host.disconnectedAt !== null && t - host.disconnectedAt >= HOST_GRACE_MS) {
      const before = this.hostId;
      this.passHost();
      changed ||= before !== this.hostId;
    }
    if (changed) this.hooks.changed();
  }

  get isEmpty(): boolean {
    return this.players.size === 0;
  }

  onlineCount(): number {
    return [...this.players.values()].filter((p) => p.online).length;
  }

  /** O organizador passa para o próximo jogador conectado, por ordem de chegada. */
  private passHost(): void {
    const others = [...this.players.values()].filter((p) => p.id !== this.hostId);
    const next = others.find((p) => p.online) ?? (this.players.has(this.hostId) ? undefined : others[0]);
    if (next) this.hostId = next.id;
    else if (!this.players.has(this.hostId)) this.hostId = '';
  }

  private requireHost(playerId: string): void {
    if (playerId !== this.hostId) throw new RoomError('Só o organizador da sala pode fazer isso.');
  }

  // ---------------------------------------------------------------- partida

  updateSettings(byId: string, value: unknown): void {
    this.requireHost(byId);
    if (this.status !== 'lobby') throw new RoomError('As regras só mudam antes da partida começar.');
    const settings = cleanSettings(value);
    if (!settings) throw new RoomError('Configuração inválida.');
    this.settings = settings;
    this.hooks.changed();
  }

  start(byId: string): void {
    this.requireHost(byId);
    if (this.status !== 'lobby') throw new RoomError('A partida já começou.');
    this.stages = resolveStages(this.settings.stages);
    for (const p of this.players.values()) {
      p.banked = 0;
      p.scoredAt = this.now();
    }
    this.startRound(1);
  }

  /** O organizador pula o intervalo entre as rodadas. */
  next(byId: string): void {
    this.requireHost(byId);
    if (this.status !== 'results') throw new RoomError('Não há próxima rodada agora.');
    this.startRound(this.roundNumber + 1);
  }

  /** Depois do pódio: volta para a sala de espera com os mesmos jogadores. */
  restart(byId: string): void {
    this.requireHost(byId);
    if (this.status !== 'final') throw new RoomError('A partida ainda não terminou.');
    this.clearTimer();
    this.status = 'lobby';
    this.roundNumber = 0;
    this.current = null;
    this.nextAt = null;
    for (const p of this.players.values()) {
      p.banked = 0;
      p.round = emptyRound();
    }
    this.hooks.changed();
  }

  private startRound(n: number): void {
    this.clearTimer();
    this.roundNumber = n;
    this.current = buildRound(this.stages[n - 1], this.settings.mode);
    this.status = 'playing';
    this.endsAt = this.now() + this.settings.seconds * 1000;
    this.nextAt = null;
    for (const p of this.players.values()) p.round = emptyRound();
    this.timer = setTimeout(() => this.endRound(), this.settings.seconds * 1000);
    this.hooks.roundStarted();
    this.hooks.changed();
  }

  private endRound(): void {
    if (this.status !== 'playing') return;
    this.clearTimer();
    for (const p of this.players.values()) p.banked += this.scoreOf(p);
    if (this.roundNumber >= this.stages.length) {
      this.status = 'final';
    } else {
      this.status = 'results';
      this.nextAt = this.now() + BREAK_SECONDS * 1000;
      this.timer = setTimeout(() => this.startRound(this.roundNumber + 1), BREAK_SECONDS * 1000);
    }
    this.hooks.changed();
  }

  /** Todos os jogadores conectados terminaram: a rodada acaba antes do tempo. */
  private endIfAllFinished(): void {
    if (this.status !== 'playing') return;
    const online = [...this.players.values()].filter((p) => p.online);
    if (online.length && online.every((p) => p.round.finishedAt !== null)) this.endRound();
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Encerra os cronômetros (sala apagada). */
  dispose(): void {
    this.clearTimer();
  }

  /** Pontos da rodada atual (ou da última, no intervalo e no pódio). */
  private scoreOf(p: Player): number {
    return roundScore(p.round.solved.size, p.round.bonus, p.round.hints);
  }

  private total(p: Player): number {
    return p.banked + (this.status === 'playing' ? this.scoreOf(p) : 0);
  }

  private playing(playerId: string, round: number): { player: Player; current: RoundPuzzle } {
    const player = this.players.get(playerId);
    if (!player) throw new RoomError('Você não está nesta sala.');
    if (this.status !== 'playing' || !this.current || round !== this.roundNumber) {
      throw new RoomError('Essa rodada já terminou.');
    }
    if (player.round.finishedAt !== null) throw new RoomError('Você já terminou esta rodada.');
    return { player, current: this.current };
  }

  private scored(p: Player): void {
    p.scoredAt = this.now();
    if (p.round.solved.size === this.current!.total) {
      p.round.finishedAt = this.now();
      p.round.bonus = finishBonus(this.endsAt - this.now());
    }
    this.hooks.changed();
    this.endIfAllFinished();
  }

  answer(playerId: string, round: number, index: number, answer: string): AnswerResult {
    const { player, current } = this.playing(playerId, round);
    const entry = current.cross?.entries[index];
    if (!entry) throw new RoomError('Pista inválida.');
    if (player.round.solved.has(index)) return { correct: true, word: entry.word };
    if (!isRightAnswer(entry.word, answer)) return { correct: false };
    player.round.solved.set(index, entry.word);
    this.scored(player);
    return { correct: true, word: entry.word };
  }

  select(playerId: string, round: number, from: number, to: number): SelectResult {
    const { player, current } = this.playing(playerId, round);
    const ws = current.hunt;
    if (!ws) throw new RoomError('Esta rodada não é de caça-palavras.');
    const size = ws.n * ws.n;
    if (from < 0 || to < 0 || from >= size || to >= size) throw new RoomError('Seleção inválida.');
    const index = matchSelection(ws, linePath(from, to, ws.n), [...player.round.found.keys()]);
    if (index < 0) return { index };
    const w = ws.placed[index];
    player.round.found.set(index, w.coords);
    player.round.solved.set(index, w.word);
    this.scored(player);
    return { index, word: w.word, coords: w.coords };
  }

  hint(playerId: string, round: number, index: number, typed?: string): HintResult {
    const { player, current } = this.playing(playerId, round);
    if (!this.settings.hints) throw new RoomError('As dicas estão desligadas nesta partida.');
    if (player.round.solved.has(index)) throw new RoomError('Essa você já acertou.');
    const r = player.round;
    let result: HintResult;
    if (current.cross) {
      const entry = current.cross.entries[index];
      if (!entry) throw new RoomError('Pista inválida.');
      const prefix = hintPrefix(entry.word, typed, r.revealed.get(index)?.length ?? 0);
      r.revealed.set(index, prefix);
      result = { index, prefix };
    } else {
      const w = current.hunt!.placed[index];
      if (!w) throw new RoomError('Pista inválida.');
      r.hintCells.set(index, w.coords[0]);
      result = { index, cell: w.coords[0] };
    }
    r.hints++;
    player.scoredAt = this.now();
    this.hooks.changed();
    return result;
  }

  // ---------------------------------------------------------------- o que cada jogador recebe

  roundView(): RoundView | null {
    return this.current && this.status !== 'lobby'
      ? { number: this.roundNumber, stageId: this.current.stageId, puzzle: this.current.puzzle }
      : null;
  }

  view(playerId: string): RoomView {
    const list = [...this.players.values()];
    const ranked =
      this.status === 'lobby'
        ? list
        : rank(list.map((p) => ({ ...p, score: this.total(p) }))).map((r) => this.players.get(r.id)!);
    const players: PlayerView[] = ranked.map((p) => ({
      id: p.id,
      name: p.name,
      host: p.id === this.hostId,
      online: p.online,
      score: this.total(p),
      roundScore: this.status === 'lobby' ? 0 : this.scoreOf(p),
      solved: p.round.solved.size,
      finished: p.round.finishedAt !== null,
    }));
    const me = this.players.get(playerId);
    const r = me?.round ?? emptyRound();
    const c = this.current;
    const showSolution = c && (this.status === 'results' || this.status === 'final');
    return {
      code: this.code,
      status: this.status,
      settings: this.settings,
      players,
      round:
        c && this.status !== 'lobby'
          ? {
              number: this.roundNumber,
              total: this.stages.length,
              stageId: c.stageId,
              words: c.total,
              endsAt: this.endsAt,
              nextAt: this.nextAt,
            }
          : null,
      solution: showSolution
        ? c.cross
          ? { kind: 'cross', words: c.cross.entries.map((e) => e.word) }
          : { kind: 'hunt', words: c.hunt!.placed.map((w) => w.word), coords: c.hunt!.placed.map((w) => w.coords) }
        : null,
      serverNow: this.now(),
      you: {
        id: playerId,
        solved: Object.fromEntries(r.solved),
        found: Object.fromEntries(r.found),
        revealed: Object.fromEntries(r.revealed),
        hintCells: Object.fromEntries(r.hintCells),
        hints: r.hints,
      },
    };
  }
}
