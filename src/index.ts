import './ui/styles/main.scss';
import { GameEngine } from './core/engine/GameEngine';
import { Level } from './core/models/Level';
import { prepareLevel } from './core/levels';
import { loadProgress, saveProgress } from './core/progress';
import { RAW_LEVELS } from './data/levels';
import { GameHud } from './ui/GameHud';
import { showDialog } from './ui/Dialog';
import { bindMobileInput, focusIME } from './ui/mobileInput';

/** Tempo entre concluir um nível e ir para o próximo (comemoração + pop-up). */
const AUTO_ADVANCE_DELAY_MS = 3500;

function showError(root: HTMLElement, text: string): void {
  const box = document.createElement('div');
  box.className = 'error-message';
  box.textContent = text;
  root.replaceChildren(box);
}

/** As letras da grade são desenhadas no canvas: espera a fonte carregar (no máximo 1,5s). */
function waitForFonts(): Promise<unknown> {
  if (!document.fonts?.load) return Promise.resolve();
  return Promise.race([
    document.fonts.load('800 32px Nunito').catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
}

function start(root: HTMLElement): void {
  let levels: Level[];
  try {
    levels = RAW_LEVELS.map(prepareLevel);
  } catch (error) {
    console.error(error);
    showError(root, `Erro ao carregar o jogo: ${(error as Error).message}`);
    return;
  }

  const hud = new GameHud();
  let engine: GameEngine | null = null;

  function loadLevel(index: number): void {
    engine?.destroy();
    root.replaceChildren();
    saveProgress(index);

    const level = levels[index];
    hud.setLevel(index, levels.length, level);
    hud.showLevelIntro(index, level.theme);
    engine = new GameEngine(root, level, hud, {
      autoAdvanceDelayMs: AUTO_ADVANCE_DELAY_MS,
      onComplete: () => (index + 1 < levels.length ? loadLevel(index + 1) : showEndGame()),
    });
    engine.startGame();
    setTimeout(focusIME, 300);
  }

  function showEndGame(): void {
    engine?.destroy();
    engine = null;
    root.replaceChildren();
    const dialog = showDialog(root, {
      icon: '🎓',
      title: 'Parabéns, você zerou o jogo!',
      message: 'Você concluiu todos os níveis do CodyCross Veterinária.',
      actions: [
        {
          label: 'Recomeçar do início',
          variant: 'primary',
          onClick: () => {
            dialog.remove();
            loadLevel(0);
          },
        },
      ],
      confetti: true,
      className: 'endgame',
    });
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
  bindMobileInput(root);
  waitForFonts().then(() => start(root));
});
