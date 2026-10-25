/**
 * Teclado virtual no celular: o canvas não abre teclado sozinho, então um <input> (Android)
 * ou <div contenteditable> (iOS) invisível recebe o foco e as letras digitadas são
 * reenviadas como eventos "keydown" para o window, onde o GameEngine as trata.
 */
const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS

export const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

let imeInput: HTMLInputElement | null = null;
let imeCE: HTMLDivElement | null = null;

function keyToCodes(key: string) {
  if (key === 'Backspace') return { keyCode: 8, which: 8, charCode: 0, code: 'Backspace' };
  if (key === 'Enter')     return { keyCode: 13, which: 13, charCode: 13, code: 'Enter' };
  const ch = (key || '').toUpperCase();
  const kc = ch.length === 1 ? ch.charCodeAt(0) : 0;
  return { keyCode: kc, which: kc, charCode: kc, code: kc ? `Key${ch}` : '' };
}

function fireKeydown(target: EventTarget, key: string) {
  const { keyCode, which, charCode, code } = keyToCodes(key);
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  try {
    Object.defineProperty(e, 'keyCode',  { get: () => keyCode });
    Object.defineProperty(e, 'which',    { get: () => which });
    Object.defineProperty(e, 'charCode', { get: () => charCode });
    if (code) Object.defineProperty(e, 'code', { get: () => code });
  } catch { /* propriedades legadas são opcionais */ }
  target.dispatchEvent(e);
}
function dispatchKeyMobile(key: string) { fireKeydown(window, key); }

function focusIMEImmediate() {
  const el = (isIOS ? imeCE : imeInput) as HTMLElement | null;
  if (!el) return;
  if (isIOS && imeCE) imeCE.textContent = '';
  if (!isIOS && imeInput) imeInput.value = '';
  el.focus();
  if (isIOS && imeCE) {
    const range = document.createRange();
    range.selectNodeContents(imeCE);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges(); sel?.addRange(range);
  } else if (imeInput && imeInput.setSelectionRange) {
    imeInput.setSelectionRange(1, 1);
  }
}

/** Abre o teclado virtual (no próximo frame). Não faz nada em desktop. */
export function focusIME() {
  if (isTouch) requestAnimationFrame(() => focusIMEImmediate());
}

function installNativeKeySuppressor() {
  const guard = (ev: KeyboardEvent) => {
    const active = document.activeElement;
    const imeFocused = active === imeInput || active === imeCE;
    if (imeFocused && ev.isTrusted) {
      ev.stopImmediatePropagation();
      ev.preventDefault();
    }
  };
  window.addEventListener('keydown',  guard, true);
  window.addEventListener('keypress', guard, true);
}

function bindIME() {
  installNativeKeySuppressor();

  if (imeInput) {
    const input = imeInput;
    let composing = false;
    input.addEventListener('compositionstart', () => (composing = true));
    input.addEventListener('compositionend', (e) => {
      if (!composing) return;
      composing = false;
      const v = (e.target as HTMLInputElement).value;
      if (v) dispatchKeyMobile(v.slice(-1).toUpperCase());
      input.value = '';
    });
    input.addEventListener('input', () => {
      if (composing) return;
      const v = input.value;
      if (v) dispatchKeyMobile(v.slice(-1).toUpperCase());
      input.value = '';
    });
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Backspace' || ev.key === 'Enter') {
        ev.preventDefault();
        dispatchKeyMobile(ev.key);
        input.value = '';
      }
    });
  }

  if (imeCE) {
    const ce = imeCE;
    ce.addEventListener('input', () => {
      const ch = (ce.textContent || '').replace(/\n+$/, '').slice(-1);
      if (ch) dispatchKeyMobile(ch.toUpperCase());
      ce.textContent = '';
    });
    ce.addEventListener('keydown', (ev) => {
      if (ev.key === 'Backspace' || ev.key === 'Enter') {
        ev.preventDefault();
        dispatchKeyMobile(ev.key);
        ce.textContent = '';
      }
    });
  }
}

function bindMobileFocus(container: HTMLElement) {
  container.addEventListener(
    'touchstart',
    (ev) => {
      if (isIOS) {
        ev.preventDefault();
        focusIMEImmediate();
      }
    },
    { passive: false }
  );
  container.addEventListener('touchend', () => {
    if (!isIOS) focusIME();
  }, { passive: true });
  container.addEventListener('click', () => focusIME());
}

/** Liga o teclado virtual ao container do jogo. Em dispositivos sem toque não faz nada. */
export function bindMobileInput(container: HTMLElement) {
  if (!isTouch) return;
  imeInput = document.getElementById('ime-input') as HTMLInputElement | null;
  imeCE = document.getElementById('ime-ce') as HTMLDivElement | null;
  bindIME();
  bindMobileFocus(container);
}
