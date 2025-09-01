import './ui/styles/main.scss';
import { GameEngine } from './core/engine/GameEngine';
import { Level } from './core/models/Level';

/* =======================
   LEVEL SEQUENCING
======================= */
const LEVELS = [
  'data/levels/level1.json',
  'data/levels/level2.json',
  'data/levels/level3.json',
  'data/levels/level4.json',
];

function getProgress(): number {
  const raw = localStorage.getItem('ccvet:levelIndex');
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), LEVELS.length - 1) : 0;
}

function setProgress(idx: number) {
  localStorage.setItem('ccvet:levelIndex', String(idx));
}

/* =======================
   IME (mobile keyboard) — keep as-is for now
======================= */
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
function focusIME() { requestAnimationFrame(() => focusIMEImmediate()); }

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

  if (imeInput) {
    let composing = false;
    imeInput.addEventListener('compositionstart', () => (composing = true));
    imeInput.addEventListener('compositionend', (e) => {
      if (!isTouch) return;
      if (!composing) return;
      composing = false;
      const v = (e.target as HTMLInputElement).value;
      if (v) dispatchKeyMobile(v.slice(-1).toUpperCase());
      imeInput.value = '';
    });
    imeInput.addEventListener('input', () => {
      if (!isTouch) return;
      if (composing) return;
      const v = imeInput.value;
      if (v) dispatchKeyMobile(v.slice(-1).toUpperCase());
      imeInput.value = '';
    });
    imeInput.addEventListener('keydown', (ev) => {
      if (!isTouch) return;
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

  if (imeCE) {
    imeCE.addEventListener('input', () => {
      if (!isTouch) return;
      const txt = (imeCE.textContent || '');
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

function bindMobileFocus(container: HTMLElement) {
  if (!isTouch) return;
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

/* =======================
   BOOTSTRAP
======================= */
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM carregado, inicializando jogo");
  document.getElementById('loading')?.remove();

  const container = document.getElementById('crossword-container');
  if (!container) {
    console.error('Container do jogo não encontrado!');
    document.body.innerHTML += '<div style="color: red; padding: 20px;">Erro: Container do jogo não encontrado!</div>';
    return;
  }

  // Keep IME binding (does nothing on desktop)
  bindIME();
  bindMobileFocus(container);

  container.classList.add('crossword-container-active');

  // Cache DOM refs once
  const hintButton = document.getElementById('hint-button');
  const resetButton = document.getElementById('reset-button');
  const verticalClue = document.getElementById('vertical-clue');
  const verticalWordElement = document.getElementById('vertical-word');
  const clueContainer = document.querySelector('.clue-container');

  let gameEngine: GameEngine | null = null;
  let currentIndex = getProgress();

  function renderLevelUI(level: Level) {
    if (verticalClue) verticalClue.textContent = level.verticalWord.clue;

    if (verticalWordElement) {
      const verticalWord = level.verticalWord.word;
      let html = '';
      for (let i = 0; i < verticalWord.length; i++) {
        html += `<span class="letter empty" data-index="${i}"></span>`;
      }
      verticalWordElement.innerHTML = html;
    }

    if (clueContainer) {
      clueContainer.innerHTML = `
        <p><strong>Dica:</strong> ${level.horizontalWords[0].clue}</p>
        <p class="instructions">Clique em uma célula e digite para preencher as palavras cruzadas.</p>
      `;
    }
  }

  function showEndGame() {
    container.innerHTML = `
      <div class="endgame">
        <h2>Parabéns! Você concluiu todos os níveis 🎉</h2>
        <button id="restart-all" class="btn btn-primary">Recomeçar do início</button>
      </div>
    `;
    document.getElementById('restart-all')?.addEventListener('click', () => {
      setProgress(0);
      location.reload();
    });
  }

  function loadLevel(index: number) {
    const url = LEVELS[index];
    console.log(`Carregando nível ${index + 1}/${LEVELS.length}: ${url}`);

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Erro ao carregar nível: ${response.statusText}`);
        return response.json();
      })
      .then((level: Level) => {
        renderLevelUI(level);

        // Clean up previous instance (if any)
        (gameEngine as any)?.destroy?.();

        // Create engine with completion hook (auto-advance after 1s)
        gameEngine = new GameEngine(container, level, {
          onComplete: () => {
            const next = index + 1;
            if (next < LEVELS.length) {
              setProgress(next);
              loadLevel(next);
            } else {
              setProgress(LEVELS.length - 1);
              (gameEngine as any)?.destroy?.();
              showEndGame();
            }
          },
          autoAdvanceDelayMs: 1000, // adjust: 0 = immediate; -1 = no auto
        });

        // Wire buttons to this instance
        if (hintButton) {
          hintButton.onclick = () => {
            gameEngine!.useHint();
            if (isTouch) focusIME();
          };
        }
        if (resetButton) {
          resetButton.onclick = () => {
            gameEngine!.startGame();
            if (isTouch) focusIME();
          };
        }

        // Start level
        gameEngine.startGame();

        // Optional: focus keyboard shortly after start on mobile
        setTimeout(() => { if (isTouch) focusIME(); }, 300);
      })
      .catch((error) => {
        console.error('Erro ao inicializar o nível:', error);
        container.innerHTML = `<div class="error-message">Erro ao carregar o jogo: ${error.message}</div>`;
      });
  }

  // Kick off with saved or first level
  loadLevel(currentIndex);
});