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

// Send to a single target (window) to avoid double/triple deliveries
function dispatchKeyMobile(key: string) {
  fireKeydown(window, key);
}

function focusIMEImmediate() {
  const el = (isIOS ? imeCE : imeInput) as HTMLElement | null;
  if (!el) return;

  if (isIOS && imeCE) imeCE.textContent = '';
  if (!isIOS && imeInput) imeInput.value = '';

  // Focus synchronously within the same gesture (iOS requirement)
  el.focus();

  // Place caret (helps Safari)
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

function focusIME() {
  requestAnimationFrame(() => focusIMEImmediate());
}

// Suppress *native* keydown/keypress ONLY on touch devices while IME focused (prevents doubles on Android)
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

function bindIME() {
  installNativeKeySuppressor();

  // ANDROID / general: <input> path
  if (imeInput) {
    let composing = false;

    imeInput.addEventListener('compositionstart', () => (composing = true));

    imeInput.addEventListener('compositionend', (e) => {
      // Use compositionend ONLY if we were composing; ignore input for this char
      if (!isTouch) return;
      if (!composing) return;
      composing = false;

      const v = (e.target as HTMLInputElement).value;
      if (v) dispatchKeyMobile(v.slice(-1).toUpperCase());
      imeInput.value = '';
    });

    imeInput.addEventListener('input', () => {
      // If we are composing, skip 'input' (compositionend will handle it)
      if (!isTouch) return;
      if (composing) return;

      const v = imeInput.value;
      if (v) dispatchKeyMobile(v.slice(-1).toUpperCase());
      imeInput.value = '';
    });

    imeInput.addEventListener('keydown', (ev) => {
      if (!isTouch) return; // desktop: let native flow
      if (ev.key === 'Backspace') {
        ev.preventDefault();
        dispatchKeyMobile('Backspace');
        imeInput.value = '';
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        dispatchKeyMobile('Enter');
        imeInput.value = '';
      }
    });
  }

  // iOS: contenteditable path
  if (imeCE) {
    imeCE.addEventListener('beforeinput', (ev) => {
      // Some iOS keyboards send beforeinput; we can use input below
      // but prevent rich text ops just in case
      const anyEv = ev as any;
      if (anyEv.inputType && anyEv.inputType.startsWith('insert')) {
        // allow
      }
    });

    imeCE.addEventListener('input', () => {
      if (!isTouch) return;
      const txt = (imeCE.textContent || '');
      // Use the last character typed; trim only trailing newlines
      const ch = txt.replace(/\n+$/,'').slice(-1);
      if (ch) dispatchKeyMobile(ch.toUpperCase());
      imeCE.textContent = '';
    });

    imeCE.addEventListener('keydown', (ev) => {
      if (!isTouch) return;
      if (ev.key === 'Backspace') {
        ev.preventDefault();
        dispatchKeyMobile('Backspace');
        imeCE.textContent = '';
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        dispatchKeyMobile('Enter');
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

  // Bind IME (mobile only affects touch devices; desktop unchanged)
  bindIME();

  if (isTouch) {
    // iOS: focus synchronously on touchstart (needs passive:false + preventDefault)
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

    // Android: async focus is fine
    container.addEventListener('touchend', () => {
      if (!isIOS) focusIME();
    }, { passive: true });

    // Tap/click to refocus
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