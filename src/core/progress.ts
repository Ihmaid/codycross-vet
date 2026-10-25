import { Mode, Stage } from './types';

/** Mesma chave do protótipo V5: quem já jogou mantém o progresso. */
export const PROGRESS_KEY = 'virologia-em-jogo-v2-progress';

export interface ProgressState {
  /** "faseId:modo" -> concluída */
  done: Record<string, boolean>;
  /** Respostas digitadas nas palavras-cruzadas, por fase. */
  drafts: Record<string, string[]>;
  /** Índices das palavras encontradas no caça-palavras, por fase. */
  huntFound: Record<string, number[]>;
  hints: Record<string, number>;
  mistakes: Record<string, number>;
  /** Melhor pontuação por "faseId:modo". */
  best: Record<string, number>;
  /** Modo exploração: todas as fases liberadas. */
  explore: boolean;
}

export const emptyProgress = (): ProgressState => ({
  done: {},
  drafts: {},
  huntFound: {},
  hints: {},
  mistakes: {},
  best: {},
  explore: false,
});

export const progressKey = (stage: Stage, mode: Mode): string => `${stage.id}:${mode}`;

/** 100 pontos, -8 por dica, -3 por conferência com erro; mínimo 25. */
export function awardPoints(hints: number, mistakes: number): number {
  return Math.max(25, 100 - hints * 8 - mistakes * 3);
}

/** Estrelas da comemoração a partir da pontuação da modalidade. */
export function starsFor(points: number): number {
  if (points >= 90) return 3;
  if (points >= 60) return 2;
  return 1;
}

/** O que usamos do localStorage (permite trocar por um armazenamento em memória nos testes). */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

/** Progresso do jogo salvo no navegador. */
export class Progress {
  constructor(
    public state: ProgressState,
    private readonly stages: Stage[],
    private readonly storage: KeyValueStore | null = safeLocalStorage()
  ) {}

  static load(stages: Stage[], storage: KeyValueStore | null = safeLocalStorage()): Progress {
    let state = emptyProgress();
    try {
      const saved = JSON.parse(storage?.getItem(PROGRESS_KEY) ?? 'null');
      if (saved && saved.done && saved.drafts) state = { ...emptyProgress(), ...saved };
    } catch {
      /* dados corrompidos: começa do zero */
    }
    return new Progress(state, stages, storage);
  }

  save(): void {
    try {
      this.storage?.setItem(PROGRESS_KEY, JSON.stringify(this.state));
    } catch {
      /* armazenamento indisponível (ex.: modo privado) */
    }
  }

  isDone(stage: Stage, mode: Mode): boolean {
    return !!this.state.done[progressKey(stage, mode)];
  }

  /** Uma fase conta como concluída quando qualquer uma das modalidades foi concluída. */
  isStageDone(stage: Stage): boolean {
    return this.isDone(stage, 'cross') || this.isDone(stage, 'hunt');
  }

  modesDone(stage: Stage): number {
    return Number(this.isDone(stage, 'cross')) + Number(this.isDone(stage, 'hunt'));
  }

  /** Fase liberada: modo exploração, primeira fase, ou todas as anteriores concluídas. */
  isAvailable(index: number): boolean {
    return this.state.explore || index === 0 || this.stages.slice(0, index).every((s) => this.isStageDone(s));
  }

  finishedCount(): number {
    return this.stages.filter((s) => this.isStageDone(s)).length;
  }

  totalPoints(): number {
    return Object.values(this.state.best).reduce((a, b) => a + b, 0);
  }

  stagePoints(stage: Stage): number {
    return (['cross', 'hunt'] as const).reduce((sum, m) => sum + (this.state.best[progressKey(stage, m)] ?? 0), 0);
  }

  /** Próxima fase a jogar: a primeira liberada e não concluída (ou a última). */
  nextStageIndex(): number {
    const next = this.stages.findIndex((s, i) => this.isAvailable(i) && !this.isStageDone(s));
    return next >= 0 ? next : this.stages.length - 1;
  }

  addHint(stage: Stage, mode: Mode): void {
    const k = progressKey(stage, mode);
    this.state.hints[k] = (this.state.hints[k] ?? 0) + 1;
    this.save();
  }

  addMistake(stage: Stage, mode: Mode): void {
    const k = progressKey(stage, mode);
    this.state.mistakes[k] = (this.state.mistakes[k] ?? 0) + 1;
    this.save();
  }

  /** Registra a conclusão; devolve os pontos desta vez e se já tinha sido concluída antes. */
  finish(stage: Stage, mode: Mode): { award: number; best: number; wasDone: boolean } {
    const k = progressKey(stage, mode);
    const wasDone = this.isDone(stage, mode);
    const award = awardPoints(this.state.hints[k] ?? 0, this.state.mistakes[k] ?? 0);
    this.state.done[k] = true;
    this.state.best[k] = Math.max(this.state.best[k] ?? 0, award);
    this.save();
    return { award, best: this.state.best[k], wasDone };
  }

  /** Limpa as respostas de uma modalidade, preservando recorde e desbloqueio. */
  restart(stage: Stage, mode: Mode): void {
    const k = progressKey(stage, mode);
    if (mode === 'cross') this.state.drafts[stage.id] = [];
    else this.state.huntFound[stage.id] = [];
    this.state.hints[k] = 0;
    this.state.mistakes[k] = 0;
    this.save();
  }
}

export function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
