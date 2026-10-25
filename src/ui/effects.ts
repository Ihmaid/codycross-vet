import { prefersReducedMotion } from './dom';

/** Anima um número subindo até o valor final (ex.: pontos ganhos). */
export function countUp(el: HTMLElement, to: number, format: (n: number) => string, duration = 700): void {
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
