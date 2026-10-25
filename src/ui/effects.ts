import { prefersReducedMotion } from './dom';

/** Cores do V5: verdes, dourado e creme. */
const CONFETTI_COLORS = ['#113c2f', '#268b65', '#8ccea8', '#efcc80', '#e2ae45', '#fffefa'];

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

/** Anima um número subindo até o valor final (ex.: pontos ganhos). */
export function countUp(el: HTMLElement, to: number, format: (n: number) => string, duration = 900): void {
  if (prefersReducedMotion() || to <= 0) {
    el.textContent = format(to);
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = format(Math.round(to * (1 - Math.pow(1 - t, 3))));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
