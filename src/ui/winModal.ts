import { $ } from './dom';
import { countUp } from './effects';

export interface WinOptions {
  title: string;
  message: string;
  points: number;
  /** Já tinha concluído antes: mostra o recorde em vez dos pontos ganhos agora. */
  recordOnly: boolean;
  /** Frase sobre a fase liberada, se houver. */
  unlocked?: string;
  nextLabel: string;
  /** null = o outro jogo já foi feito (o botão some). */
  otherLabel: string | null;
  onNext: () => void;
  onOther: () => void;
  onMap: () => void;
}

/** Fase concluída: um carimbo "Concluída" na página, com os pontos. */
export class WinModal {
  private readonly el = $('win-modal');
  private lastFocus: Element | null = null;

  constructor() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) this.hide();
    });
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.hide();
    });
  }

  isOpen(): boolean {
    return !this.el.hidden;
  }

  show(o: WinOptions): void {
    this.lastFocus = document.activeElement;
    $('win-title').textContent = o.title;
    $('win-message').textContent = o.unlocked ? `${o.message} ${o.unlocked}` : o.message;

    const earned = $('win-earned');
    if (o.recordOnly) {
      earned.textContent = `Seu recorde neste jogo: ${o.points} pontos`;
    } else {
      earned.textContent = '';
      const value = document.createElement('strong');
      earned.append('+', value, ' pontos');
      countUp(value, o.points, String);
    }

    const bind = (id: string, label: string | null, action: () => void) => {
      const btn = $<HTMLButtonElement>(id);
      btn.hidden = label === null && id === 'modal-other';
      if (label) btn.textContent = label;
      btn.onclick = () => {
        this.hide();
        action();
      };
    };
    bind('modal-next', o.nextLabel, o.onNext);
    bind('modal-other', o.otherLabel, o.onOther);
    bind('modal-map', null, o.onMap);

    this.el.hidden = false;
    $('modal-next').focus();
  }

  hide(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    (this.lastFocus as HTMLElement | null)?.focus?.({ preventScroll: true });
  }
}
