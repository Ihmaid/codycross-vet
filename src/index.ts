import './ui/styles/main.scss';
import { GameEngine } from './core/engine/GameEngine';
import { Level } from './core/models/Level';
import { prepareLevel } from './core/levels';
import { loadProgress, saveProgress } from './core/progress';
import { RAW_LEVELS } from './data/levels';
import { bindMobileInput, focusIME } from './ui/mobileInput';

const AUTO_ADVANCE_DELAY_MS = 1000;

function showMessage(root: HTMLElement, className: string, text: string): HTMLElement {
  const box = document.createElement('div');
  box.className = className;
  const p = document.createElement('p');
  p.textContent = text;
  box.append(p);
  root.replaceChildren(box);
  return box;
}

function start(root: HTMLElement): void {
  let levels: Level[];
  try {
    levels = RAW_LEVELS.map(prepareLevel);
  } catch (error) {
    console.error(error);
    showMessage(root, 'error-message', `Erro ao carregar o jogo: ${(error as Error).message}`);
    return;
  }

  let engine: GameEngine | null = null;

  function loadLevel(index: number): void {
    engine?.destroy();
    root.replaceChildren();
    saveProgress(index);

    engine = new GameEngine(root, levels[index], {
      autoAdvanceDelayMs: AUTO_ADVANCE_DELAY_MS,
      onComplete: () => (index + 1 < levels.length ? loadLevel(index + 1) : showEndGame()),
    });
    engine.startGame();
    setTimeout(focusIME, 300);
  }

  function showEndGame(): void {
    engine?.destroy();
    engine = null;
    const box = showMessage(root, 'endgame', '');
    const title = document.createElement('h2');
    title.textContent = 'Parabéns! Você concluiu todos os níveis 🎉';
    const restart = document.createElement('button');
    restart.className = 'btn btn-primary';
    restart.textContent = 'Recomeçar do início';
    restart.addEventListener('click', () => loadLevel(0));
    box.replaceChildren(title, restart);
  }

  document.getElementById('hint-button')?.addEventListener('click', () => {
    engine?.useHint();
    focusIME();
  });
  document.getElementById('reset-button')?.addEventListener('click', () => {
    engine?.startGame();
    focusIME();
  });

  loadLevel(loadProgress(levels.length));
}

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('crossword-container');
  if (!root) {
    document.body.textContent = 'Erro: container do jogo não encontrado!';
    return;
  }
  root.classList.add('crossword-container-active');
  bindMobileInput(root);
  start(root);
});
