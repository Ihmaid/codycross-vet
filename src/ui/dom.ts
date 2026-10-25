/** Busca um elemento pelo id (os ids existem no index.html). */
export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento #${id} não encontrado`);
  return el as T;
}

/** Trecho de HTML já seguro (resultado de `html`). */
export class Html {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

function interpolate(value: unknown): string {
  if (value instanceof Html) return value.value;
  if (Array.isArray(value)) return value.map(interpolate).join('');
  if (value === null || value === undefined || value === false) return '';
  return escapeHtml(String(value));
}

/**
 * Template de HTML que escapa automaticamente os valores interpolados
 * (textos do conteúdo e anotações do usuário nunca viram código).
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): Html {
  return new Html(strings.reduce((out, s, i) => out + s + (i < values.length ? interpolate(values[i]) : ''), ''));
}

export function setHtml(el: HTMLElement, content: Html): void {
  el.innerHTML = content.value;
}

export function show(el: HTMLElement, visible: boolean): void {
  el.hidden = !visible;
}

export const prefersReducedMotion = (): boolean =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Reaplica uma classe de animação CSS, mesmo que já esteja no elemento. */
export function replayAnimation(el: Element, className: string): void {
  el.classList.remove(className);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(className);
}
