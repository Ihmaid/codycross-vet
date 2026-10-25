import { emptyProgress, KeyValueStore, ProgressState, safeLocalStorage } from './progress';
import { Stage } from './types';

/** Mesma chave do protótipo V5. */
export const NOTEBOOK_KEY = 'virologia-em-jogo-v5-caderno';

export interface NotebookState {
  favorites: Record<string, boolean>;
  reviewed: Record<string, boolean>;
  notes: Record<string, string>;
}

export const emptyNotebook = (): NotebookState => ({ favorites: {}, reviewed: {}, notes: {} });

/** Caderno de estudos (favoritos, revisados e anotações), salvo no navegador. */
export class Notebook {
  constructor(
    public state: NotebookState,
    private readonly storage: KeyValueStore | null = safeLocalStorage()
  ) {}

  static load(storage: KeyValueStore | null = safeLocalStorage()): Notebook {
    let state = emptyNotebook();
    try {
      const saved = JSON.parse(storage?.getItem(NOTEBOOK_KEY) ?? 'null');
      if (saved && typeof saved === 'object') state = { ...emptyNotebook(), ...saved };
    } catch {
      /* dados corrompidos: caderno vazio */
    }
    return new Notebook(state, storage);
  }

  save(): void {
    try {
      this.storage?.setItem(NOTEBOOK_KEY, JSON.stringify(this.state));
    } catch {
      /* armazenamento indisponível */
    }
  }

  isFavorite(id: string): boolean {
    return !!this.state.favorites[id];
  }

  isReviewed(id: string): boolean {
    return !!this.state.reviewed[id];
  }

  note(id: string): string {
    return this.state.notes[id] ?? '';
  }

  hasNote(id: string): boolean {
    return this.note(id).trim().length > 0;
  }

  toggleFavorite(id: string): void {
    this.state.favorites[id] = !this.state.favorites[id];
    this.save();
  }

  toggleReviewed(id: string): void {
    this.state.reviewed[id] = !this.state.reviewed[id];
    this.save();
  }

  setNote(id: string, text: string): void {
    this.state.notes[id] = text;
    this.save();
  }

  count(stages: Stage[], kind: 'favorites' | 'reviewed'): number {
    return stages.filter((s) => !!this.state[kind][s.id]).length;
  }
}

/** Arquivo de backup (compatível com os exportados pelo protótipo V5). */
export interface Backup {
  app: 'Virologia em Jogo';
  format: 1;
  exportedAt: string;
  game: ProgressState;
  caderno: NotebookState;
}

export const MAX_BACKUP_BYTES = 2_000_000;

export function createBackup(game: ProgressState, caderno: NotebookState, now = new Date()): Backup {
  return { app: 'Virologia em Jogo', format: 1, exportedAt: now.toISOString(), game, caderno };
}

/** Lê e valida um backup; lança erro com mensagem amigável se não for compatível. */
export function parseBackup(text: string): { game: ProgressState; caderno: NotebookState } {
  let payload: Partial<Backup>;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('o arquivo não é um JSON válido.');
  }
  if (
    payload?.app !== 'Virologia em Jogo' ||
    payload.format !== 1 ||
    !payload.game ||
    !payload.caderno ||
    typeof payload.game.done !== 'object' ||
    typeof payload.caderno.notes !== 'object'
  ) {
    throw new Error('esse arquivo não é um backup do Virologia em Jogo.');
  }
  return {
    game: { ...emptyProgress(), ...payload.game },
    caderno: { ...emptyNotebook(), ...payload.caderno },
  };
}
