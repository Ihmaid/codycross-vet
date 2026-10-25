const CONFETTI_COLORS = ['#803031', '#a8474a', '#d9a441', '#f3d58c', '#a19896', '#ffffff'];

export const prefersReducedMotion = (): boolean =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Chuva de confete (só CSS) sobre o elemento; remove-se sozinha. */
export function launchConfetti(host: HTMLElement, pieces = 90): void {
  if (prefersReducedMotion()) return;
  const layer = document.createElement('div');
  layer.className = 'confetti';
  layer.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < pieces; i++) {
    const piece = document.createElement('span');
    piece.style.setProperty('--x', `${Math.random() * 100}%`);
    piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 160}px`);
    piece.style.setProperty('--spin', `${(Math.random() - 0.5) * 1440}deg`);
    piece.style.setProperty('--delay', `${Math.random() * 0.6}s`);
    piece.style.setProperty('--duration', `${2.2 + Math.random() * 1.6}s`);
    piece.style.setProperty('--color', CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
    if (i % 3 === 0) piece.classList.add('round');
    layer.append(piece);
  }

  host.append(layer);
  setTimeout(() => layer.remove(), 4500);
}
