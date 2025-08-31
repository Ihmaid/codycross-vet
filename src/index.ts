import './ui/styles/main.scss';
import { GameEngine } from './core/engine/GameEngine';
import { Level } from './core/models/Level';

// ---------------- IME (mobile keyboard) helpers ----------------
const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS

const imeInput = document.getElementById('ime-input') as HTMLInputElement | null;
const imeCE = document.getElementById('ime-ce') as HTMLDivElement | null;

function keyToCodes(key: string) {
  if (key === 'Backspace') return { keyCode: 8, which: 8, charCode: 0, code: 'Backspace' };
  if (key === 'Enter')     return { keyCode: 13, which: 13, charCode: 13, code: 'Enter' };
  const ch = (key || '').toUpperCase();
  const kc = ch.length === 1 ? ch.charCodeAt(0) : 0;
  return { keyCode: kc, which: kc, charCode: kc, code: kc ? `Key${ch}` : '' };
}

function fireKey(target: EventTarget, type: 'keydown'|'keypress'|'keyup', key: string) {
  const { keyCode, which, charCode, code } = keyToCodes(key);
  const e = new KeyboardEvent(type, { key, bubbles: true, cancelable: true });
  try {
    Object.defineProperty(e, 'keyCode',  { get: () => keyCode });
    Object.defineProperty(e, 'which',    { get: () => which });
    Object.defineProperty(e, 'charCode', { get: () => charCode });
    if (code) Object.defineProperty(e, 'code', { get: () => code });
  } catch {}
  target.dispatchEvent(e);
}

function dispatchKeyEverywhere(key: string, container?: HTMLElement | null) {
  [window, document, container].forEach(t => {
    if (!t) return;
    fireKey(t, 'keydown',  key);
    fireKey(t, 'keypress', key);
    fireKey(t, 'keyup',    key);
  });
}

function focusIMEImmediate() {
  const el = (isIOS ? imeCE : imeInput) as HTMLElement | null;
  if (!el) return;

  if (isIOS && imeCE) imeCE.textContent = '';
  if (!isIOS && imeInput) imeInput.value = '';

  // Focus synchronously in the same gesture (important for iOS)
  el.focus();

  // Keep caret placed (helps Safari)
  if (isIOS && imeCE) {
    const range = document.createRange();
    range.selectNodeContents(imeCE);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  } else if (imeInput && imeInput.setSelectionRange) {
    imeInput.setSelectionRange(1, 1);
  }
}

// Non-iOS can be async
function focusIME() {
  requestAnimationFrame(() => focusIMEImmediate());
}

// Prevent double input: while IME focused, block *native* keydown/keypress (trusted events).
function suppressNativeKeysWhenIMEFocused() {
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
  suppressNativeKeysWhenIMEFocused();

  // <input> path (Android / most browsers)
  if (imeInput) {
    let composing = false;
    imeInput.addEventListener('compositionstart', () => (composing = true));
    imeInput.addEventListener('compositionend', (e) => {
      composing = false;
      const v = (e.target as HTMLInputElement).value;
      if (v) {
        dispatchKeyEverywhere(v.slice(-1).toUpperCase(), container);
        imeInput.value = '';
      }
    });
    imeInput.addEventListener('input', () => {
      if (composing) return;
      const v = imeInput.value;
      if (!v) return;
      dispatchKeyEverywhere(v.slice(-1).toUpperCase(), container);
      imeInput.value = '';
    });
    imeInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Backspace') {
        ev.preventDefault();
        dispatchKeyEverywhere('Backspace', container);
        imeInput.value = '';
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        dispatchKeyEverywhere('Enter', container);
        imeInput.value = '';
      }
    });
  }

  // iOS contenteditable path
  if (imeCE) {
    imeCE.addEventListener('input', () => {
      const txt = (imeCE.textContent || '').trim();
      if (!txt) return;
      dispatchKeyEverywhere(txt.slice(-1).toUpperCase(), container);
      imeCE.textContent = '';
    });
    imeCE.addEventListener('keydown', (ev) => {
      if (ev.key === 'Backspace') {
        ev.preventDefault();
        dispatchKeyEverywhere('Backspace', container);
        imeCE.textContent = '';
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        dispatchKeyEverywhere('Enter', container);
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

  // Liga IME (mobile)
  bindIME(container);

  // iOS: foco síncrono no touchstart (precisa passive:false + preventDefault)
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

  // Android/desktop: pode ser assíncrono
  container.addEventListener('touchend', () => {
    if (!isIOS) focusIME();
  }, { passive: true });

  container.addEventListener('click', () => focusIME());

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
          focusIME();
        });
      } else {
        console.error("Botão de dica não encontrado!");
      }

      const resetButton = document.getElementById('reset-button');
      if (resetButton) {
        resetButton.addEventListener('click', () => {
          console.log("Botão de reiniciar clicado");
          gameEngine.startGame();
          focusIME();
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

      // Seleciona primeira célula e abre teclado no mobile
      setTimeout(() => {
        try {
          const firstWord = level.horizontalWords[0];
          const row = firstWord.position;
          const col = firstWord.intersectionIndex;
          console.log(`Selecionando primeira célula automaticamente: ${row}, ${col}`);
          gameEngine.useHint();
          focusIME();
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