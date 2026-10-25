import { $, html, setHtml } from './dom';
import { countUp, launchConfetti } from './effects';

export interface WinOptions {
  title: string;
  message: string;
  points: number;
  pointsLabel: string;
  stars: number;
  /** Nome da fase liberada por esta conquista. */
  unlocked?: string;
  otherLabel: string;
  nextLabel: string;
  onOther: () => void;
  onNext: () => void;
  onMap: () => void;
}

/** Pop-up "Desafio concluído" com estrelas, pontos e confete. */
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
    $('win-message').textContent = o.message;
    setHtml(
      $('win-stars'),
      html`${[0, 1, 2].map((i) => html`<span class="star ${i < o.stars ? 'is-on' : ''}" style="--i:${i}">★</span>`)}`
    );
    $('win-stars').setAttribute('aria-label', `${o.stars} de 3 estrelas`);

    const earned = $('win-earned');
    setHtml(
      earned,
      html`<small>${o.pointsLabel}</small><span id="win-points">0</span> pontos${
        o.unlocked ? html`<em class="unlocked">🔓 Nova fase liberada: ${o.unlocked}</em>` : ''
      }`
    );
    countUp($('win-points'), o.points, (n) => (o.pointsLabel.startsWith('Recorde') ? String(n) : `+${n}`));

    const bind = (id: string, label: string | null, action: () => void) => {
      const btn = $<HTMLButtonElement>(id);
      if (label) btn.textContent = label;
      btn.onclick = () => {
        this.hide();
        action();
      };
    };
    bind('modal-other', o.otherLabel, o.onOther);
    bind('modal-next', o.nextLabel, o.onNext);
    bind('modal-map', null, o.onMap);

    this.el.hidden = false;
    launchConfetti(this.el);
    $('modal-next').focus();
  }

  hide(): void {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.el.querySelector('.confetti')?.remove();
    (this.lastFocus as HTMLElement | null)?.focus?.({ preventScroll: true });
  }
}
