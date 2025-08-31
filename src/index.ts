import './ui/styles/main.scss';
import { GameEngine } from './core/engine/GameEngine';
import { Level } from './core/models/Level';

// ---------------- IME (mobile keyboard) helpers ----------------
const ime = document.getElementById('ime-input') as HTMLInputElement | null;

function focusIME() {
  if (!ime) return;
  ime.value = '';
  // Focus must happen after a user gesture (tap)
  setTimeout(() => ime.focus(), 0);
}

function dispatchKey(key: string) {
  // Simulate real keyboard events so existing listeners work
  const kd = new KeyboardEvent('keydown', { key, bubbles: true });
  const ku = new KeyboardEvent('keyup', { key, bubbles: true });
  window.dispatchEvent(kd);
  window.dispatchEvent(ku);
}

function bindIME() {
  if (!ime) return;

  let composing = false;
  ime.addEventListener('compositionstart', () => (composing = true));
  ime.addEventListener('compositionend', (e) => {
    composing = false;
    const v = (e.target as HTMLInputElement).value;
    if (v) {
      dispatchKey(v.slice(-1).toUpperCase());
      ime.value = '';
    }
  });

  ime.addEventListener('input', () => {
    if (composing) return;
    const v = ime.value;
    if (!v) return;
    dispatchKey(v.slice(-1).toUpperCase());
    ime.value = '';
  });

  ime.addEventListener('keydown', (ev) => {
    if (ev.key === 'Backspace') {
      ev.preventDefault();
      dispatchKey('Backspace');
      ime.value = '';
    } else if (ev.key === 'Enter') {
      // Optional: treat Enter as "next"
      ev.preventDefault();
      dispatchKey('Enter');
      ime.value = '';
    }
  });
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

  // Liga IME listeners (mobile)
  bindIME();

  // Ao tocar no tabuleiro, garantir foco no IME (abre o teclado)
  container.addEventListener('pointerdown', () => focusIME());
  container.addEventListener('touchstart', () => focusIME(), { passive: true });
  container.addEventListener('mousedown', () => focusIME());

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
          // Mantém o teclado aberto após usar dica no mobile
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
          gameEngine.useHint(); // mantém seu comportamento atual
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