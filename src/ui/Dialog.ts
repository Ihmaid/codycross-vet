import { launchConfetti } from './effects';

export type DialogAction = { label: string; variant: 'primary' | 'secondary'; onClick: () => void };

export type DialogOptions = {
  icon: string;
  title: string;
  message?: string;
  /** 1 a 3 estrelas; omitido = sem estrelas. */
  stars?: number;
  stats?: [label: string, value: string][];
  actions: DialogAction[];
  /** Barra de contagem regressiva (ex.: avanço automático para o próximo nível). */
  countdownMs?: number;
  countdownLabel?: string;
  confetti?: boolean;
  tone?: 'success' | 'warning';
  className?: string;
};

/** Cria e exibe um pop-up modal. Retorna o elemento para que quem abriu possa removê-lo. */
export function showDialog(host: HTMLElement, opts: DialogOptions): HTMLElement {
  const backdrop = el('div', `dialog-backdrop ${opts.className ?? ''}`.trim());
  const card = el('div', `dialog dialog--${opts.tone ?? 'success'}`);
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', 'dialog-title');

  const icon = el('div', 'dialog-icon', opts.icon);
  icon.setAttribute('aria-hidden', 'true');
  const title = el('h2', 'dialog-title', opts.title);
  title.id = 'dialog-title';
  card.append(icon, title);

  if (opts.stars !== undefined) {
    const stars = el('div', 'dialog-stars');
    stars.setAttribute('aria-label', `${opts.stars} de 3 estrelas`);
    for (let i = 0; i < 3; i++) {
      const star = el('span', i < opts.stars ? 'star is-on' : 'star', '★');
      star.style.setProperty('--i', String(i));
      stars.append(star);
    }
    card.append(stars);
  }

  if (opts.message) card.append(el('p', 'dialog-message', opts.message));

  if (opts.stats?.length) {
    const stats = el('dl', 'dialog-stats');
    for (const [label, value] of opts.stats) {
      const item = el('div', 'dialog-stat');
      item.append(el('dt', '', label), el('dd', '', value));
      stats.append(item);
    }
    card.append(stats);
  }

  const actions = el('div', 'overlay-actions');
  for (const action of opts.actions) {
    const button = el('button', `btn btn-${action.variant}`, action.label) as HTMLButtonElement;
    button.type = 'button';
    button.addEventListener('click', action.onClick);
    actions.append(button);
  }
  card.append(actions);

  if (opts.countdownMs && opts.countdownMs > 0) {
    const countdown = el('div', 'dialog-countdown');
    const bar = el('div', 'dialog-countdown-bar');
    bar.style.animationDuration = `${opts.countdownMs}ms`;
    countdown.append(bar);
    card.append(countdown);
    if (opts.countdownLabel) card.append(el('p', 'dialog-countdown-label', opts.countdownLabel));
  }

  backdrop.append(card);
  host.append(backdrop);
  if (opts.confetti) launchConfetti(backdrop);
  actions.querySelector('button')?.focus({ preventScroll: true });
  return backdrop;
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
