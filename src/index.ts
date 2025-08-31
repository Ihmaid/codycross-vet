import './ui/styles/main.scss';
import { GameEngine } from './core/engine/GameEngine';
import { Level } from './core/models/Level';

// ---------------- IME (mobile keyboard) helpers ----------------
const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const imeInput = document.getElementById('ime-input') as HTMLInputElement | null;
const imeCE = document.getElementById('ime-ce') as HTMLDivElement | null;

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
  } catch {}
  target.dispatchEvent(e);
}

function dispatchKeyMobile(key: string, container?: HTMLElement | null) {
  // Send a single keydown to typical targets (avoid doubles)
  [window, document, container].forEach(t => t && fireKeydown(t, key));
}

function focusIMEImmediate() {
  const el = (isIOS ? imeCE : imeInput) as HTMLElement | null;
  if (!el) return;

  if (isIOS && imeCE) imeCE.textContent = '';
  if (!isIOS && imeInput) imeInput.value = '';

  // Focus synchronously within the same gesture (iOS requirement)
  el.focus();

  if (isIOS && imeCE) {
    // Place caret (helps Safari)
    const range = document.createRange();
    range.selectNodeContents(imeCE);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges(); sel?.addRange(range);
  } else if (imeInput && imeInput.setSelectionRange) {
    imeInput.setSelectionRange(1, 1);
  }
}

function focusIME() {
  requestAnimationFrame(() => focusIMEImmediate());
}

// Suppress *native* (trusted) keydown/keypress only on touch devices while IME focused.
// This prevents doubles on Android; desktop path doesn’t use IME, so nothing is suppressed there.
function installNativeKeySuppressor() {
  if (!isTouch) return;
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

function bindIME(container: HTMLElement) {
  installNativeKeySuppressor();

  if (imeInput) {
    let composing = false;
    imeInput.addEventListener('compositionstart', () => (composing = true));
    imeInput.addEventListener('compositionend', (e) => {
      composing = false;
      const v = (e.target as HTMLInputElement).value;
      if (v && isTouch) {
        dispatchKeyMobile(v.slice(-1).toUpperCase(), container);
      }
      imeInput.value = '';
    });
    imeInput.addEventListener('input', () => {
      if (composing) return;
      const v = imeInput.value;
      if (v && isTouch) {
        dispatchKeyMobile(v.slice(-1).toUpperCase(), container);
      }
      imeInput.value = '';
    });
    imeInput.addEventListener('keydown', (ev) => {
      if (!isTouch) return; // desktop: do nothing, let native flow
      if (ev.key === 'Backspace') {
        ev.preventDefault();
        dispatchKeyMobile('Backspace', container);
        imeInput.value = '';
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        dispatchKeyMobile('Enter', container);
        imeInput.value = '';
      }
    });
  }

  if (imeCE) {
    imeCE.addEventListener('input', () => {
      const txt = (imeCE.textContent || '').trim();
      if (!txt) return;
      if (isTouch) dispatchKeyMobile(txt.slice(-1).toUpperCase(), container);
      imeCE.textContent = '';
    });
    imeCE.addEventListener('keydown', (ev) => {
      if (!isTouch) return;
      if (ev.key === 'Backspace') {
        ev.preventDefault();
        dispatchKeyMobile('Backspace', container);
        imeCE.textContent = '';
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        dispatchKeyMobile('Enter', container);
        imeCE.textContent = '';
      }
    });
  }
}
// ----------------------------------------------------------------

// Inicializa o jogo quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM carregado, inicializando jogo");

  const loadingElement = document.getElementById('loading');
  if (loadingElement) loadingElement.remove();

  console.log("Verificando container do jogo");
  const container = document.getElementById('crossword-container');
  if (!container) {
    console.error('Container do jogo não encontrado!');
    document.body.innerHTML += '<div style="color: red; padding: 20px;">Erro: Container do jogo não encontrado!</div>';
    return;
  }

  // IME only for touch devices (mobile). Desktop keeps native keyboard.
  bindIME(container);

  if (isTouch) {
    // iOS: focus IME synchronously on touchstart (needs passive:false + preventDefault)
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
    // Android: async focus OK
    container.addEventListener('touchend', () => {
      if (!isIOS) focusIME();
    }, { passive: true });
    // Also allow tap/click to refocus (both platforms)
    container.addEventListener('click', () => focusIME());
  }

  container.classList.add('crossword-container-active');

  console.log("Carregando nível do jogo");
  fetch('./data/levels/level1.json')
    .then(response => {
      if (!response.ok) throw new Error(`Erro ao carregar nível: ${response.statusText}`);
      console.log("Resposta recebida, convertendo para JSON");
      return response.json();
    })
    .then((level: Level) => {
      console.log("Nível carregado:", level);

      console.log("Inicializando motor do jogo");
      const gameEngine = new GameEngine(container, level);

      console.log("Configurando botões");
      const hintButton = document.getElementById('hint-button');
      if (hintButton) {
        hintButton.addEventListener('click', () => {
          console.log("Botão de dica clicado");
          gameEngine.useHint();
          if (isTouch) focusIME();
        });
      } else {
        console.error("Botão de dica não encontrado!");
      }

      const resetButton = document.getElementById('reset-button');
      if (resetButton) {
        resetButton.addEventListener('click', () => {
          console.log("Botão de reiniciar clicado");
          gameEngine.startGame();
          if (isTouch) focusIME();
        });
      } else {
        console.error("Botão de reiniciar não encontrado!");
      }

      console.log("Configurando dica da palavra vertical");
      const verticalClue = document.getElementById('vertical-clue');
      if (verticalClue) verticalClue.textContent = level.verticalWord.clue;
      else console.error("Elemento de dica vertical não encontrado!");

      console.log("Configurando exibição da palavra vertical");
      const verticalWordElement = document.getElementById('vertical-word');
      if (verticalWordElement) {
        const verticalWord = level.verticalWord.word;
        let html = '';
        for (let i = 0; i < verticalWord.length; i++) {
          html += `<span class="letter empty" data-index="${i}"></span>`;
        }
        verticalWordElement.innerHTML = html;
      } else {
        console.error("Elemento da palavra vertical não encontrado!");
      }

      const clueContainer = document.querySelector('.clue-container');
      if (clueContainer) {
        clueContainer.innerHTML = `
          <p><strong>Dica:</strong> ${level.horizontalWords[0].clue}</p>
          <p class="instructions">Clique em uma célula e digite para preencher as palavras cruzadas.</p>
        `;
      }

      console.log("Iniciando o jogo");
      gameEngine.startGame();

      // Seleciona primeira célula e (em mobile) abre teclado
      setTimeout(() => {
        try {
          const firstWord = level.horizontalWords[0];
          const row = firstWord.position;
          const col = firstWord.intersectionIndex;
          console.log(`Selecionando primeira célula automaticamente: ${row}, ${col}`);
          gameEngine.useHint();
          if (isTouch) focusIME();
        } catch {
          // ignora se estrutura mudar
        }
      }, 500);

      console.log("Jogo iniciado com sucesso");
    })
    .catch(error => {
      console.error('Erro ao inicializar o jogo:', error);
      const container = document.getElementById('crossword-container');
      if (container) {
        container.innerHTML = `<div class="error-message">Erro ao carregar o jogo: ${error.message}</div>`;
      }
    });
});